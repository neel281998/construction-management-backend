const express = require('express');
const router = express.Router();
const MainStorage = require('../models/MainStorage');
const SubPump = require('../models/SubPump');
const FuelRestock = require('../models/FuelRestock');
const DailyReading = require('../models/DailyReading');
const VehicleRefueling = require('../models/VehicleRefueling');
const Vehicle = require('../models/Vehicle');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logActivity, getActivityStyle } = require('../utils/activityLogger');

// ==================== MAIN STORAGE ROUTES ====================

// Get all main storage
router.get('/main-storage', authenticateToken, requirePermission('fuel.read'), async (req, res) => {
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
router.get('/main-storage/:id', authenticateToken, requirePermission('fuel.read'), async (req, res) => {
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
router.post('/main-storage', authenticateToken, requirePermission('fuel.create'), async (req, res) => {
  try {
    const mainStorageData = {
      ...req.body,
      currentFuelLevel: req.body.initialFuelLevel || 0,
      totalDispensed: 0,
      totalAdded: 0
    };

    const mainStorage = new MainStorage(mainStorageData);
    await mainStorage.save();
    await mainStorage.populate('manager', 'firstName lastName email');

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
        scaleType: mainStorage.scaleType
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
router.put('/main-storage/:id', authenticateToken, requirePermission('fuel.update'), async (req, res) => {
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
router.delete('/main-storage/:id', authenticateToken, requirePermission('fuel.delete'), async (req, res) => {
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
router.post('/main-storage/:id/restock', authenticateToken, requirePermission('fuel.restock'), async (req, res) => {
  try {
    const { quantity, scaleReading, image, source, notes } = req.body;
    
    const mainStorage = await MainStorage.findById(req.params.id);
    if (!mainStorage) {
      return res.status(404).json({
        success: false,
        message: 'Main storage not found'
      });
    }

    // Check if restock would exceed total capacity
    const newFuelLevel = mainStorage.currentFuelLevel + quantity;
    if (newFuelLevel > mainStorage.totalCapacity) {
      const availableCapacity = mainStorage.totalCapacity - mainStorage.currentFuelLevel;
      return res.status(400).json({
        success: false,
        message: `Restock quantity exceeds total capacity. Current: ${mainStorage.currentFuelLevel}L, Capacity: ${mainStorage.totalCapacity}L, Available: ${availableCapacity}L, Requested: ${quantity}L`
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
router.post('/main-storage/:id/daily-reading', authenticateToken, requirePermission('fuel.reading'), async (req, res) => {
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
router.get('/sub-pumps', authenticateToken, requirePermission('fuel.read'), async (req, res) => {
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
router.get('/sub-pumps/:id', authenticateToken, requirePermission('fuel.read'), async (req, res) => {
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
router.post('/sub-pumps', authenticateToken, requirePermission('fuel.create'), async (req, res) => {
  try {
    const subPumpData = {
      ...req.body,
      currentFuelLevel: req.body.initialFuelLevel || 0,
      totalDispensed: 0,
      totalAdded: 0
    };

    const subPump = new SubPump(subPumpData);
    await subPump.save();
    await subPump.populate('manager', 'firstName lastName email');

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
        capacity: subPump.totalCapacity
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
router.put('/sub-pumps/:id', authenticateToken, requirePermission('fuel.update'), async (req, res) => {
  try {
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
router.delete('/sub-pumps/:id', authenticateToken, requirePermission('fuel.delete'), async (req, res) => {
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
router.post('/sub-pumps/:id/restock', authenticateToken, requirePermission('fuel.restock'), async (req, res) => {
  try {
    const { quantity, scaleReading, image, source, notes, mainStorageId } = req.body;
    
    const subPump = await SubPump.findById(req.params.id);
    if (!subPump) {
      return res.status(404).json({
        success: false,
        message: 'Sub pump not found'
      });
    }

    // Sub pumps always get fuel from main storage (unless explicitly marked as external source)
    let mainStorage = null;
    const isExternalSource = source && (
      source.toLowerCase().includes('supplier') ||
      source.toLowerCase().includes('external') ||
      source.toLowerCase().includes('vendor') ||
      source.toLowerCase().includes('direct')
    );

    // Only skip main storage decrement if explicitly marked as external source
    if (!isExternalSource) {
      // Find main storage - use mainStorageId if provided, otherwise find first active main storage
      if (mainStorageId) {
        mainStorage = await MainStorage.findById(mainStorageId);
      } else {
        mainStorage = await MainStorage.findOne({ isActive: true });
      }

      if (!mainStorage) {
        return res.status(404).json({
          success: false,
          message: 'Main storage not found. Sub pumps must be restocked from main storage.'
        });
      }

      // Check if main storage has enough fuel
      if (mainStorage.currentFuelLevel < quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient fuel in main storage. Available: ${mainStorage.currentFuelLevel}L, Required: ${quantity}L`
        });
      }

      // Decrement main storage fuel level
      mainStorage.currentFuelLevel -= quantity;
      
      // Update main storage current reading if it exists
      if (mainStorage.currentReading && mainStorage.currentReading.value) {
        // Calculate new reading based on fuel level (assuming linear relationship)
        // This is a simplified calculation - adjust based on your actual scale reading logic
        const fuelLevelRatio = mainStorage.currentFuelLevel / mainStorage.totalCapacity;
        if (mainStorage.scaleType === 'mm') {
          // For mm scale, you might need to adjust this calculation based on your tank dimensions
          // For now, we'll just update the value proportionally
          const previousReading = mainStorage.currentReading.value;
          const readingDecrease = (quantity / mainStorage.totalCapacity) * previousReading;
          mainStorage.currentReading.value = Math.max(0, previousReading - readingDecrease);
        }
        mainStorage.currentReading.date = new Date();
      }

      // Save the updated main storage
      await mainStorage.save();
    }

    // Check if restock would exceed total capacity
    const newFuelLevel = subPump.currentFuelLevel + quantity;
    if (newFuelLevel > subPump.totalCapacity) {
      const availableCapacity = subPump.totalCapacity - subPump.currentFuelLevel;
      return res.status(400).json({
        success: false,
        message: `Restock quantity exceeds total capacity. Current: ${subPump.currentFuelLevel}L, Capacity: ${subPump.totalCapacity}L, Available: ${availableCapacity}L, Requested: ${quantity}L`
      });
    }

    // Update sub pump fuel level
    subPump.totalAdded += quantity;
    subPump.currentFuelLevel += quantity; // Add the restocked quantity to current fuel level
    
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
      quantity,
      scaleReading: scaleReading || subPump.currentReading.value,
      image,
      source,
      operator: req.user._id,
      notes
    };

    const restock = new FuelRestock(restockData);
    await restock.save();

    // Log activity
    const activityMessage = mainStorage 
      ? `${quantity}L transferred from ${mainStorage.name} to ${subPump.name}`
      : `${quantity}L added to ${subPump.name}`;
    
    await logActivity({
      user: req.user,
      action: 'fuel_sub_pump_restocked',
      category: 'fuel',
      title: 'Sub Pump Restocked',
      message: activityMessage,
      entityType: 'sub_pump',
      entityId: subPump._id,
      entityName: subPump.name,
      metadata: {
        quantity,
        scaleReading,
        source,
        fromMainStorage: !!mainStorage,
        mainStorageId: mainStorage ? mainStorage._id : null,
        mainStorageName: mainStorage ? mainStorage.name : null
      },
      ...getActivityStyle('fuel_sub_pump_restocked'),
      req
    });

    res.status(201).json({
      success: true,
      message: mainStorage 
        ? `Sub pump restocked successfully. ${quantity}L transferred from ${mainStorage.name}`
        : 'Sub pump restocked successfully',
      data: { 
        restock, 
        subPump,
        mainStorage: mainStorage ? {
          _id: mainStorage._id,
          name: mainStorage.name,
          currentFuelLevel: mainStorage.currentFuelLevel
        } : null
      }
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
router.post('/sub-pumps/:id/daily-reading', authenticateToken, requirePermission('fuel.reading'), async (req, res) => {
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
router.post('/refuel', authenticateToken, requirePermission('fuel.refuel'), async (req, res) => {
  try {
    const {
      vehicleId,
      pumpType,
      pumpId,
      quantity,
      images,
      odometerReading,
      odometerType,
      operator,
      shift,
      notes
    } = req.body;

    // Validate vehicle exists
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
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

    // Get previous odometer reading for efficiency calculation
    const previousOdometer = vehicle.fuelEfficiency.currentOdometer;
    const previousRefueling = await VehicleRefueling.findOne({ vehicleId })
      .sort({ date: -1 });

    // Create refueling record
    const refuelingData = {
      vehicleId,
      pumpType,
      pumpId,
      pumpTypeModel: pumpType === 'main' ? 'MainStorage' : 'SubPump',
      quantity,
      images,
      odometerReading,
      odometerType,
      operator,
      shift,
      notes,
      previousOdometer: previousRefueling ? previousRefueling.odometerReading : previousOdometer
    };

    const refueling = new VehicleRefueling(refuelingData);
    
    // Calculate fuel efficiency
    if (previousRefueling) {
      const efficiency = refueling.calculateEfficiency(previousRefueling.odometerReading);
      refueling.fuelEfficiency = efficiency;
    }

    await refueling.save();

    // Update vehicle fuel efficiency data
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

    // Update pump fuel level
    pump.currentFuelLevel -= quantity;
    pump.totalDispensed += quantity;
    await pump.save();

    // Log activity
    await logActivity({
      user: req.user,
      action: 'vehicle_refueled',
      category: 'fuel',
      title: 'Vehicle Refueled',
      message: `${vehicle.vehicleNumber} refueled with ${quantity}L from ${pump.name}`,
      entityType: 'vehicle',
      entityId: vehicle._id,
      entityName: vehicle.vehicleNumber,
      metadata: {
        pumpType,
        pumpName: pump.name,
        quantity,
        odometerReading,
        efficiency: refueling.fuelEfficiency,
        operator
      },
      ...getActivityStyle('vehicle_refueled'),
      req
    });

    res.status(201).json({
      success: true,
      message: 'Vehicle refueled successfully',
      data: { refueling, vehicle, pump }
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
router.get('/refuel-history', authenticateToken, requirePermission('fuel.read'), async (req, res) => {
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

// Get vehicle refueling history
router.get('/refuel-history/:vehicleId', authenticateToken, requirePermission('fuel.read'), async (req, res) => {
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
router.get('/efficiency/:vehicleId', authenticateToken, requirePermission('fuel.read'), async (req, res) => {
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
router.get('/dashboard', authenticateToken, requirePermission('fuel.read'), async (req, res) => {
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
      .limit(10);

    // Get today's daily readings
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayReadings = await DailyReading.find({
      date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
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
        recentRefuelings,
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


