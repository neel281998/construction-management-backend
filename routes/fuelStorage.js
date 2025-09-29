const express = require('express');
const router = express.Router();
const FuelStorage = require('../models/FuelStorage');
const { authenticateToken, requirePermission } = require('../middleware/auth');

// Get all fuel storages
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { siteId, fuelType, isMainStorage, status } = req.query;
    
    const filter = {};
    if (siteId) filter.siteId = siteId;
    if (fuelType) filter.fuelType = fuelType;
    if (isMainStorage !== undefined) filter.isMainStorage = isMainStorage === 'true';
    if (status) filter.status = status;

    const storages = await FuelStorage.find(filter)
      .populate('siteId', 'name address')
      .populate('createdBy', 'firstName lastName email')
      .populate('lastUpdatedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: storages
    });
  } catch (error) {
    console.error('Error fetching fuel storages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fuel storages',
      error: error.message
    });
  }
});

// Get single fuel storage
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const storage = await FuelStorage.findById(req.params.id)
      .populate('siteId', 'name address')
      .populate('createdBy', 'firstName lastName email')
      .populate('lastUpdatedBy', 'firstName lastName email');

    if (!storage) {
      return res.status(404).json({
        success: false,
        message: 'Fuel storage not found'
      });
    }

    res.json({
      success: true,
      data: storage
    });
  } catch (error) {
    console.error('Error fetching fuel storage:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fuel storage',
      error: error.message
    });
  }
});

// Create new fuel storage
router.post('/', authenticateToken, requirePermission('fuel.create'), async (req, res) => {
  try {
    const storageData = {
      ...req.body,
      createdBy: req.user._id,
      lastUpdatedBy: req.user._id
    };

    const storage = new FuelStorage(storageData);
    await storage.save();

    await storage.populate([
      { path: 'siteId', select: 'name address' },
      { path: 'createdBy', select: 'firstName lastName email' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Fuel storage created successfully',
      data: storage
    });
  } catch (error) {
    console.error('Error creating fuel storage:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to create fuel storage',
      error: error.message
    });
  }
});

// Update fuel storage
router.put('/:id', authenticateToken, requirePermission('fuel.update'), async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      lastUpdatedBy: req.user._id
    };

    const storage = await FuelStorage.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate([
      { path: 'siteId', select: 'name address' },
      { path: 'createdBy', select: 'firstName lastName email' },
      { path: 'lastUpdatedBy', select: 'firstName lastName email' }
    ]);

    if (!storage) {
      return res.status(404).json({
        success: false,
        message: 'Fuel storage not found'
      });
    }

    res.json({
      success: true,
      message: 'Fuel storage updated successfully',
      data: storage
    });
  } catch (error) {
    console.error('Error updating fuel storage:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to update fuel storage',
      error: error.message
    });
  }
});

// Update fuel reading (restock)
router.post('/:id/restock', authenticateToken, requirePermission('fuel.update'), async (req, res) => {
  try {
    const { quantityLiters, costPerLiter, notes } = req.body;
    
    if (!quantityLiters || quantityLiters <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }

    const storage = await FuelStorage.findById(req.params.id);
    if (!storage) {
      return res.status(404).json({
        success: false,
        message: 'Fuel storage not found'
      });
    }

    // Check capacity
    const newReading = storage.currentReading + quantityLiters;
    if (newReading > storage.capacityLiters) {
      return res.status(400).json({
        success: false,
        message: 'Restock quantity exceeds storage capacity'
      });
    }

    // Update storage
    storage.currentReading = newReading;
    storage.lastUpdatedBy = req.user._id;
    await storage.save();

    // Create transfer log for restock
    const FuelTransfer = require('../models/FuelTransfer');
    const transfer = new FuelTransfer({
      fromStorageId: null, // External source
      toStorageId: storage._id,
      fuelType: storage.fuelType,
      quantityLiters,
      transferType: 'restock',
      transferredBy: req.user._id,
      status: 'completed',
      costPerLiter,
      totalCost: costPerLiter ? costPerLiter * quantityLiters : null,
      notes
    });
    await transfer.save();

    await storage.populate([
      { path: 'siteId', select: 'name address' },
      { path: 'lastUpdatedBy', select: 'firstName lastName email' }
    ]);

    res.json({
      success: true,
      message: 'Fuel restocked successfully',
      data: storage
    });
  } catch (error) {
    console.error('Error restocking fuel:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restock fuel',
      error: error.message
    });
  }
});

// Delete fuel storage
router.delete('/:id', authenticateToken, requirePermission('fuel.delete'), async (req, res) => {
  try {
    const storage = await FuelStorage.findByIdAndDelete(req.params.id);
    
    if (!storage) {
      return res.status(404).json({
        success: false,
        message: 'Fuel storage not found'
      });
    }

    res.json({
      success: true,
      message: 'Fuel storage deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting fuel storage:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete fuel storage',
      error: error.message
    });
  }
});

// Get fuel storage statistics
router.get('/:id/stats', authenticateToken, async (req, res) => {
  try {
    const storage = await FuelStorage.findById(req.params.id);
    if (!storage) {
      return res.status(404).json({
        success: false,
        message: 'Fuel storage not found'
      });
    }

    // Get recent transfers
    const FuelTransfer = require('../models/FuelTransfer');
    const recentTransfers = await FuelTransfer.find({
      $or: [
        { fromStorageId: storage._id },
        { toStorageId: storage._id }
      ]
    })
    .populate('fromStorageId', 'name')
    .populate('toStorageId', 'name')
    .populate('transferredBy', 'firstName lastName')
    .sort({ transferDate: -1 })
    .limit(10);

    const stats = {
      currentReading: storage.currentReading,
      capacityLiters: storage.capacityLiters,
      availableCapacity: storage.availableCapacity,
      utilizationPercentage: storage.utilizationPercentage,
      recentTransfers
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching fuel storage stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fuel storage statistics',
      error: error.message
    });
  }
});

module.exports = router;
