const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const MainStorage = require('../models/MainStorage');
const SubPump = require('../models/SubPump');
const FuelRestock = require('../models/FuelRestock');
const DailyReading = require('../models/DailyReading');
const VehicleRefueling = require('../models/VehicleRefueling');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const FuelAccessConfig = require('../models/FuelAccessConfig');
const { authenticateToken, requirePermission, requireAdmin, requireFuelAccess } = require('../middleware/auth');
const { logActivity, getActivityStyle } = require('../utils/activityLogger');

// ---------- Fuel access control (no requireFuelAccess here so frontend can check access) ----------
// Check if current user can access fuel management (admin or in allowed list)
router.get('/check-access', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      return res.json({ success: true, data: { canAccess: true } });
    }
    const config = await FuelAccessConfig.getConfig();
    const allowed = (config.allowedUserIds || []).map(id => id.toString());
    const canAccess = allowed.includes(req.user._id.toString());
    res.json({ success: true, data: { canAccess } });
  } catch (err) {
    console.error('Fuel check-access error:', err);
    res.status(500).json({ success: false, message: 'Failed to check fuel access' });
  }
});

// Get allowed managers (admin only) – for admin to see/edit who has fuel access
router.get('/allowed-managers', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const config = await FuelAccessConfig.getConfig();
    const list = config.allowedUserIds || [];
    const ids = list.map(id => (id && id.toString ? id.toString() : id));
    const users = list.length
      ? await User.find({ _id: { $in: list } }).select('_id firstName lastName email role').lean()
      : [];
    res.json({ success: true, data: { allowedUserIds: ids, users } });
  } catch (err) {
    console.error('Fuel allowed-managers get error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch allowed managers' });
  }
});

// Set allowed managers (admin only) – admin selects multiple supervisors/users who can access fuel
router.put('/allowed-managers', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userIds } = req.body || {};
    const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [];
    const config = await FuelAccessConfig.getConfig();
    config.allowedUserIds = ids.map(id => (typeof id === 'string' ? id : id.toString()));
    config.updatedBy = req.user._id;
    config.updatedAt = new Date();
    await config.save();
    res.json({ success: true, data: { allowedUserIds: config.allowedUserIds }, message: 'Fuel access updated' });
  } catch (err) {
    console.error('Fuel allowed-managers put error:', err);
    res.status(500).json({ success: false, message: 'Failed to update allowed managers' });
  }
});

// All routes below require fuel access (admin or selected supervisor)
router.use(authenticateToken, requireFuelAccess);

// ==================== MAIN STORAGE ROUTES ====================

// Get all main storage
router.get('/main-storage', requirePermission('fuel.read'), async (req, res) => {
  try {
    const mainStorages = await MainStorage.find({ isActive: true })
      .populate('manager', 'firstName lastName email')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: { mainStorages }
    });
  } catch (error) {
    console.error('Get main storage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch main storage'
    });
  }
});

// Get single main storage
router.get('/main-storage/:id', requirePermission('fuel.read'), async (req, res) => {
  try {
    const mainStorage = await MainStorage.findById(req.params.id)
      .populate('manager', 'firstName lastName email');

    if (!mainStorage) {
      return res.status(404).json({
        success: false,
        message: 'Main storage not found'
      });
    }

    res.json({
      success: true,
      data: { mainStorage }
    });
  } catch (error) {
    console.error('Get main storage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch main storage'
    });
  }
});

// Create main storage
router.post('/main-storage', requirePermission('fuel.create'), async (req, res) => {
  try {
    const { initialPumpReading, initialPumpReadingImage, ...restBody } = req.body;
    
    const mainStorageData = {
      ...restBody,
      currentFuelLevel: req.body.initialFuelLevel || 0,
      totalDispensed: 0,
      totalAdded: 0
    };

    const mainStorage = new MainStorage(mainStorageData);
    await mainStorage.save();
    await mainStorage.populate('manager', 'firstName lastName email');

    // If initial pump reading is provided, create the first daily reading (opening reading)
    // NOTE: This should NOT change the storage's current fuel level, which is driven by initialFuelLevel
    if (initialPumpReading !== undefined && initialPumpReading !== null && initialPumpReadingImage) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const dailyReading = new DailyReading({
        storageType: 'main',
        storageId: mainStorage._id,
        storageTypeModel: 'MainStorage',
        date: today,
        openingReading: {
          value: parseFloat(initialPumpReading), // in liters
          image: initialPumpReadingImage,
          timestamp: new Date()
        },
        operator: req.user._id,
        fuelConsumed: 0,
        isComplete: false
      });
      
      await dailyReading.save();
    }

    // Log activity
    await logActivity({
      user: req.user,
      action: 'fuel_main_storage_created',
      category: 'fuel',
      title: 'Main Storage Created',
      message: `${mainStorage.name} has been created`,
      entityType: 'main_storage',
      entityId: mainStorage._id,
      entityName: mainStorage.name,
      metadata: {
        location: mainStorage.location,
        capacity: mainStorage.totalCapacity,
        scaleType: mainStorage.scaleType,
        hasInitialReading: !!initialPumpReading
      },
      ...getActivityStyle('fuel_main_storage_created'),
      req
    });

    res.status(201).json({
      success: true,
      message: 'Main storage created successfully',
      data: { mainStorage }
    });
  } catch (error) {
    console.error('Create main storage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create main storage'
    });
  }
});

// Update main storage
router.put('/main-storage/:id', requirePermission('fuel.update'), async (req, res) => {
  try {
    const mainStorage = await MainStorage.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('manager', 'firstName lastName email');

    if (!mainStorage) {
      return res.status(404).json({
        success: false,
        message: 'Main storage not found'
      });
    }

    // Log activity
    await logActivity({
      user: req.user,
      action: 'fuel_main_storage_updated',
      category: 'fuel',
      title: 'Main Storage Updated',
      message: `${mainStorage.name} has been updated`,
      entityType: 'main_storage',
      entityId: mainStorage._id,
      entityName: mainStorage.name,
      ...getActivityStyle('fuel_main_storage_updated'),
      req
    });

    res.json({
      success: true,
      message: 'Main storage updated successfully',
      data: { mainStorage }
    });
  } catch (error) {
    console.error('Update main storage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update main storage'
    });
  }
});

// Delete main storage (soft delete)
router.delete('/main-storage/:id', requirePermission('fuel.delete'), async (req, res) => {
  try {
    const mainStorage = await MainStorage.findById(req.params.id);
    
    if (!mainStorage) {
      return res.status(404).json({
        success: false,
        message: 'Main storage not found'
      });
    }

    const storageName = mainStorage.name;
    mainStorage.isActive = false;
    await mainStorage.save();

    // Log activity
    await logActivity({
      user: req.user,
      action: 'fuel_main_storage_deleted',
      category: 'fuel',
      title: 'Main Storage Deleted',
      message: `${storageName} has been deleted`,
      entityType: 'main_storage',
      entityId: mainStorage._id,
      entityName: storageName,
      ...getActivityStyle('fuel_main_storage_deleted'),
      req
    });

    res.json({
      success: true,
      message: 'Main storage deleted successfully'
    });
  } catch (error) {
    console.error('Delete main storage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete main storage'
    });
  }
});

// Restock main storage
router.post('/main-storage/:id/restock', requirePermission('fuel.restock'), async (req, res) => {
  try {
    const { quantity, scaleReading, image, source, notes } = req.body;
    
    const mainStorage = await MainStorage.findById(req.params.id);
    if (!mainStorage) {
      return res.status(404).json({
        success: false,
        message: 'Main storage not found'
      });
    }

    // Update main storage fuel level
    mainStorage.totalAdded += quantity;
    mainStorage.currentFuelLevel += quantity; // Add the restocked quantity to current fuel level
    
    // Update current reading if scale reading is provided
    if (scaleReading) {
      mainStorage.currentReading = {
        value: scaleReading,
        image: image,
        date: new Date()
      };
    }
    
    // Save the updated main storage
    await mainStorage.save();

    // Create restock record
    const restockData = {
      storageType: 'main',
      storageId: mainStorage._id,
      storageTypeModel: 'MainStorage',
      quantity,
      scaleReading: scaleReading || mainStorage.currentReading.value,
      image,
      source,
      operator: req.user._id,
      notes
    };

    const restock = new FuelRestock(restockData);
    await restock.save();

    // Log activity
    await logActivity({
      user: req.user,
      action: 'fuel_main_storage_restocked',
      category: 'fuel',
      title: 'Main Storage Restocked',
      message: `${quantity}L added to ${mainStorage.name}`,
      entityType: 'main_storage',
      entityId: mainStorage._id,
      entityName: mainStorage.name,
      metadata: {
        quantity,
        scaleReading
      },
      ...getActivityStyle('fuel_main_storage_restocked'),
      req
    });

    res.status(201).json({
      success: true,
      message: 'Main storage restocked successfully',
      data: { restock, mainStorage }
    });
  } catch (error) {
    console.error('Restock main storage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restock main storage'
    });
  }
});

// Record daily reading for main storage
router.post('/main-storage/:id/daily-reading', requirePermission('fuel.reading'), async (req, res) => {
  try {
    const { readingType, value, image, notes } = req.body; // readingType: 'opening' or 'closing'
    
    const mainStorage = await MainStorage.findById(req.params.id);
    if (!mainStorage) {
      return res.status(404).json({
        success: false,
        message: 'Main storage not found'
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let dailyReading = await DailyReading.findOne({
      storageType: 'main',
      storageId: mainStorage._id,
      date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
    });

    if (!dailyReading) {
      // Create new daily reading
      dailyReading = new DailyReading({
        storageType: 'main',
        storageId: mainStorage._id,
        storageTypeModel: 'MainStorage',
        date: today,
        operator: req.user._id,
        notes
      });
    }

    if (readingType === 'opening') {
      dailyReading.openingReading = {
        value,
        image,
        timestamp: new Date()
      };
    } else if (readingType === 'closing') {
      await dailyReading.completeReading(value, image);
      // Update main storage current reading
      await mainStorage.updateReading(value, image);
    }

    await dailyReading.save();

    // Log activity
    await logActivity({
      user: req.user,
      action: 'fuel_daily_reading_recorded',
      category: 'fuel',
      title: 'Daily Reading Recorded',
      message: `${readingType} reading recorded for ${mainStorage.name}`,
      entityType: 'main_storage',
      entityId: mainStorage._id,
      entityName: mainStorage.name,
      metadata: {
        readingType,
        value,
        isComplete: dailyReading.isComplete
      },
      ...getActivityStyle('fuel_daily_reading_recorded'),
      req
    });

    res.json({
      success: true,
      message: 'Daily reading recorded successfully',
      data: { dailyReading }
    });
  } catch (error) {
    console.error('Record daily reading error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record daily reading'
    });
  }
});

// ==================== SUB PUMP ROUTES ====================

// Get all sub pumps
router.get('/sub-pumps', requirePermission('fuel.read'), async (req, res) => {
  try {
    const subPumps = await SubPump.find({ isActive: true })
      .populate('manager', 'firstName lastName email')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: { subPumps }
    });
  } catch (error) {
    console.error('Get sub pumps error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sub pumps'
    });
  }
});

// Get single sub pump
router.get('/sub-pumps/:id', requirePermission('fuel.read'), async (req, res) => {
  try {
    const subPump = await SubPump.findById(req.params.id)
      .populate('manager', 'firstName lastName email');

    if (!subPump) {
      return res.status(404).json({
        success: false,
        message: 'Sub pump not found'
      });
    }

    res.json({
      success: true,
      data: { subPump }
    });
  } catch (error) {
    console.error('Get sub pump error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sub pump'
    });
  }
});

// Create sub pump
router.post('/sub-pumps', requirePermission('fuel.create'), async (req, res) => {
  try {
    const { initialPumpReading, initialPumpReadingImage, ...restBody } = req.body;

    const parsedTotalCapacity = restBody.totalCapacity != null ? Number(restBody.totalCapacity) : NaN;
    const parsedInitialFuelLevel = req.body.initialFuelLevel != null && req.body.initialFuelLevel !== ''
      ? Number(req.body.initialFuelLevel)
      : 0;

    if (!Number.isFinite(parsedTotalCapacity) || parsedTotalCapacity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Total capacity must be a valid non-negative number'
      });
    }

    if (!Number.isFinite(parsedInitialFuelLevel) || parsedInitialFuelLevel < 0) {
      return res.status(400).json({
        success: false,
        message: 'Initial fuel level must be a valid non-negative number'
      });
    }

    if (parsedInitialFuelLevel > parsedTotalCapacity) {
      return res.status(400).json({
        success: false,
        message: 'Initial fuel level cannot exceed pump capacity'
      });
    }

    const subPumpData = {
      ...restBody,
      totalCapacity: parsedTotalCapacity,
      currentFuelLevel: parsedInitialFuelLevel,
      totalDispensed: 0,
      totalAdded: 0
    };

    const subPump = new SubPump(subPumpData);
    await subPump.save();
    await subPump.populate('manager', 'firstName lastName email');

    // If initial pump reading is provided, create the first daily reading (opening reading)
    // NOTE: This should NOT change the pump's current fuel level, which is driven by initialFuelLevel
    if (initialPumpReading !== undefined && initialPumpReading !== null && initialPumpReadingImage) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const dailyReading = new DailyReading({
        storageType: 'sub',
        storageId: subPump._id,
        storageTypeModel: 'SubPump',
        date: today,
        openingReading: {
          value: parseFloat(initialPumpReading), // in liters
          image: initialPumpReadingImage,
          timestamp: new Date()
        },
        operator: req.user._id,
        fuelConsumed: 0,
        isComplete: false
      });
      
      await dailyReading.save();
    }

    // Log activity
    await logActivity({
      user: req.user,
      action: 'fuel_sub_pump_created',
      category: 'fuel',
      title: 'Sub Pump Created',
      message: `${subPump.name} has been created`,
      entityType: 'sub_pump',
      entityId: subPump._id,
      entityName: subPump.name,
      metadata: {
        location: subPump.location,
        capacity: subPump.totalCapacity,
        hasInitialReading: !!initialPumpReading
      },
      ...getActivityStyle('fuel_sub_pump_created'),
      req
    });

    res.status(201).json({
      success: true,
      message: 'Sub pump created successfully',
      data: { subPump }
    });
  } catch (error) {
    console.error('Create sub pump error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create sub pump'
    });
  }
});

// Update sub pump
router.put('/sub-pumps/:id', requirePermission('fuel.update'), async (req, res) => {
  try {
    if (req.body && (req.body.totalCapacity != null || req.body.currentFuelLevel != null)) {
      const existing = await SubPump.findById(req.params.id).select('totalCapacity currentFuelLevel');
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Sub pump not found'
        });
      }

      const capacity = req.body.totalCapacity != null ? Number(req.body.totalCapacity) : Number(existing.totalCapacity);
      const currentFuelLevel = req.body.currentFuelLevel != null ? Number(req.body.currentFuelLevel) : Number(existing.currentFuelLevel);

      if (!Number.isFinite(capacity) || capacity < 0) {
        return res.status(400).json({
          success: false,
          message: 'Total capacity must be a valid non-negative number'
        });
      }

      if (!Number.isFinite(currentFuelLevel) || currentFuelLevel < 0) {
        return res.status(400).json({
          success: false,
          message: 'Current fuel level must be a valid non-negative number'
        });
      }

      if (currentFuelLevel > capacity) {
        return res.status(400).json({
          success: false,
          message: 'Current fuel level cannot exceed pump capacity'
        });
      }

      req.body.totalCapacity = capacity;
      req.body.currentFuelLevel = currentFuelLevel;
    }

    const subPump = await SubPump.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('manager', 'firstName lastName email');

    if (!subPump) {
      return res.status(404).json({
        success: false,
        message: 'Sub pump not found'
      });
    }

    // Log activity
    await logActivity({
      user: req.user,
      action: 'fuel_sub_pump_updated',
      category: 'fuel',
      title: 'Sub Pump Updated',
      message: `${subPump.name} has been updated`,
      entityType: 'sub_pump',
      entityId: subPump._id,
      entityName: subPump.name,
      ...getActivityStyle('fuel_sub_pump_updated'),
      req
    });

    res.json({
      success: true,
      message: 'Sub pump updated successfully',
      data: { subPump }
    });
  } catch (error) {
    console.error('Update sub pump error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update sub pump'
    });
  }
});

// Delete sub pump (soft delete)
router.delete('/sub-pumps/:id', requirePermission('fuel.delete'), async (req, res) => {
  try {
    const subPump = await SubPump.findById(req.params.id);
    
    if (!subPump) {
      return res.status(404).json({
        success: false,
        message: 'Sub pump not found'
      });
    }

    const pumpName = subPump.name;
    subPump.isActive = false;
    await subPump.save();

    // Log activity
    await logActivity({
      user: req.user,
      action: 'fuel_sub_pump_deleted',
      category: 'fuel',
      title: 'Sub Pump Deleted',
      message: `${pumpName} has been deleted`,
      entityType: 'sub_pump',
      entityId: subPump._id,
      entityName: pumpName,
      ...getActivityStyle('fuel_sub_pump_deleted'),
      req
    });

    res.json({
      success: true,
      message: 'Sub pump deleted successfully'
    });
  } catch (error) {
    console.error('Delete sub pump error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete sub pump'
    });
  }
});

// Restock sub pump
router.post('/sub-pumps/:id/restock', requirePermission('fuel.restock'), async (req, res) => {
  try {
    const { quantity, scaleReading, image, source, notes } = req.body;
    
    const subPump = await SubPump.findById(req.params.id);
    if (!subPump) {
      return res.status(404).json({
        success: false,
        message: 'Sub pump not found'
      });
    }

    const parsedQuantity = Number(quantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }

    const newFuelLevel = Number(subPump.currentFuelLevel || 0) + parsedQuantity;
    if (newFuelLevel > Number(subPump.totalCapacity || 0)) {
      return res.status(400).json({
        success: false,
        message: `Restock quantity exceeds pump capacity (${subPump.totalCapacity} L)`
      });
    }

    // If fuel is coming from a main storage tank, decrease that tank's fuel level
    // `source` is expected to be the main storage ID or name
    let sourceMainStorage = null;
    if (source) {
      // Try to resolve source as MainStorage ID first, then by name
      if (mongoose.Types.ObjectId.isValid(source)) {
        sourceMainStorage = await MainStorage.findById(source);
      } else {
        sourceMainStorage = await MainStorage.findOne({ name: source });
      }

      if (sourceMainStorage) {
        // Ensure main storage has enough fuel to transfer
        if (sourceMainStorage.currentFuelLevel < parsedQuantity) {
          return res.status(400).json({
            success: false,
            message: 'Insufficient fuel in main storage for transfer'
          });
        }

        // Decrease main storage fuel and track as dispensed
        sourceMainStorage.currentFuelLevel -= parsedQuantity;
        sourceMainStorage.totalDispensed += parsedQuantity;
        await sourceMainStorage.save();
      }
    }

    // Update sub pump fuel level
    subPump.totalAdded += parsedQuantity;
    subPump.currentFuelLevel += parsedQuantity; // Add the restocked quantity to current fuel level
    
    // Update current reading if scale reading is provided
    if (scaleReading) {
      subPump.currentReading = {
        value: scaleReading,
        image: image,
        date: new Date()
      };
    }
    
    // Save the updated sub pump
    await subPump.save();

    // Create restock record
    const restockData = {
      storageType: 'sub',
      storageId: subPump._id,
      storageTypeModel: 'SubPump',
      quantity: parsedQuantity,
      scaleReading: scaleReading || subPump.currentReading.value,
      image,
      source,
      operator: req.user._id,
      notes
    };

    const restock = new FuelRestock(restockData);
    await restock.save();

    // Log activity
    await logActivity({
      user: req.user,
      action: 'fuel_sub_pump_restocked',
      category: 'fuel',
      title: 'Sub Pump Restocked',
      message: `${parsedQuantity}L added to ${subPump.name}`,
      entityType: 'sub_pump',
      entityId: subPump._id,
      entityName: subPump.name,
      metadata: {
        quantity: parsedQuantity,
        scaleReading,
        source,
        sourceMainStorage: sourceMainStorage ? {
          id: sourceMainStorage._id,
          name: sourceMainStorage.name
        } : null
      },
      ...getActivityStyle('fuel_sub_pump_restocked'),
      req
    });

    res.status(201).json({
      success: true,
      message: 'Sub pump restocked successfully',
      data: { restock, subPump, sourceMainStorage }
    });
  } catch (error) {
    console.error('Restock sub pump error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restock sub pump'
    });
  }
});

// Record daily reading for sub pump
router.post('/sub-pumps/:id/daily-reading', requirePermission('fuel.reading'), async (req, res) => {
  try {
    const { readingType, value, image, notes } = req.body;
    
    const subPump = await SubPump.findById(req.params.id);
    if (!subPump) {
      return res.status(404).json({
        success: false,
        message: 'Sub pump not found'
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let dailyReading = await DailyReading.findOne({
      storageType: 'sub',
      storageId: subPump._id,
      date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
    });

    if (!dailyReading) {
      dailyReading = new DailyReading({
        storageType: 'sub',
        storageId: subPump._id,
        storageTypeModel: 'SubPump',
        date: today,
        operator: req.user._id,
        notes
      });
    }

    if (readingType === 'opening') {
      dailyReading.openingReading = {
        value,
        image,
        timestamp: new Date()
      };
    } else if (readingType === 'closing') {
      await dailyReading.completeReading(value, image);
      await subPump.updateReading(value, image);
    }

    await dailyReading.save();

    // Log activity
    await logActivity({
      user: req.user,
      action: 'fuel_daily_reading_recorded',
      category: 'fuel',
      title: 'Daily Reading Recorded',
      message: `${readingType} reading recorded for ${subPump.name}`,
      entityType: 'sub_pump',
      entityId: subPump._id,
      entityName: subPump.name,
      metadata: {
        readingType,
        value,
        isComplete: dailyReading.isComplete
      },
      ...getActivityStyle('fuel_daily_reading_recorded'),
      req
    });

    res.json({
      success: true,
      message: 'Daily reading recorded successfully',
      data: { dailyReading }
    });
  } catch (error) {
    console.error('Record daily reading error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record daily reading'
    });
  }
});

// ==================== VEHICLE REFUELING ROUTES ====================

// Record vehicle refueling
router.post('/refuel', requirePermission('fuel.refuel'), async (req, res) => {
  try {
    const {
      vehicleId,
      manualVehicleNumber,
      pumpType,
      pumpId,
      quantity,
      images,
      odometerReading,
      odometerType,
      operator,
      shift,
      notes,
      pumpStartReading,
      pumpEndReading
    } = req.body;

    // Validate that either vehicleId or manualVehicleNumber is provided
    if (!vehicleId && !manualVehicleNumber) {
      return res.status(400).json({
        success: false,
        message: 'Either vehicle selection or manual vehicle number is required'
      });
    }

    // Validate vehicle exists if vehicleId is provided
    let vehicle = null;
    if (vehicleId) {
      vehicle = await Vehicle.findById(vehicleId);
      if (!vehicle) {
        return res.status(404).json({
          success: false,
          message: 'Vehicle not found'
        });
      }
    }

    // Validate pump exists
    let pump;
    if (pumpType === 'main') {
      pump = await MainStorage.findById(pumpId);
    } else {
      pump = await SubPump.findById(pumpId);
    }

    if (!pump) {
      return res.status(404).json({
        success: false,
        message: 'Pump not found'
      });
    }

    // Check if pump has enough fuel
    if (pump.currentFuelLevel < quantity) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient fuel in pump'
      });
    }

    // Get previous odometer reading for efficiency calculation (only if vehicle exists)
    let previousOdometer = 0;
    let previousRefueling = null;
    if (vehicleId) {
      previousOdometer = vehicle.fuelEfficiency.currentOdometer;
      previousRefueling = await VehicleRefueling.findOne({ vehicleId })
        .sort({ date: -1 });
    } else if (manualVehicleNumber) {
      // Try to find previous refueling by manual vehicle number
      previousRefueling = await VehicleRefueling.findOne({ 
        manualVehicleNumber: manualVehicleNumber.trim() 
      })
        .sort({ date: -1 });
      if (previousRefueling) {
        previousOdometer = previousRefueling.odometerReading;
      }
    }

    // Create refueling record
    const refuelingData = {
      vehicleId: vehicleId || null,
      manualVehicleNumber: manualVehicleNumber ? manualVehicleNumber.trim() : null,
      pumpType,
      pumpId,
      pumpTypeModel: pumpType === 'main' ? 'MainStorage' : 'SubPump',
      quantity,
      images,
      odometerReading,
      odometerType: odometerType || 'km',
      operator,
      shift,
      notes,
      pumpStartReading,
      pumpEndReading,
      previousOdometer: previousRefueling ? previousRefueling.odometerReading : previousOdometer
    };

    const refueling = new VehicleRefueling(refuelingData);
    
    // Calculate fuel efficiency
    if (previousRefueling) {
      const efficiency = refueling.calculateEfficiency(previousRefueling.odometerReading);
      refueling.fuelEfficiency = efficiency;
    }

    await refueling.save();

    // Update vehicle fuel efficiency data (only if vehicle exists)
    if (vehicle) {
      const distance = odometerReading - (previousRefueling ? previousRefueling.odometerReading : previousOdometer);
      if (distance > 0 && quantity > 0) {
        const efficiency = distance / quantity;
        
        vehicle.fuelEfficiency.currentOdometer = odometerReading;
        vehicle.fuelEfficiency.odometerType = odometerType;
        vehicle.fuelEfficiency.latestEfficiency = efficiency;
        vehicle.fuelEfficiency.totalFuelConsumed += quantity;
        vehicle.fuelEfficiency.totalDistance += distance;
        vehicle.fuelEfficiency.lastRefuelingDate = new Date();
        
        // Add to efficiency history
        vehicle.fuelEfficiency.efficiencyHistory.push({
          date: new Date(),
          efficiency,
          fuelQuantity: quantity,
          distance
        });
        
        // Calculate average efficiency
        const totalEfficiency = vehicle.fuelEfficiency.efficiencyHistory.reduce((sum, entry) => sum + entry.efficiency, 0);
        vehicle.fuelEfficiency.averageEfficiency = totalEfficiency / vehicle.fuelEfficiency.efficiencyHistory.length;
        
        await vehicle.save();
      }
    }

    // Update pump fuel level
    pump.currentFuelLevel -= quantity;
    pump.totalDispensed += quantity;
    await pump.save();

    // Log activity
    const vehicleNumber = vehicle ? vehicle.vehicleNumber : manualVehicleNumber;
    await logActivity({
      user: req.user,
      action: 'vehicle_refueled',
      category: 'fuel',
      title: 'Vehicle Refueled',
      message: `${vehicleNumber} refueled with ${quantity}L from ${pump.name}`,
      entityType: vehicle ? 'vehicle' : 'manual_vehicle',
      entityId: vehicle ? vehicle._id : null,
      entityName: vehicleNumber,
      metadata: {
        pumpType,
        pumpName: pump.name,
        quantity,
        odometerReading,
        efficiency: refueling.fuelEfficiency,
        operator,
        isManualVehicle: !vehicle
      },
      ...getActivityStyle('vehicle_refueled'),
      req
    });

    res.status(201).json({
      success: true,
      message: 'Vehicle refueled successfully',
      data: { refueling, vehicle: vehicle || null, pump }
    });
  } catch (error) {
    console.error('Vehicle refueling error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record vehicle refueling'
    });
  }
});

// Get all refueling history (general)
router.get('/refuel-history', requirePermission('fuel.read'), async (req, res) => {
  try {
    const { page = 1, limit = 20, vehicleId, startDate, endDate } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (vehicleId) filter.vehicleId = vehicleId;
    
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const refuelings = await VehicleRefueling.find(filter)
      .populate('vehicleId', 'vehicleNumber type brand model')
      .populate('pumpId', 'name location')
      .populate('operator', 'firstName lastName')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await VehicleRefueling.countDocuments(filter);

    res.json({
      success: true,
      data: {
        refuelings,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalCount: total,
          hasNext: skip + refuelings.length < total,
          hasPrev: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Get refueling history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch refueling history'
    });
  }
});

// Get fuel restock history (for main storage and sub pumps)
router.get('/restock-history', requirePermission('fuel.read'), async (req, res) => {
  try {
    const { page = 1, limit = 20, storageType, storageId, startDate, endDate } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (storageType) filter.storageType = storageType; // 'main' or 'sub'
    if (storageId) filter.storageId = storageId;

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const restocks = await FuelRestock.find(filter)
      .populate('storageId', 'name location')
      .populate('operator', 'firstName lastName')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await FuelRestock.countDocuments(filter);

    res.json({
      success: true,
      data: {
        restocks,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalCount: total,
          hasNext: skip + restocks.length < total,
          hasPrev: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Get restock history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch restock history'
    });
  }
});

// Get vehicle refueling history
router.get('/refuel-history/:vehicleId', requirePermission('fuel.read'), async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const refuelings = await VehicleRefueling.find({ vehicleId: req.params.vehicleId })
      .populate('pumpId', 'name location')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await VehicleRefueling.countDocuments({ vehicleId: req.params.vehicleId });

    res.json({
      success: true,
      data: {
        refuelings,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalCount: total,
          hasNext: skip + refuelings.length < total,
          hasPrev: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Get refueling history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch refueling history'
    });
  }
});

// Get vehicle fuel efficiency
router.get('/efficiency/:vehicleId', requirePermission('fuel.read'), async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.vehicleId);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    res.json({
      success: true,
      data: {
        efficiency: vehicle.fuelEfficiency,
        vehicle: {
          vehicleNumber: vehicle.vehicleNumber,
          type: vehicle.type,
          brand: vehicle.brand,
          model: vehicle.model
        }
      }
    });
  } catch (error) {
    console.error('Get fuel efficiency error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fuel efficiency'
    });
  }
});

// ==================== DASHBOARD & REPORTS ====================

// Get fuel management dashboard data
router.get('/dashboard', requirePermission('fuel.read'), async (req, res) => {
  try {
    // Get main storage summary
    const mainStorages = await MainStorage.find({ isActive: true });
    const totalMainCapacity = mainStorages.reduce((sum, storage) => sum + storage.totalCapacity, 0);
    const totalMainFuel = mainStorages.reduce((sum, storage) => sum + storage.currentFuelLevel, 0);

    // Get sub pump summary
    const subPumps = await SubPump.find({ isActive: true });
    const totalSubCapacity = subPumps.reduce((sum, pump) => sum + pump.totalCapacity, 0);
    const totalSubFuel = subPumps.reduce((sum, pump) => sum + pump.currentFuelLevel, 0);

    // Get recent refuelings
    const recentRefuelings = await VehicleRefueling.find()
      .populate('vehicleId', 'vehicleNumber type')
      .populate('pumpId', 'name')
      .sort({ date: -1 })
      .limit(10)
      .lean();

    // Get recent restocks
    const recentRestocks = await FuelRestock.find()
      .populate('storageId', 'name location')
      .populate('operator', 'firstName lastName')
      .sort({ date: -1 })
      .limit(10)
      .lean();

    // Combine and sort by date (most recent first)
    const recentActivities = [
      ...recentRefuelings.map(item => ({ ...item, activityType: 'refueling' })),
      ...recentRestocks.map(item => ({ ...item, activityType: 'restock' }))
    ]
      .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
      .slice(0, 10);

    // Get daily readings for a specific date (defaults to today)
    const { date } = req.query;
    let targetDate = date ? new Date(date) : new Date();
    // Normalize to start of day in server timezone
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);

    const todayReadings = await DailyReading.find({
      date: { $gte: targetDate, $lt: nextDay }
    }).populate('storageId', 'name');

    res.json({
      success: true,
      data: {
        summary: {
          mainStorage: {
            count: mainStorages.length,
            totalCapacity: totalMainCapacity,
            currentFuel: totalMainFuel,
            utilization: totalMainCapacity > 0 ? Math.round((totalMainFuel / totalMainCapacity) * 100) : 0
          },
          subPumps: {
            count: subPumps.length,
            totalCapacity: totalSubCapacity,
            currentFuel: totalSubFuel,
            utilization: totalSubCapacity > 0 ? Math.round((totalSubFuel / totalSubCapacity) * 100) : 0
          }
        },
        recentRefuelings: recentActivities,
        todayReadings
      }
    });
  } catch (error) {
    console.error('Get fuel dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fuel dashboard data'
    });
  }
});

module.exports = router;
