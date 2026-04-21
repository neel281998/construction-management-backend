const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const Inventory = require('../models/Inventory');
const Vehicle = require('../models/Vehicle');
const VehicleTrip = require('../models/VehicleTrip');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logActivity, getActivityStyle } = require('../utils/activityLogger');
const { createStorageInboundTrip } = require('../utils/vehicleTripService');

const router = express.Router();

function isSameDay(a, b) {
  if (!a || !b) return false;
  const d1 = new Date(a);
  const d2 = new Date(b);
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

const restockStorage = multer.memoryStorage();
const allowedRestockMimeTypes = (process.env.RESTOCK_ALLOWED_MIME_TYPES || 'image/jpeg,image/png,image/webp,image/heic,image/heif').split(',');
const restockUpload = multer({
  storage: restockStorage,
  limits: {
    fileSize: parseInt(process.env.RESTOCK_ATTACHMENT_MAX_SIZE || process.env.MAX_FILE_SIZE || String(10 * 1024 * 1024), 10)
  },
  fileFilter: (req, file, cb) => {
    if (allowedRestockMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      req.fileValidationError = 'Unsupported file type. Please upload an image.';
      cb(null, false);
    }
  }
});

let gfsBucket;
mongoose.connection.once('open', () => {
  gfsBucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
});

const uploadRestockAttachment = (file, userId) => {
  if (!file) {
    return Promise.resolve(null);
  }

  if (!gfsBucket) {
    return Promise.reject(new Error('File storage bucket is not initialized'));
  }

  const uploadedAt = new Date();

  return new Promise((resolve, reject) => {
    const uploadStream = gfsBucket.openUploadStream(file.originalname, {
      metadata: {
        uploadedBy: userId,
        uploadedAt,
        category: 'inventory-restock',
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size
      }
    });

    uploadStream.on('finish', () => {
      resolve({
        fileId: uploadStream.id.toString(),
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        uploadedAt,
        uploadedBy: userId
      });
    });

    uploadStream.on('error', reject);
    uploadStream.end(file.buffer);
  });
};

const handleRestockUpload = (req, res, next) => {
  restockUpload.single('attachment')(req, res, (err) => {
    if (err) {
      console.error('Restock attachment upload failed:', err);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'Attachment exceeds the maximum allowed size'
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message || 'Invalid attachment upload'
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Unexpected error while uploading attachment'
      });
    }

    if (req.fileValidationError) {
      return res.status(400).json({
        success: false,
        message: req.fileValidationError
      });
    }

    return next();
  });
};

// Get all inventory items
router.get('/', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      lowStock,
      search,
      storageSiteId
    } = req.query;
    
    // Build query
    let query = { isActive: true };
    
    // Apply storage site access control for non-admin users
    if (req.user.role !== 'admin') {
      const assignedSites = req.user.assignedStorageSites || [];
      if (assignedSites.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'No storage sites assigned to user'
        });
      }
      query.storageSite = { $in: assignedSites };
    }
    // For admin users, no storage site restriction - they can see all items
    
    // Apply filters
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (storageSiteId && storageSiteId !== 'all') {
      // For non-admin users, ensure they can only access assigned storage sites
      if (req.user.role !== 'admin') {
        const assignedSites = req.user.assignedStorageSites || [];
        if (!assignedSites.includes(storageSiteId)) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to this storage site'
          });
        }
      }
      query.storageSite = storageSiteId;
    }
    
    if (lowStock === 'true') {
      query.$expr = { $lte: ['$currentStock', '$minimumStock'] };
    }
    
    if (search) {
      query.$or = [
        { itemName: { $regex: search, $options: 'i' } },
        { 'supplier.name': { $regex: search, $options: 'i' } }
      ];
    }
    
    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [items, totalCount, lowStockCount, totalValue] = await Promise.all([
      Inventory.find(query)
        .populate('storageSite', 'name code')
        .sort({ itemName: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Inventory.countDocuments(query),
      Inventory.countDocuments({ 
        isActive: true,
        $expr: { $lte: ['$currentStock', '$minimumStock'] }
      }),
      Promise.resolve([{ total: 0 }])
    ]);
    
    res.json({
      success: true,
      data: {
        items,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + items.length < totalCount,
          hasPrev: parseInt(page) > 1
        },
        summary: {
          lowStockCount,
          totalValue: totalValue[0]?.total || 0
        }
      }
    });
    
  } catch (error) {
    console.error('Get inventory error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      query: req.query,
      user: req.user?.role
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory items'
    });
  }
});

// Get single inventory item (full restockHistory for detail page, no limit)
router.get('/:id', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id)
      .populate('storageSite', 'name code')
      .populate('restockHistory.restockedBy', 'firstName lastName');
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && item.storageSite && !req.user.assignedStorageSites.includes(item.storageSite._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this inventory item'
      });
    }
    
    res.json({
      success: true,
      data: { item }
    });
    
  } catch (error) {
    console.error('Get inventory item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory item'
    });
  }
});

// Create new inventory item
router.post('/', authenticateToken, requirePermission('inventory.create'), async (req, res) => {
  try {
    console.log('Create inventory request body:', req.body);
    const { storageSite, vehicle } = req.body;
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedStorageSites.includes(storageSite)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this storage site'
      });
    }
    
    // Check if item already exists in this storage site
    const existingItem = await Inventory.findOne({
      itemName: req.body.itemName,
      storageSite: storageSite,
      isActive: true
    });
    
    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: 'Item already exists in this storage site'
      });
    }
    
    // Use the request body directly
    const inventoryData = { ...req.body };
    
    // Add vehicle information if provided
    if (vehicle && vehicle._id) {
      inventoryData.broughtByVehicle = {
        _id: vehicle._id,
        vehicleNumber: vehicle.vehicleNumber,
        vehicleType: vehicle.vehicleType || vehicle.type
      };
      console.log('🚗 Vehicle information added to inventory data:', inventoryData.broughtByVehicle);
    }
    
    console.log('Creating inventory with data:', inventoryData);
    
    // Create and save the inventory item
    let item;
    try {
      item = new Inventory(inventoryData);
      console.log('Inventory item created:', item);
      
      await item.save();
      console.log('Inventory item saved successfully');
    } catch (modelError) {
      console.error('Model error:', modelError);
      throw modelError;
    }
    
    // Update vehicle trip tracking if vehicle is provided
    if (vehicle && vehicle._id) {
      try {
        const Vehicle = require('../models/Vehicle');
        const vehicleDoc = await Vehicle.findById(vehicle._id);
        
        if (vehicleDoc) {
          // Update trip tracking
          const today = new Date();
          const todayStr = today.toISOString().split('T')[0];
          const lastTripDate = vehicleDoc.tripTracking.lastTripDate;
          const lastTripDateStr = lastTripDate ? lastTripDate.toISOString().split('T')[0] : null;
          
          // If it's a new day, reset daily trips
          if (lastTripDateStr !== todayStr) {
            vehicleDoc.tripTracking.dailyTrips = 1;
          } else {
            vehicleDoc.tripTracking.dailyTrips += 1;
          }
          
          vehicleDoc.tripTracking.totalTrips += 1;
          vehicleDoc.tripTracking.lastTripDate = today;
          
          await vehicleDoc.save();
          
          console.log(`Vehicle ${vehicle.vehicleNumber} trip count updated: Daily: ${vehicleDoc.tripTracking.dailyTrips}, Total: ${vehicleDoc.tripTracking.totalTrips}`);
        }
      } catch (vehicleError) {
        console.error('Error updating vehicle trip tracking:', vehicleError);
        // Don't fail the inventory creation if vehicle update fails
      }
    }

    // Record vehicle activity and create VehicleTrip so the trip appears in Vehicle Trips Report
    if (vehicle && vehicle._id) {
      const StorageSite = require('../models/StorageSite');
      const storageSiteDoc = await StorageSite.findById(storageSite);

      try {
        if (storageSiteDoc) {
          await storageSiteDoc.recordVehicleActivity(
            'receipt', // New item creation is considered a receipt
            { ...vehicle, type: vehicle.vehicleType || vehicle.type },
            item,
            {
              quantity: item.currentStock || 0,
              supplier: item.supplier?.name || 'Unknown',
              cost: item.cost || 0,
              notes: 'New inventory item created'
            },
            req.user._id
          );
          console.log(`✅ Vehicle activity recorded for new item creation in storage site: ${storageSiteDoc.name}`);
        }
      } catch (storageSiteError) {
        console.error('Error recording vehicle activity in storage site:', storageSiteError);
        // Don't fail the inventory creation if storage site update fails
      }

      // Always create VehicleTrip when vehicle is present so it appears in Vehicle Trips Report
      try {
        const site = storageSiteDoc || { _id: storageSite, name: 'Storage Site', code: null };
        await createStorageInboundTrip({
          storageSite: { _id: site._id, name: site.name, code: site.code },
          item: { _id: item._id, itemName: item.itemName || item.materialName, category: item.category, unit: item.unit },
          vehicle: { _id: vehicle._id, vehicleNumber: vehicle.vehicleNumber, vehicleType: vehicle.vehicleType || vehicle.type, assignedTo: vehicle.assignedTo },
          quantity: item.currentStock || 0,
          user: req.user,
          supplierName: item.supplier && item.supplier.name ? item.supplier.name : 'Supplier',
          referenceId: item._id,
          referenceType: 'inventory'
        });
      } catch (tripError) {
        console.error('Error creating VehicleTrip for new inventory (report may not show this trip):', tripError);
      }
    }
    
    // Populate storage site for response
    await item.populate('storageSite', 'name code');
    
    // Log activity
    await logActivity({
      user: req.user,
      action: 'inventory_created',
      category: 'inventory',
      title: 'New Inventory Item Created',
      message: `${item.materialName || item.itemName} has been added to inventory`,
      entityType: 'inventory',
      entityId: item._id,
      entityName: item.materialName || item.itemName,
      metadata: {
        category: item.category,
        quantity: item.currentStock,
        unit: item.unit,
        storageSite: item.storageSite?.name,
        vehicle: vehicle?.vehicleNumber
      },
      ...getActivityStyle('inventory_created'),
      req
    });
    
    res.status(201).json({
      success: true,
      message: 'Inventory item created successfully',
      data: { item }
    });
    
  } catch (error) {
    console.error('Create inventory item error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      errors: error.errors
    });
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid data format',
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create inventory item',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Restock inventory item (specific route before /:id/restock)
router.post(
  '/restock',
  authenticateToken,
  requirePermission('inventory.update'),
  handleRestockUpload,
  async (req, res) => {
  try {
    const { itemId } = req.body;
    let { supplier, notes, parchiNo } = req.body;
    const rawQuantity = req.body.quantity;
    const rawCost = req.body.cost;
    const rawTpWeight = req.body.tpWeight;
    let vehicle = req.body.vehicle;

    if (vehicle && typeof vehicle === 'string') {
      try {
        vehicle = JSON.parse(vehicle);
      } catch (error) {
        console.error('Invalid vehicle payload for restock:', error);
        return res.status(400).json({
          success: false,
          message: 'Invalid vehicle data format'
        });
      }
    }

    if (vehicle && vehicle.vehicleType && !vehicle.type) {
      vehicle.type = vehicle.vehicleType;
    }

    const quantity = typeof rawQuantity === 'string' ? parseFloat(rawQuantity) : Number(rawQuantity);

    let parsedCost;
    if (rawCost !== undefined && rawCost !== null && rawCost !== '') {
      parsedCost = typeof rawCost === 'string' ? parseFloat(rawCost) : Number(rawCost);
      if (Number.isNaN(parsedCost) || parsedCost < 0) {
        return res.status(400).json({
          success: false,
          message: 'Cost must be a valid positive number'
        });
      }
    }

    let parsedTpWeight;
    if (rawTpWeight !== undefined && rawTpWeight !== null && rawTpWeight !== '') {
      parsedTpWeight = typeof rawTpWeight === 'string' ? parseFloat(rawTpWeight) : Number(rawTpWeight);
      if (Number.isNaN(parsedTpWeight) || parsedTpWeight < 0) {
        return res.status(400).json({
          success: false,
          message: 'T.p weight must be a valid non-negative number'
        });
      }
    }

    if (supplier) {
      supplier = supplier.toString().trim();
      if (!supplier.length) {
        supplier = undefined;
      }
    }

    if (notes) {
      notes = notes.toString().trim();
      if (!notes.length) {
        notes = undefined;
      }
    }

    if (parchiNo) {
      parchiNo = parchiNo.toString().trim();
      if (!parchiNo.length) {
        parchiNo = undefined;
      }
    }

    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: 'Item ID is required'
      });
    }

    if (Number.isNaN(quantity)) {
      return res.status(400).json({
        success: false,
        message: 'Quantity is required'
      });
    }
    console.log('🚚 Restock request received:', {
      itemId,
      quantity,
      supplier,
      notes,
      cost: parsedCost,
      tpWeight: parsedTpWeight,
      parchiNo,
      vehicle
    });

    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be greater than 0'
      });
    }
    
    const item = await Inventory.findById(itemId);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    // Check access permissions for non-admin users
    if (req.user.role !== 'admin') {
      const assignedSites = req.user.assignedStorageSites || [];
      if (!assignedSites.includes(item.storageSite.toString())) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this inventory item'
        });
      }
    }
    
    const previousStock = item.currentStock;
    
    const attachments = [];
    if (req.file) {
      try {
        const attachmentRecord = await uploadRestockAttachment(req.file, req.user._id);
        if (attachmentRecord) {
          attachments.push(attachmentRecord);
        }
      } catch (uploadError) {
        console.error('Failed to upload restock attachment:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Unable to upload restock attachment'
        });
      }
    }

    const supplierNameForHistory = supplier || item.supplier?.name || 'Unknown';

    // Use the restock method to properly add to history
    await item.restock(
      quantity,
      supplierNameForHistory,
      req.user._id,
      notes,
      vehicle,
      parsedCost,
      attachments,
      parsedTpWeight,
      parchiNo
    );
    
    // Update supplier if provided
    if (supplier) {
      item.supplier = {
        ...item.supplier,
        name: supplier
      };
      await item.save();
    }

    // Record vehicle activity and create VehicleTrip so restock appears in Vehicle Trips Report
    if (vehicle && vehicle._id) {
      const StorageSite = require('../models/StorageSite');
      const storageSiteDoc = await StorageSite.findById(item.storageSite);

      try {
        if (storageSiteDoc) {
          await storageSiteDoc.recordVehicleActivity(
            'restock',
            { ...vehicle, type: vehicle.vehicleType || vehicle.type },
            item,
            {
              quantity,
              supplier: supplierNameForHistory,
              cost: parsedCost,
              notes
            },
            req.user._id
          );
          console.log(`✅ Vehicle activity recorded for storage site: ${storageSiteDoc.name}`);
        }
      } catch (storageSiteError) {
        console.error('Error recording vehicle activity in storage site:', storageSiteError);
        // Don't fail the restock if storage site update fails
      }

      // Always create VehicleTrip when vehicle is present so restock appears in Vehicle Trips Report
      try {
        const site = storageSiteDoc || { _id: item.storageSite, name: 'Storage Site', code: null };
        await createStorageInboundTrip({
          storageSite: { _id: site._id, name: site.name, code: site.code },
          item: { _id: item._id, itemName: item.itemName || item.materialName, category: item.category, unit: item.unit },
          vehicle: { _id: vehicle._id, vehicleNumber: vehicle.vehicleNumber, vehicleType: vehicle.vehicleType || vehicle.type, assignedTo: vehicle.assignedTo },
          quantity,
          user: req.user,
          supplierName: supplierNameForHistory,
          referenceId: item._id,
          referenceType: 'inventory'
        });
      } catch (tripError) {
        console.error('Error creating VehicleTrip for restock (report may not show this trip):', tripError);
      }
    }
    
    // Update vehicle trip tracking if vehicle is provided
    if (vehicle && vehicle._id) {
      try {
        const Vehicle = require('../models/Vehicle');
        const vehicleDoc = await Vehicle.findById(vehicle._id);
        
        if (vehicleDoc) {
          // Update trip tracking
          const today = new Date();
          const todayStr = today.toISOString().split('T')[0];
          const lastTripDate = vehicleDoc.tripTracking.lastTripDate;
          const lastTripDateStr = lastTripDate ? lastTripDate.toISOString().split('T')[0] : null;
          
          // If it's a new day, reset daily trips
          if (lastTripDateStr !== todayStr) {
            vehicleDoc.tripTracking.dailyTrips = 1;
          } else {
            vehicleDoc.tripTracking.dailyTrips += 1;
          }
          
          vehicleDoc.tripTracking.totalTrips += 1;
          vehicleDoc.tripTracking.lastTripDate = today;
          
          await vehicleDoc.save();
          
          console.log(`Vehicle ${vehicle.vehicleNumber} trip count updated for restock: Daily: ${vehicleDoc.tripTracking.dailyTrips}, Total: ${vehicleDoc.tripTracking.totalTrips}`);
        }
      } catch (vehicleError) {
        console.error('Error updating vehicle trip tracking for restock:', vehicleError);
        // Don't fail the restock if vehicle update fails
      }
    }
    
    // Create restock record (you might want to create a separate RestockRecord model)
    // For now, we'll just log it
    console.log(`Restock: ${item.itemName} - Added ${quantity} units (${previousStock} -> ${item.currentStock}) by ${req.user.email}`);
    
    res.json({
      success: true,
      message: `Successfully restocked ${quantity} ${item.unit} of ${item.itemName}`,
      data: {
        itemId: item._id,
        itemName: item.itemName,
        previousStock,
        addedQuantity: quantity,
        newStock: item.currentStock,
        unit: item.unit,
        restockedBy: req.user._id,
        restockedAt: item.lastRestocked,
        attachments
      }
    });
    
  } catch (error) {
    console.error('Restock inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restock inventory'
    });
  }
});

// Restock inventory item
router.post('/:id/restock', authenticateToken, requirePermission('inventory.update'), async (req, res) => {
  try {
    const { quantity, supplier, notes, vehicle } = req.body;
    const tpWeight = req.body.tpWeight;
    const parchiNo = req.body.parchiNo;
    
    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }
    
    const item = await Inventory.findById(req.params.id).populate('storageSite', 'name code');
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    const previousStock = item.currentStock;
    
    const parsedTpWeight = tpWeight !== undefined && tpWeight !== null && tpWeight !== '' ? Number(tpWeight) : null;
    if (parsedTpWeight !== null && (Number.isNaN(parsedTpWeight) || parsedTpWeight < 0)) {
      return res.status(400).json({
        success: false,
        message: 'T.p weight must be a valid non-negative number'
      });
    }
    const parsedParchiNo = parchiNo ? String(parchiNo).trim() : null;

    // Use the restock method
    await item.restock(quantity, supplier || item.supplier.name, req.user._id, notes, vehicle, req.body.cost, [], parsedTpWeight, parsedParchiNo);
    
    // Update vehicle trip tracking if vehicle is provided
    if (vehicle && vehicle._id) {
      try {
        const Vehicle = require('../models/Vehicle');
        const vehicleDoc = await Vehicle.findById(vehicle._id);
        
        if (vehicleDoc) {
          // Update trip tracking
          const today = new Date();
          const todayStr = today.toISOString().split('T')[0];
          const lastTripDate = vehicleDoc.tripTracking.lastTripDate;
          const lastTripDateStr = lastTripDate ? lastTripDate.toISOString().split('T')[0] : null;
          
          // If it's a new day, reset daily trips
          if (lastTripDateStr !== todayStr) {
            vehicleDoc.tripTracking.dailyTrips = 1;
          } else {
            vehicleDoc.tripTracking.dailyTrips += 1;
          }
          
          vehicleDoc.tripTracking.totalTrips += 1;
          vehicleDoc.tripTracking.lastTripDate = today;
          
          await vehicleDoc.save();
          
          console.log(`Vehicle ${vehicle.vehicleNumber} trip count updated for restock: Daily: ${vehicleDoc.tripTracking.dailyTrips}, Total: ${vehicleDoc.tripTracking.totalTrips}`);
        }
      } catch (vehicleError) {
        console.error('Error updating vehicle trip tracking for restock:', vehicleError);
        // Don't fail the restock if vehicle update fails
      }
      if (item.storageSite) {
        const st = item.storageSite;
        const storageSiteObj = st && st._id ? { _id: st._id, name: st.name || '', code: st.code } : null;
        if (storageSiteObj) {
          createStorageInboundTrip({
            storageSite: storageSiteObj,
            item: { _id: item._id, itemName: item.itemName || item.materialName, category: item.category, unit: item.unit },
            vehicle: { _id: vehicle._id, vehicleNumber: vehicle.vehicleNumber, vehicleType: vehicle.vehicleType || vehicle.type, assignedTo: vehicle.assignedTo },
            quantity,
            user: req.user,
            supplierName: supplier || (item.supplier && item.supplier.name) || 'Supplier',
            referenceId: item._id,
            referenceType: 'inventory'
          }).catch(function (err) { console.error('VehicleTrip restock error:', err); });
        }
      }
    }
    
    res.json({
      success: true,
      message: 'Inventory restocked successfully',
      data: {
        itemId: item._id,
        previousStock,
        newStock: item.currentStock,
        restockQuantity: quantity,
      }
    });
    
  } catch (error) {
    console.error('Restock inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restock inventory item'
    });
  }
});

// Delete a restock history entry and rollback stock (storage-site inventory)
router.delete('/:id/restock/:entryId', authenticateToken, requirePermission('inventory.update'), async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id).populate('storageSite', 'name code');

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    // Check access control for non-admin users
    if (req.user.role !== 'admin' && item.storageSite && !req.user.assignedStorageSites.includes(item.storageSite._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this inventory item'
      });
    }

    const restockEntry = item.restockHistory.id(req.params.entryId);
    if (!restockEntry) {
      return res.status(404).json({
        success: false,
        message: 'Restock entry not found'
      });
    }

    const quantityToRollback = Number(restockEntry.quantity || 0);
    const restockDate = restockEntry.restockedAt ? new Date(restockEntry.restockedAt) : null;
    const vehicleId = restockEntry.vehicle && restockEntry.vehicle._id ? restockEntry.vehicle._id : null;

    // Best-effort removal of corresponding VehicleTrip report row.
    let deletedVehicleTripId = null;
    if (vehicleId && item.storageSite && item.storageSite._id) {
      const tripQuery = {
        tripType: 'inbound',
        destinationType: 'storage_site',
        destinationId: item.storageSite._id,
        itemId: item._id,
        referenceType: 'inventory',
        'vehicle._id': vehicleId,
        quantity: quantityToRollback
      };

      if (restockDate) {
        const dayStart = new Date(restockDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(restockDate);
        dayEnd.setHours(23, 59, 59, 999);
        tripQuery.tripDate = { $gte: dayStart, $lte: dayEnd };
      }

      const tripDoc = await VehicleTrip.findOne(tripQuery).sort({ tripDate: -1 });
      if (tripDoc) {
        deletedVehicleTripId = tripDoc._id;
        await tripDoc.deleteOne();
      }

      // Roll back vehicle trip counters.
      const vehicleDoc = await Vehicle.findById(vehicleId);
      if (vehicleDoc && vehicleDoc.tripTracking) {
        vehicleDoc.tripTracking.totalTrips = Math.max(0, Number(vehicleDoc.tripTracking.totalTrips || 0) - 1);
        if (restockDate && isSameDay(vehicleDoc.tripTracking.lastTripDate, restockDate)) {
          vehicleDoc.tripTracking.dailyTrips = Math.max(0, Number(vehicleDoc.tripTracking.dailyTrips || 0) - 1);
        }
        await vehicleDoc.save();
      }
    }

    item.currentStock = Math.max(0, Number(item.currentStock || 0) - quantityToRollback);
    restockEntry.deleteOne();

    // Recompute lastRestocked so reports/date filters stay accurate.
    const remainingRestocks = Array.isArray(item.restockHistory) ? item.restockHistory : [];
    if (remainingRestocks.length > 0) {
      const last = remainingRestocks[remainingRestocks.length - 1];
      item.lastRestocked = last && last.restockedAt ? new Date(last.restockedAt) : null;
    } else {
      item.lastRestocked = null;
    }

    await item.save();

    return res.json({
      success: true,
      message: 'Restock entry deleted successfully',
      data: {
        itemId: item._id,
        deletedEntryId: req.params.entryId,
        deletedVehicleTripId,
        rolledBackQuantity: quantityToRollback,
        newStock: item.currentStock,
        lastRestocked: item.lastRestocked
      }
    });
  } catch (error) {
    console.error('Delete inventory restock entry error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete restock entry'
    });
  }
});

// Consume inventory (use stock)
router.post('/:id/consume', authenticateToken, requirePermission('inventory.update'), async (req, res) => {
  try {
    const { quantity, notes, siteId } = req.body;
    
    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }
    
    const item = await Inventory.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    if (quantity > item.currentStock) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock available',
        data: {
          requested: quantity,
          available: item.currentStock
        }
      });
    }
    
    const previousStock = item.currentStock;
    
    // Use the consume method
    await item.consumeStock(quantity, req.user._id, notes);
    
    res.json({
      success: true,
      message: 'Stock consumed successfully',
      data: {
        itemId: item._id,
        previousStock,
        newStock: item.currentStock,
        consumedQuantity: quantity,
        isLowStock: item.isLowStock
      }
    });
    
  } catch (error) {
    console.error('Consume inventory error:', error);
    
    if (error.message === 'Insufficient stock available') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to consume inventory'
    });
  }
});

// Get low stock items
router.get('/alerts/low-stock', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    const lowStockItems = await Inventory.find({
      isActive: true,
      $expr: { $lte: ['$currentStock', '$minimumStock'] }
    }).sort({ currentStock: 1 });
    
    res.json({
      success: true,
      data: {
        items: lowStockItems,
        count: lowStockItems.length
      }
    });
    
  } catch (error) {
    console.error('Get low stock items error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch low stock items'
    });
  }
});

// Get inventory categories
router.get('/meta/categories', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    // Return the valid categories from the model schema
    const validCategories = [
      'Building Materials',
      'Steel Products',
      'Safety Equipment',
      'Tools & Equipment',
      'Electrical Supplies',
      'Plumbing Supplies',
      'Finishing Materials',
      'Hardware',
      'Other'
    ];
    
    res.json({
      success: true,
      data: { categories: validCategories }
    });
    
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories'
    });
  }
});

// Get predefined item names
router.get('/meta/item-names', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    const predefinedItemNames = [
      'dust 1',
      'dust 2',
      '6mm',
      '10mm',
      '20mm',
      '40mm',
      'River sand',
      'Washing sand',
      'Crusher main',
      'bitumen',
      'ldo',
      'cement',
      'hysd 8mm',
      'hysd10mm',
      'hysd12mm',
      'hysd 16mm',
      'hysd 18mm',
      'hysd 20mm',
      'hysd 25mm',
      'hysd 32mm',
      'others'
    ];
    
    res.json({
      success: true,
      data: { itemNames: predefinedItemNames }
    });
    
  } catch (error) {
    console.error('Get item names error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch item names'
    });
  }
});

// Update inventory stock levels (specific route before general /:id)
router.put('/:id/stock', authenticateToken, requirePermission('inventory.update'), async (req, res) => {
  try {
    const { currentStock, minimumStock } = req.body;
    
    const item = await Inventory.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    if (currentStock !== undefined) {
      if (currentStock < 0) {
        return res.status(400).json({
          success: false,
          message: 'Current stock cannot be negative'
        });
      }
      item.currentStock = currentStock;
    }
    
    if (minimumStock !== undefined) {
      if (minimumStock < 0) {
        return res.status(400).json({
          success: false,
          message: 'Minimum stock cannot be negative'
        });
      }
      item.minimumStock = minimumStock;
    }
    
    await item.save();
    
    res.json({
      success: true,
      message: 'Stock levels updated successfully',
      data: {
        itemId: item._id,
        currentStock: item.currentStock,
        minimumStock: item.minimumStock,
        isLowStock: item.isLowStock
      }
    });
    
  } catch (error) {
    console.error('Update stock levels error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update stock levels'
    });
  }
});




// Update inventory supplier (specific route before general /:id)
router.put('/:id/supplier', authenticateToken, requirePermission('inventory.update'), async (req, res) => {
  try {
    const { supplier } = req.body;
    
    if (!supplier || !supplier.name) {
      return res.status(400).json({
        success: false,
        message: 'Supplier name is required'
      });
    }
    
    const item = await Inventory.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    item.supplier = supplier;
    await item.save();
    
    res.json({
      success: true,
      message: 'Supplier updated successfully',
      data: {
        itemId: item._id,
        supplier: item.supplier
      }
    });
    
  } catch (error) {
    console.error('Update supplier error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update supplier'
    });
  }
});

// Update inventory item (general route - must come after specific routes)
router.put('/:id', authenticateToken, requirePermission('inventory.update'), async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    // Update item fields
    Object.assign(item, req.body);
    await item.save();
    
    res.json({
      success: true,
      message: 'Inventory item updated successfully',
      data: { item }
    });
    
  } catch (error) {
    console.error('Update inventory item error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Item code already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update inventory item'
    });
  }
});

// Delete inventory item (soft delete)
router.delete('/:id', authenticateToken, requirePermission('inventory.delete'), async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    item.isActive = false;
    await item.save();
    
    res.json({
      success: true,
      message: 'Inventory item deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete inventory item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete inventory item'
    });
  }
});

module.exports = router;