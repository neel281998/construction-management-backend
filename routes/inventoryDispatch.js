const express = require('express');
const Inventory = require('../models/Inventory');
const InventoryDispatch = require('../models/InventoryDispatch');
const StorageSite = require('../models/StorageSite');
const Vehicle = require('../models/Vehicle');
const Site = require('../models/Site');
const { authenticateToken, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Dispatch inventory
router.post('/dispatch', authenticateToken, requirePermission('inventory.update'), async (req, res) => {
  try {
    const { 
      itemId, 
      quantity, 
      destinationType, 
      destinationId, 
      vehicleId, 
      expectedDeliveryAt, 
      notes = '' 
    } = req.body;
    
    if (!itemId || !quantity || !destinationType || !destinationId || !vehicleId) {
      return res.status(400).json({
        success: false,
        message: 'Item ID, quantity, destination type, destination ID, and vehicle ID are required'
      });
    }
    
    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Dispatch quantity must be positive'
      });
    }
    
    // Get the source inventory item
    const sourceItem = await Inventory.findById(itemId)
      .populate('storageSite', 'name code');
    
    if (!sourceItem) {
      return res.status(404).json({
        success: false,
        message: 'Source inventory item not found'
      });
    }
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedStorageSites.includes(sourceItem.storageSite._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to source storage site'
      });
    }
    
    // Check if sufficient stock is available
    if (quantity > sourceItem.currentStock) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock available for dispatch',
        data: {
          requested: quantity,
          available: sourceItem.currentStock
        }
      });
    }
    
    // Get destination details
    let destinationName = '';
    let destinationDetails = {};
    
    if (destinationType === 'construction_site') {
      const site = await Site.findById(destinationId);
      if (!site) {
        return res.status(404).json({
          success: false,
          message: 'Construction site not found'
        });
      }
      destinationName = site.name;
      destinationDetails = { siteType: site.siteType };
    } else if (destinationType === 'storage_site') {
      const storageSite = await StorageSite.findById(destinationId);
      if (!storageSite) {
        return res.status(404).json({
          success: false,
          message: 'Storage site not found'
        });
      }
      destinationName = storageSite.name;
    } else if (destinationType === 'construction_step') {
      // For construction steps, we'll need to get the step details
      // This would require additional logic to fetch step information
      destinationName = `Construction Step ${destinationId}`;
    }
    
    // Get vehicle details
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }
    
    // Create dispatch record
    const dispatch = new InventoryDispatch({
      itemId,
      itemName: sourceItem.itemName,
      category: sourceItem.category,
      unit: sourceItem.unit,
      quantity,
      fromStorageSite: {
        _id: sourceItem.storageSite._id,
        name: sourceItem.storageSite.name,
        code: sourceItem.storageSite.code
      },
      destination: {
        type: destinationType,
        id: destinationId,
        name: destinationName,
        details: destinationDetails
      },
      vehicle: {
        _id: vehicle._id,
        vehicleNumber: vehicle.vehicleNumber,
        vehicleType: vehicle.vehicleType,
        driverName: vehicle.driverName,
        driverPhone: vehicle.driverPhone
      },
      dispatchedBy: {
        _id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email
      },
      status: 'dispatched',
      expectedDeliveryAt: expectedDeliveryAt ? new Date(expectedDeliveryAt) : undefined,
      notes
    });
    
    await dispatch.save();
    
    // Reduce stock from source inventory
    sourceItem.currentStock -= quantity;
    
    // Add to transfer history
    sourceItem.transferHistory.push({
      fromStorageSite: sourceItem.storageSite._id,
      toStorageSite: destinationType === 'storage_site' ? destinationId : null,
      quantity,
      transferredBy: req.user._id,
      notes: `Dispatched to ${destinationName}: ${notes}`,
      dispatchId: dispatch._id
    });
    
    await sourceItem.save();
    
    res.json({
      success: true,
      message: 'Inventory dispatched successfully',
      data: {
        dispatch: {
          id: dispatch._id,
          itemName: dispatch.itemName,
          quantity: dispatch.quantity,
          destination: dispatch.destination.name,
          vehicle: dispatch.vehicle.vehicleNumber,
          status: dispatch.status
        },
        sourceItem: {
          id: sourceItem._id,
          itemName: sourceItem.itemName,
          remainingStock: sourceItem.currentStock,
          storageSite: sourceItem.storageSite.name
        }
      }
    });
    
  } catch (error) {
    console.error('Dispatch inventory error:', error);
    
    if (error.message === 'Insufficient stock available for dispatch') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to dispatch inventory'
    });
  }
});

// Receive inventory
router.post('/receive', authenticateToken, requirePermission('inventory.update'), async (req, res) => {
  try {
    const { 
      dispatchId, 
      receivedQuantity, 
      deliveryImages = [], 
      notes = '' 
    } = req.body;
    
    if (!dispatchId || !receivedQuantity) {
      return res.status(400).json({
        success: false,
        message: 'Dispatch ID and received quantity are required'
      });
    }
    
    const receivedQty = parseFloat(receivedQuantity);
    if (receivedQty <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Received quantity must be positive'
      });
    }
    
    // Get the dispatch record
    const dispatch = await InventoryDispatch.findById(dispatchId)
      .populate('itemId', 'itemName category unit storageSite');
    
    if (!dispatch) {
      return res.status(404).json({
        success: false,
        message: 'Dispatch record not found'
      });
    }
    
    if (dispatch.status === 'received') {
      return res.status(400).json({
        success: false,
        message: 'This dispatch has already been received'
      });
    }
    
    if (receivedQty > dispatch.quantity) {
      return res.status(400).json({
        success: false,
        message: 'Received quantity cannot exceed dispatched quantity'
      });
    }
    
    // Update dispatch record
    dispatch.status = 'received';
    dispatch.receivedBy = {
      _id: req.user._id,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      email: req.user.email
    };
    dispatch.receivedAt = new Date();
    dispatch.deliveryImages = deliveryImages.map(fileId => ({
      fileId,
      uploadedBy: req.user._id,
      uploadedAt: new Date()
    }));
    dispatch.notes = notes;
    
    await dispatch.save();
    
    // If destination is a storage site, add inventory there
    if (dispatch.destination.type === 'storage_site') {
      const destinationStorageSite = await StorageSite.findById(dispatch.destination.id);
      
      if (destinationStorageSite) {
        // Check if destination already has this item
        let destinationItem = await Inventory.findOne({
          itemName: dispatch.itemName,
          storageSite: dispatch.destination.id,
          isActive: true
        });
        
        if (destinationItem) {
          // Update existing item at destination
          destinationItem.currentStock += receivedQty;
          
          // Add to transfer history
          destinationItem.transferHistory.push({
            fromStorageSite: dispatch.fromStorageSite._id,
            toStorageSite: dispatch.destination.id,
            quantity: receivedQty,
            transferredBy: req.user._id,
            notes: `Received from dispatch: ${notes}`,
            dispatchId: dispatch._id
          });
          
          await destinationItem.save();
        } else {
          // Create new item at destination
          destinationItem = new Inventory({
            itemName: dispatch.itemName,
            category: dispatch.category,
            unit: dispatch.unit,
            currentStock: receivedQty,
            minimumStock: 0, // Default minimum stock
            maximumStock: 1000, // Default maximum stock
            storageSite: dispatch.destination.id,
            transferHistory: [{
              fromStorageSite: dispatch.fromStorageSite._id,
              toStorageSite: dispatch.destination.id,
              quantity: receivedQty,
              transferredBy: req.user._id,
              notes: `Received from dispatch: ${notes}`,
              dispatchId: dispatch._id
            }]
          });
          
          await destinationItem.save();
        }
      }
    }
    
    res.json({
      success: true,
      message: 'Inventory received successfully',
      data: {
        dispatch: {
          id: dispatch._id,
          itemName: dispatch.itemName,
          receivedQuantity: receivedQty,
          destination: dispatch.destination.name,
          status: dispatch.status
        }
      }
    });
    
  } catch (error) {
    console.error('Receive inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to receive inventory'
    });
  }
});

// Get dispatch history for a storage site
router.get('/storage-site/:storageSiteId', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const storageSite = await StorageSite.findById(req.params.storageSiteId);
    
    if (!storageSite) {
      return res.status(404).json({
        success: false,
        message: 'Storage site not found'
      });
    }
    
    // Check access control
    if (req.user.role !== 'admin' && !req.user.assignedStorageSites.includes(storageSite._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this storage site'
      });
    }
    
    // Build query
    let query = { 'fromStorageSite._id': storageSite._id };
    if (status) {
      query.status = status;
    }
    
    const dispatches = await InventoryDispatch.find(query)
      .sort({ dispatchedAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('dispatchedBy', 'firstName lastName email')
      .populate('receivedBy', 'firstName lastName email');
    
    const totalCount = await InventoryDispatch.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        storageSite: {
          _id: storageSite._id,
          name: storageSite.name,
          code: storageSite.code
        },
        dispatches,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: parseInt(page) * parseInt(limit) < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });
    
  } catch (error) {
    console.error('Get dispatch history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dispatch history'
    });
  }
});

// Get pending dispatches for a destination
router.get('/pending/:destinationType/:destinationId', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    const { destinationType, destinationId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const query = {
      'destination.type': destinationType,
      'destination.id': destinationId,
      status: { $in: ['dispatched', 'in_transit', 'delivered'] }
    };
    
    const dispatches = await InventoryDispatch.find(query)
      .sort({ dispatchedAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('dispatchedBy', 'firstName lastName email')
      .populate('fromStorageSite', 'name code');
    
    const totalCount = await InventoryDispatch.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        destination: {
          type: destinationType,
          id: destinationId
        },
        dispatches,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: parseInt(page) * parseInt(limit) < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });
    
  } catch (error) {
    console.error('Get pending dispatches error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending dispatches'
    });
  }
});

module.exports = router;


