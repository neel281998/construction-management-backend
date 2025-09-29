const express = require('express');
const router = express.Router();
const FuelTransfer = require('../models/FuelTransfer');
const FuelStorage = require('../models/FuelStorage');
const { authenticateToken, requirePermission } = require('../middleware/auth');

// Get all fuel transfers
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      fromStorageId, 
      toStorageId, 
      vehicleId, 
      status, 
      transferType, 
      startDate, 
      endDate,
      page = 1,
      limit = 20
    } = req.query;

    const filter = {};
    if (fromStorageId) filter.fromStorageId = fromStorageId;
    if (toStorageId) filter.toStorageId = toStorageId;
    if (vehicleId) filter.vehicleId = vehicleId;
    if (status) filter.status = status;
    if (transferType) filter.transferType = transferType;
    
    if (startDate || endDate) {
      filter.transferDate = {};
      if (startDate) filter.transferDate.$gte = new Date(startDate);
      if (endDate) filter.transferDate.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    
    const transfers = await FuelTransfer.find(filter)
      .populate('fromStorageId', 'name location')
      .populate('toStorageId', 'name location')
      .populate('vehicleId', 'vehicleNumber make model')
      .populate('transferredBy', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName email')
      .sort({ transferDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await FuelTransfer.countDocuments(filter);

    res.json({
      success: true,
      data: transfers,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching fuel transfers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fuel transfers',
      error: error.message
    });
  }
});

// Get single fuel transfer
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const transfer = await FuelTransfer.findById(req.params.id)
      .populate('fromStorageId', 'name location fuelType')
      .populate('toStorageId', 'name location fuelType')
      .populate('vehicleId', 'vehicleNumber make model')
      .populate('transferredBy', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName email');

    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: 'Fuel transfer not found'
      });
    }

    res.json({
      success: true,
      data: transfer
    });
  } catch (error) {
    console.error('Error fetching fuel transfer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fuel transfer',
      error: error.message
    });
  }
});

// Create new fuel transfer
router.post('/', authenticateToken, requirePermission('fuel.transfer'), async (req, res) => {
  try {
    const {
      fromStorageId,
      toStorageId,
      vehicleId,
      fuelType,
      quantityLiters,
      transferType,
      odometerReading,
      notes,
      costPerLiter
    } = req.body;

    // Validate required fields
    if (!quantityLiters || quantityLiters <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }

    if (transferType === 'storage_to_storage' && (!fromStorageId || !toStorageId)) {
      return res.status(400).json({
        success: false,
        message: 'Both source and destination storages are required'
      });
    }

    if (transferType === 'storage_to_vehicle' && (!fromStorageId || !vehicleId)) {
      return res.status(400).json({
        success: false,
        message: 'Source storage and vehicle are required'
      });
    }

    // Check source storage capacity
    if (fromStorageId) {
      const sourceStorage = await FuelStorage.findById(fromStorageId);
      if (!sourceStorage) {
        return res.status(404).json({
          success: false,
          message: 'Source storage not found'
        });
      }

      if (sourceStorage.currentReading < quantityLiters) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient fuel in source storage'
        });
      }

      if (sourceStorage.fuelType !== fuelType) {
        return res.status(400).json({
          success: false,
          message: 'Fuel type mismatch with source storage'
        });
      }
    }

    // Check destination capacity
    if (toStorageId) {
      const destStorage = await FuelStorage.findById(toStorageId);
      if (!destStorage) {
        return res.status(404).json({
          success: false,
          message: 'Destination storage not found'
        });
      }

      if (destStorage.currentReading + quantityLiters > destStorage.capacityLiters) {
        return res.status(400).json({
          success: false,
          message: 'Transfer quantity exceeds destination storage capacity'
        });
      }

      if (destStorage.fuelType !== fuelType) {
        return res.status(400).json({
          success: false,
          message: 'Fuel type mismatch with destination storage'
        });
      }
    }

    // Create transfer
    const transfer = new FuelTransfer({
      fromStorageId,
      toStorageId,
      vehicleId,
      fuelType,
      quantityLiters,
      transferType,
      odometerReading,
      notes,
      costPerLiter,
      transferredBy: req.user._id,
      status: 'pending'
    });

    await transfer.save();

    // Populate the transfer
    await transfer.populate([
      { path: 'fromStorageId', select: 'name location fuelType' },
      { path: 'toStorageId', select: 'name location fuelType' },
      { path: 'vehicleId', select: 'vehicleNumber make model' },
      { path: 'transferredBy', select: 'firstName lastName email' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Fuel transfer created successfully',
      data: transfer
    });
  } catch (error) {
    console.error('Error creating fuel transfer:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to create fuel transfer',
      error: error.message
    });
  }
});

// Execute fuel transfer
router.post('/:id/execute', authenticateToken, requirePermission('fuel.transfer'), async (req, res) => {
  try {
    const transfer = await FuelTransfer.findById(req.params.id);
    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: 'Fuel transfer not found'
      });
    }

    if (transfer.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Transfer is not in pending status'
      });
    }

    // Update source storage
    if (transfer.fromStorageId) {
      const sourceStorage = await FuelStorage.findById(transfer.fromStorageId);
      sourceStorage.currentReading -= transfer.quantityLiters;
      sourceStorage.lastUpdatedBy = req.user._id;
      await sourceStorage.save();
    }

    // Update destination storage
    if (transfer.toStorageId) {
      const destStorage = await FuelStorage.findById(transfer.toStorageId);
      destStorage.currentReading += transfer.quantityLiters;
      destStorage.lastUpdatedBy = req.user._id;
      await destStorage.save();
    }

    // Update transfer status
    transfer.status = 'completed';
    transfer.approvedBy = req.user._id;
    await transfer.save();

    // Create fuel log for vehicle refueling
    if (transfer.vehicleId && transfer.transferType === 'storage_to_vehicle') {
      const FuelLog = require('../models/FuelLog');
      const fuelLog = new FuelLog({
        vehicleId: transfer.vehicleId,
        storageId: transfer.fromStorageId,
        fuelType: transfer.fuelType,
        quantityLiters: transfer.quantityLiters,
        odometerReading: transfer.odometerReading,
        filledBy: req.user._id,
        costPerLiter: transfer.costPerLiter,
        totalCost: transfer.totalCost,
        notes: transfer.notes
      });
      await fuelLog.save();
    }

    await transfer.populate([
      { path: 'fromStorageId', select: 'name location fuelType currentReading' },
      { path: 'toStorageId', select: 'name location fuelType currentReading' },
      { path: 'vehicleId', select: 'vehicleNumber make model' },
      { path: 'transferredBy', select: 'firstName lastName email' },
      { path: 'approvedBy', select: 'firstName lastName email' }
    ]);

    res.json({
      success: true,
      message: 'Fuel transfer executed successfully',
      data: transfer
    });
  } catch (error) {
    console.error('Error executing fuel transfer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute fuel transfer',
      error: error.message
    });
  }
});

// Cancel fuel transfer
router.post('/:id/cancel', authenticateToken, requirePermission('fuel.transfer'), async (req, res) => {
  try {
    const transfer = await FuelTransfer.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'cancelled',
        approvedBy: req.user._id
      },
      { new: true }
    );

    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: 'Fuel transfer not found'
      });
    }

    res.json({
      success: true,
      message: 'Fuel transfer cancelled successfully',
      data: transfer
    });
  } catch (error) {
    console.error('Error cancelling fuel transfer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel fuel transfer',
      error: error.message
    });
  }
});

// Get transfer statistics
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const filter = {};
    if (startDate || endDate) {
      filter.transferDate = {};
      if (startDate) filter.transferDate.$gte = new Date(startDate);
      if (endDate) filter.transferDate.$lte = new Date(endDate);
    }

    const [
      totalTransfers,
      completedTransfers,
      pendingTransfers,
      totalVolumeTransferred,
      transfersByType
    ] = await Promise.all([
      FuelTransfer.countDocuments(filter),
      FuelTransfer.countDocuments({ ...filter, status: 'completed' }),
      FuelTransfer.countDocuments({ ...filter, status: 'pending' }),
      FuelTransfer.aggregate([
        { $match: { ...filter, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$quantityLiters' } } }
      ]),
      FuelTransfer.aggregate([
        { $match: { ...filter, status: 'completed' } },
        { $group: { _id: '$transferType', count: { $sum: 1 }, volume: { $sum: '$quantityLiters' } } }
      ])
    ]);

    const stats = {
      totalTransfers,
      completedTransfers,
      pendingTransfers,
      totalVolumeTransferred: totalVolumeTransferred[0]?.total || 0,
      transfersByType: transfersByType.reduce((acc, item) => {
        acc[item._id] = { count: item.count, volume: item.volume };
        return acc;
      }, {})
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching transfer statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transfer statistics',
      error: error.message
    });
  }
});

module.exports = router;
