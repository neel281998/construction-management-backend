const express = require('express');
const router = express.Router();
const FuelStorage = require('../models/FuelStorage');
const { authenticateToken, requirePermission, requireFuelAccess } = require('../middleware/auth');

router.use(authenticateToken, requireFuelAccess);

// Get all fuel storages
router.get('/', async (req, res) => {
  try {
    const { siteId, fuelType, storageType, status, parentStorageId } = req.query;
    
    const filter = {};
    if (siteId) filter.siteId = siteId;
    if (fuelType) filter.fuelType = fuelType;
    if (storageType) filter.storageType = storageType;
    if (status) filter.status = status;
    if (parentStorageId) filter.parentStorageId = parentStorageId;

    const storages = await FuelStorage.find(filter)
      .populate('siteId', 'name address')
      .populate('parentStorageId', 'name location')
      .populate('manager', 'firstName lastName email role')
      .populate('createdBy', 'firstName lastName email')
      .populate('lastUpdatedBy', 'firstName lastName email')
      .sort({ storageType: 1, createdAt: -1 });

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
router.get('/:id', async (req, res) => {
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

// Create new fuel storage (Admin, Fuel Main Manager, Fuel Sub Manager)
router.post('/', async (req, res) => {
  // Check if user has fuel management role
  if (!['admin', 'fuel_main_manager', 'fuel_sub_manager'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Fuel management role required.'
    });
  }
  try {
    const storageData = {
      ...req.body,
      createdBy: req.user._id,
      lastUpdatedBy: req.user._id
    };

    const capacityLiters = Number(storageData.capacityLiters);
    const initialReading = storageData.initialReading != null ? Number(storageData.initialReading) : 0;
    const currentReading = storageData.currentReading != null ? Number(storageData.currentReading) : initialReading;

    if (!Number.isFinite(capacityLiters) || capacityLiters < 0) {
      return res.status(400).json({
        success: false,
        message: 'Capacity must be a valid non-negative number'
      });
    }

    if (!Number.isFinite(initialReading) || initialReading < 0) {
      return res.status(400).json({
        success: false,
        message: 'Initial reading must be a valid non-negative number'
      });
    }

    if (!Number.isFinite(currentReading) || currentReading < 0) {
      return res.status(400).json({
        success: false,
        message: 'Current reading must be a valid non-negative number'
      });
    }

    if (initialReading > capacityLiters || currentReading > capacityLiters) {
      return res.status(400).json({
        success: false,
        message: 'Reading cannot exceed storage capacity'
      });
    }

    storageData.initialReading = initialReading;
    storageData.currentReading = currentReading;

    // Enforce single main storage
    if (storageData.storageType === 'main') {
      const existingMain = await FuelStorage.findOne({ storageType: 'main' });
      if (existingMain) {
        return res.status(400).json({
          success: false,
          message: 'Only one main fuel storage is allowed. Update the existing main storage instead.'
        });
      }
    }

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

// Update fuel storage (Admin, Fuel Main Manager, Fuel Sub Manager)
router.put('/:id', async (req, res) => {
  // Check if user has fuel management role
  if (!['admin', 'fuel_main_manager', 'fuel_sub_manager'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Fuel management role required.'
    });
  }
  try {
    const updateData = {
      ...req.body,
      lastUpdatedBy: req.user._id
    };

    if (
      updateData.capacityLiters != null ||
      updateData.currentReading != null ||
      updateData.initialReading != null
    ) {
      const existing = await FuelStorage.findById(req.params.id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Fuel storage not found'
        });
      }

      const capacityLiters = updateData.capacityLiters != null ? Number(updateData.capacityLiters) : Number(existing.capacityLiters);
      const initialReading = updateData.initialReading != null ? Number(updateData.initialReading) : Number(existing.initialReading);
      const currentReading = updateData.currentReading != null ? Number(updateData.currentReading) : Number(existing.currentReading);

      if (!Number.isFinite(capacityLiters) || capacityLiters < 0) {
        return res.status(400).json({
          success: false,
          message: 'Capacity must be a valid non-negative number'
        });
      }
      if (!Number.isFinite(initialReading) || initialReading < 0) {
        return res.status(400).json({
          success: false,
          message: 'Initial reading must be a valid non-negative number'
        });
      }
      if (!Number.isFinite(currentReading) || currentReading < 0) {
        return res.status(400).json({
          success: false,
          message: 'Current reading must be a valid non-negative number'
        });
      }
      if (initialReading > capacityLiters || currentReading > capacityLiters) {
        return res.status(400).json({
          success: false,
          message: 'Reading cannot exceed storage capacity'
        });
      }

      updateData.capacityLiters = capacityLiters;
      updateData.initialReading = initialReading;
      updateData.currentReading = currentReading;
    }

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
// Restock fuel storage (Admin, Fuel Main Manager, Fuel Sub Manager)
router.post('/:id/restock', async (req, res) => {
  // Check if user has fuel management role
  if (!['admin', 'fuel_main_manager', 'fuel_sub_manager'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Fuel management role required.'
    });
  }
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

// Delete fuel storage (Admin only)
router.delete('/:id', async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
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
router.get('/:id/stats', async (req, res) => {
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

// Get main storage (only one should exist)
router.get('/main/storage', async (req, res) => {
  try {
    const mainStorage = await FuelStorage.findOne({ storageType: 'main' })
      .populate('manager', 'firstName lastName email role')
      .populate('createdBy', 'firstName lastName email')
      .populate('lastUpdatedBy', 'firstName lastName email');

    if (!mainStorage) {
      return res.status(404).json({
        success: false,
        message: 'Main fuel storage not found'
      });
    }

    res.json({
      success: true,
      data: mainStorage
    });
  } catch (error) {
    console.error('Error fetching main storage:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch main storage',
      error: error.message
    });
  }
});

// Get all sub storages (assigned to managers)
router.get('/sub-storages', async (req, res) => {
  try {
    const subStorages = await FuelStorage.find({ 
      storageType: 'sub'
    })
      .populate('parentStorageId', 'name location')
      .populate('manager', 'firstName lastName email role')
      .populate('siteId', 'name address')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: subStorages
    });
  } catch (error) {
    console.error('Error fetching sub storages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sub storages',
      error: error.message
    });
  }
});

// Update daily reading
router.post('/:id/daily-reading', async (req, res) => {
  try {
    const { id } = req.params;
    const { reading, notes } = req.body;
    const userId = req.user.id;

    if (!reading || reading < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid reading amount is required'
      });
    }

    const storage = await FuelStorage.findById(id);
    if (!storage) {
      return res.status(404).json({
        success: false,
        message: 'Fuel storage not found'
      });
    }

    if (Number(reading) > Number(storage.capacityLiters)) {
      return res.status(400).json({
        success: false,
        message: `Reading cannot exceed capacity (${storage.capacityLiters} L)`
      });
    }

    // Update current reading and today's reading
    storage.currentReading = reading;
    storage.todayReading = reading;
    storage.lastReadingDate = new Date();
    storage.lastUpdatedBy = userId;

    // Add to daily readings history
    storage.dailyReadings.push({
      date: new Date(),
      reading: reading,
      recordedBy: userId,
      notes: notes || ''
    });

    await storage.save();

    res.json({
      success: true,
      message: 'Daily reading updated successfully',
      data: storage
    });
  } catch (error) {
    console.error('Error updating daily reading:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update daily reading',
      error: error.message
    });
  }
});

// Transfer fuel from main to sub storage
router.post('/transfer/main-to-sub', requirePermission('fuel_management'), async (req, res) => {
  try {
    const { subStorageId, amount, notes } = req.body;
    const userId = req.user.id;

    if (!subStorageId || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Sub storage ID and valid amount are required'
      });
    }

    // Get main storage
    const mainStorage = await FuelStorage.findOne({ storageType: 'main' });
    if (!mainStorage) {
      return res.status(404).json({
        success: false,
        message: 'Main storage not found'
      });
    }

    // Get sub storage
    const subStorage = await FuelStorage.findById(subStorageId);
    if (!subStorage || subStorage.storageType !== 'sub') {
      return res.status(404).json({
        success: false,
        message: 'Sub storage not found'
      });
    }

    // Check if main storage has enough fuel
    if (mainStorage.currentReading < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient fuel in main storage'
      });
    }

    // Check if sub storage has capacity
    const availableCapacity = subStorage.capacityLiters - subStorage.currentReading;
    if (availableCapacity < amount) {
      return res.status(400).json({
        success: false,
        message: 'Sub storage does not have enough capacity'
      });
    }

    // Update main storage
    const mainPreviousLevel = mainStorage.currentReading;
    mainStorage.currentReading -= amount;
    mainStorage.lastUpdatedBy = userId;

    // Update sub storage
    const subPreviousLevel = subStorage.currentReading;
    subStorage.currentReading += amount;
    subStorage.lastUpdatedBy = userId;

    // Add to restock history for sub storage
    subStorage.restockHistory.push({
      date: new Date(),
      amount: amount,
      previousLevel: subPreviousLevel,
      newLevel: subStorage.currentReading,
      restockedBy: userId,
      notes: notes || `Transferred from main storage`
    });

    await Promise.all([mainStorage.save(), subStorage.save()]);

    res.json({
      success: true,
      message: 'Fuel transferred successfully',
      data: {
        mainStorage: {
          id: mainStorage._id,
          previousLevel: mainPreviousLevel,
          currentLevel: mainStorage.currentReading
        },
        subStorage: {
          id: subStorage._id,
          previousLevel: subPreviousLevel,
          currentLevel: subStorage.currentReading
        }
      }
    });
  } catch (error) {
    console.error('Error transferring fuel:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to transfer fuel',
      error: error.message
    });
  }
});

module.exports = router;
