const express = require('express');
const Inventory = require('../models/Inventory');
const InventoryTransfer = require('../models/InventoryTransfer');
const InventoryTransferReceipt = require('../models/InventoryTransferReceipt');
const Vehicle = require('../models/Vehicle');
const StorageSite = require('../models/StorageSite');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const AlertService = require('../utils/alertService');

const router = express.Router();

// Get specific transfer by ID (must be before other routes to avoid conflicts)
router.get('/:transferId', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    const { transferId } = req.params;
    
    const transfer = await InventoryTransfer.findById(transferId)
      .populate('transferredBy', 'firstName lastName email')
      .populate('receivedBy', 'firstName lastName email');
    
    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: 'Transfer not found'
      });
    }
    
    // Check access control
    if (req.user.role !== 'admin') {
      const assignedSites = req.user.assignedStorageSites || [];
      const hasAccess = assignedSites.includes(transfer.fromStorageSite._id) || 
                       assignedSites.includes(transfer.toStorageSite._id);
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this transfer'
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        transfer
      }
    });
    
  } catch (error) {
    console.error('Get transfer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transfer details'
    });
  }
});

// Create transfer (Phase 1: Source manager initiates)
router.post('/transfer', authenticateToken, requirePermission('inventory.update'), async (req, res) => {
  try {
    const { 
      itemId, 
      quantity, 
      toStorageSiteId, 
      toPlantId,
      toConstructionSiteId,
      vehicleId, 
      transferImages = [], 
      notes = '',
      expectedDeliveryAt 
    } = req.body;
    
    if (!itemId || !quantity || !vehicleId) {
      return res.status(400).json({
        success: false,
        message: 'Item ID, quantity, and vehicle ID are required'
      });
    }
    
    if (!toStorageSiteId && !toPlantId && !toConstructionSiteId) {
      return res.status(400).json({
        success: false,
        message: 'At least one destination (storage site, plant, or construction site) is required'
      });
    }
    
    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Transfer quantity must be positive'
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
        message: 'Insufficient stock available for transfer',
        data: {
          requested: quantity,
          available: sourceItem.currentStock
        }
      });
    }
    
    // Get destination (storage site, plant, or construction site)
    let destinationStorageSite = null;
    let destinationPlant = null;
    let destinationConstructionSite = null;
    
    if (toStorageSiteId) {
      destinationStorageSite = await StorageSite.findById(toStorageSiteId);
      if (!destinationStorageSite) {
        return res.status(404).json({
          success: false,
          message: 'Destination storage site not found'
        });
      }
    }
    
    if (toPlantId) {
      const Plant = require('../models/Plant');
      destinationPlant = await Plant.findById(toPlantId);
      if (!destinationPlant) {
        return res.status(404).json({
          success: false,
          message: 'Destination plant not found'
        });
      }
    }
    
    if (toConstructionSiteId) {
      const Site = require('../models/Site');
      destinationConstructionSite = await Site.findById(toConstructionSiteId);
      if (!destinationConstructionSite) {
        return res.status(404).json({
          success: false,
          message: 'Destination construction site not found'
        });
      }
    }
    
    // Get vehicle details
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }
    
    // Check if vehicle is available
    if (vehicle.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: 'Vehicle is not available for transfer'
      });
    }
    
    // Calculate trip number for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let tripNumber = 1;
    if (vehicle.tripTracking.lastTripDate && 
        vehicle.tripTracking.lastTripDate.toDateString() === today.toDateString()) {
      tripNumber = vehicle.tripTracking.dailyTrips + 1;
    }
    
    // Create transfer record
    const transfer = new InventoryTransfer({
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
      toStorageSite: destinationStorageSite ? {
        _id: destinationStorageSite._id,
        name: destinationStorageSite.name,
        code: destinationStorageSite.code
      } : null,
      toPlant: destinationPlant ? {
        _id: destinationPlant._id,
        name: destinationPlant.name,
        code: destinationPlant.code,
        plantType: destinationPlant.plantType
      } : null,
      toConstructionSite: destinationConstructionSite ? {
        _id: destinationConstructionSite._id,
        name: destinationConstructionSite.name,
        code: destinationConstructionSite.code,
        siteType: destinationConstructionSite.siteType
      } : null,
      vehicle: {
        _id: vehicle._id,
        vehicleNumber: vehicle.vehicleNumber,
        vehicleType: vehicle.type,
        driverName: vehicle.assignedTo ? 'Assigned Driver' : undefined,
        driverPhone: undefined
      },
      transferredBy: {
        _id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email
      },
      status: 'in_transit',
      transferImages: transferImages.map(fileId => ({
        fileId,
        uploadedBy: req.user._id,
        uploadedAt: new Date()
      })),
      notes,
      expectedDeliveryAt: expectedDeliveryAt ? new Date(expectedDeliveryAt) : undefined,
      tripDate: today,
      tripNumber
    });
    
    await transfer.save();
    
    // Update vehicle status and trip tracking
    vehicle.status = 'busy';
    vehicle.tripTracking.currentTrip = transfer._id;
    
    if (vehicle.tripTracking.lastTripDate && 
        vehicle.tripTracking.lastTripDate.toDateString() === today.toDateString()) {
      vehicle.tripTracking.dailyTrips += 1;
    } else {
      vehicle.tripTracking.dailyTrips = 1;
      vehicle.tripTracking.lastTripDate = today;
    }
    
    vehicle.tripTracking.totalTrips += 1;
    await vehicle.save();
    
    // Reduce stock from source inventory (but don't add to destination yet)
    sourceItem.currentStock -= quantity;
    
    // Add to transfer history
    sourceItem.transferHistory.push({
      fromStorageSite: sourceItem.storageSite._id,
      toStorageSite: destinationStorageSite._id,
      quantity,
      transferredBy: req.user._id,
      notes: `Transferred to ${destinationStorageSite.name}: ${notes}`,
      transferId: transfer._id,
      status: 'in_transit'
    });
    
    await sourceItem.save();
    
    res.json({
      success: true,
      message: 'Inventory transfer initiated successfully',
      data: {
        transfer: {
          id: transfer._id,
          itemName: transfer.itemName,
          quantity: transfer.quantity,
          fromStorageSite: transfer.fromStorageSite.name,
          toStorageSite: transfer.toStorageSite.name,
          vehicle: transfer.vehicle.vehicleNumber,
          status: transfer.status,
          tripNumber: transfer.tripNumber
        },
        sourceItem: {
          id: sourceItem._id,
          itemName: sourceItem.itemName,
          remainingStock: sourceItem.currentStock,
          storageSite: sourceItem.storageSite.name
        },
        vehicle: {
          id: vehicle._id,
          vehicleNumber: vehicle.vehicleNumber,
          status: vehicle.status,
          dailyTrips: vehicle.tripTracking.dailyTrips,
          totalTrips: vehicle.tripTracking.totalTrips
        }
      }
    });
    
  } catch (error) {
    console.error('Transfer inventory error:', error);
    
    if (error.message === 'Insufficient stock available for transfer') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to initiate inventory transfer'
    });
  }
});

// Receive transfer (Phase 2: Destination manager confirms)
router.post('/receive', authenticateToken, requirePermission('inventory.update'), async (req, res) => {
  try {
    const { 
      transferId, 
      receivedQuantity, 
      receiptImages = [], 
      notes = '' 
    } = req.body;
    
    if (!transferId || !receivedQuantity) {
      return res.status(400).json({
        success: false,
        message: 'Transfer ID and received quantity are required'
      });
    }
    
    const receivedQty = parseFloat(receivedQuantity);
    if (receivedQty <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Received quantity must be positive'
      });
    }
    
    // Get the transfer record
    const transfer = await InventoryTransfer.findById(transferId)
      .populate('itemId', 'itemName category unit storageSite');
    
    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: 'Transfer record not found'
      });
    }
    
    if (transfer.status === 'received') {
      return res.status(400).json({
        success: false,
        message: 'This transfer has already been received'
      });
    }
    
    if (transfer.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot receive a cancelled transfer'
      });
    }
    
    // Check access control for destination storage site
    if (req.user.role !== 'admin' && !req.user.assignedStorageSites.includes(transfer.toStorageSite._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to destination storage site'
      });
    }
    
    // Calculate quantity difference and discrepancy
    const quantityDifference = receivedQty - transfer.quantity;
    const discrepancyPercentage = Math.abs((quantityDifference / transfer.quantity) * 100);
    const hasDiscrepancy = discrepancyPercentage > 5; // 5% tolerance
    
    // Create receipt record
    const receipt = new InventoryTransferReceipt({
      transferId: transfer._id,
      receivedQuantity: receivedQty,
      quantityDifference,
      discrepancyPercentage,
      receivedBy: {
        _id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email
      },
      receiptImages: receiptImages.map(fileId => ({
        fileId,
        uploadedBy: req.user._id,
        uploadedAt: new Date()
      })),
      notes,
      hasDiscrepancy,
      discrepancyReason: hasDiscrepancy ? `Quantity difference: ${quantityDifference} (${discrepancyPercentage.toFixed(2)}%)` : undefined
    });
    
    await receipt.save();
    
    // Update transfer record
    transfer.status = 'received';
    transfer.receivedBy = {
      _id: req.user._id,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      email: req.user.email
    };
    transfer.receivedAt = new Date();
    await transfer.save();
    
    // Add inventory to destination storage site
    const destinationStorageSite = await StorageSite.findById(transfer.toStorageSite._id);
    
    if (destinationStorageSite) {
      // Check if destination already has this item
      let destinationItem = await Inventory.findOne({
        itemName: transfer.itemName,
        storageSite: transfer.toStorageSite._id,
        isActive: true
      });
      
      if (destinationItem) {
        // Update existing item at destination
        destinationItem.currentStock += receivedQty;
        
        // Add to transfer history
        destinationItem.transferHistory.push({
          fromStorageSite: transfer.fromStorageSite._id,
          toStorageSite: transfer.toStorageSite._id,
          quantity: receivedQty,
          transferredBy: req.user._id,
          notes: `Received from transfer: ${notes}`,
          transferId: transfer._id,
          status: 'received'
        });
        
        await destinationItem.save();
      } else {
        // Create new item at destination
        destinationItem = new Inventory({
          itemName: transfer.itemName,
          category: transfer.category,
          unit: transfer.unit,
          currentStock: receivedQty,
          minimumStock: 0,
          maximumStock: receivedQty * 2, // Set reasonable default
          storageSite: transfer.toStorageSite._id,
          supplier: null,
          lastRestocked: new Date(),
          transferHistory: [{
            fromStorageSite: transfer.fromStorageSite._id,
            toStorageSite: transfer.toStorageSite._id,
            quantity: receivedQty,
            transferredBy: req.user._id,
            notes: `Received from transfer: ${notes}`,
            transferId: transfer._id,
            status: 'received'
          }],
          isActive: true
        });
        
        await destinationItem.save();
      }
    }
    
    // Update vehicle status back to available
    const vehicle = await Vehicle.findById(transfer.vehicle._id);
    if (vehicle) {
      vehicle.status = 'available';
      vehicle.tripTracking.currentTrip = null;
      await vehicle.save();
    }
    
    // Send alerts if there's a discrepancy
    if (hasDiscrepancy) {
      try {
        await AlertService.createQuantityDiscrepancyAlert({
          transferId: transfer._id,
          itemName: transfer.itemName,
          expectedQuantity: transfer.quantity,
          receivedQuantity: receivedQty,
          quantityDifference,
          discrepancyPercentage,
          fromStorageSite: transfer.fromStorageSite,
          toStorageSite: transfer.toStorageSite,
          transferredBy: transfer.transferredBy,
          receivedBy: receipt.receivedBy
        });
      } catch (alertError) {
        console.error('Error creating discrepancy alert:', alertError);
        // Don't fail the receipt process if alert creation fails
      }
    }

    // Create transfer completion alert
    try {
      await AlertService.createTransferCompletionAlert({
        transferId: transfer._id,
        itemName: transfer.itemName,
        quantity: receivedQty,
        fromStorageSite: transfer.fromStorageSite,
        toStorageSite: transfer.toStorageSite,
        transferredBy: transfer.transferredBy,
        receivedBy: receipt.receivedBy,
        vehicle: transfer.vehicle
      });
    } catch (alertError) {
      console.error('Error creating completion alert:', alertError);
    }

    // Create vehicle trip alert
    try {
      await AlertService.createVehicleTripAlert({
        vehicleId: vehicle._id,
        vehicleNumber: vehicle.vehicleNumber,
        dailyTrips: vehicle.tripTracking.dailyTrips,
        totalTrips: vehicle.tripTracking.totalTrips,
        tripDate: transfer.tripDate
      }, {
        transferId: transfer._id,
        itemName: transfer.itemName,
        quantity: receivedQty,
        fromStorageSite: transfer.fromStorageSite,
        toStorageSite: transfer.toStorageSite,
        receivedBy: receipt.receivedBy
      });
    } catch (alertError) {
      console.error('Error creating vehicle trip alert:', alertError);
    }
    
    res.json({
      success: true,
      message: 'Transfer received successfully',
      data: {
        transfer: {
          id: transfer._id,
          itemName: transfer.itemName,
          expectedQuantity: transfer.quantity,
          receivedQuantity: receivedQty,
          quantityDifference,
          discrepancyPercentage,
          hasDiscrepancy,
          status: transfer.status
        },
        receipt: {
          id: receipt._id,
          receivedAt: receipt.receivedAt,
          receivedBy: receipt.receivedBy
        },
        vehicle: vehicle ? {
          id: vehicle._id,
          vehicleNumber: vehicle.vehicleNumber,
          status: vehicle.status
        } : null
      }
    });
    
  } catch (error) {
    console.error('Receive transfer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to receive transfer'
    });
  }
});

// Get pending transfers for a storage site
router.get('/pending/:storageSiteId', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    const { storageSiteId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    // Check access control
    if (req.user.role !== 'admin' && !req.user.assignedStorageSites.includes(storageSiteId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this storage site'
      });
    }
    
    const transfers = await InventoryTransfer.find({
      'toStorageSite._id': storageSiteId,
      status: 'in_transit'
    })
      .sort({ transferredAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('transferredBy', 'firstName lastName email')
      .populate('fromStorageSite', 'name code');
    
    const totalCount = await InventoryTransfer.countDocuments({
      'toStorageSite._id': storageSiteId,
      status: 'in_transit'
    });
    
    res.json({
      success: true,
      data: {
        storageSite: {
          id: storageSiteId
        },
        transfers,
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
    console.error('Get pending transfers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending transfers'
    });
  }
});

// Get transfer history
router.get('/history', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    
    let query = {};
    
    // Apply access control for non-admin users
    if (req.user.role !== 'admin') {
      const assignedSites = req.user.assignedStorageSites || [];
      if (assignedSites.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'No storage sites assigned to user'
        });
      }
      query.$or = [
        { 'fromStorageSite._id': { $in: assignedSites } },
        { 'toStorageSite._id': { $in: assignedSites } }
      ];
    }
    
    // Filter by status if provided
    if (status) {
      query.status = status;
    }
    
    const transfers = await InventoryTransfer.find(query)
      .sort({ transferredAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('transferredBy', 'firstName lastName email')
      .populate('receivedBy', 'firstName lastName email');
    
    const totalCount = await InventoryTransfer.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        transfers,
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
    console.error('Get transfer history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transfer history'
    });
  }
});

// Get vehicle trip statistics
router.get('/vehicle-trips/:vehicleId', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { startDate, endDate } = req.query;
    
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }
    
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        tripDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    }
    
    const transfers = await InventoryTransfer.find({
      'vehicle._id': vehicleId,
      ...dateFilter
    })
      .sort({ tripDate: -1, tripNumber: -1 })
      .populate('transferredBy', 'firstName lastName')
      .populate('receivedBy', 'firstName lastName');
    
    const tripStats = {
      vehicle: {
        id: vehicle._id,
        vehicleNumber: vehicle.vehicleNumber,
        vehicleType: vehicle.type,
        status: vehicle.status
      },
      tripTracking: vehicle.tripTracking,
      transfers,
      summary: {
        totalTransfers: transfers.length,
        completedTransfers: transfers.filter(t => t.status === 'received').length,
        pendingTransfers: transfers.filter(t => t.status === 'in_transit').length,
        totalQuantityTransferred: transfers.reduce((sum, t) => sum + t.quantity, 0)
      }
    };
    
    res.json({
      success: true,
      data: tripStats
    });
    
  } catch (error) {
    console.error('Get vehicle trips error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicle trip statistics'
    });
  }
});

module.exports = router;