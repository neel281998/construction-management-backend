const express = require('express');
const router = express.Router();
const FuelLog = require('../models/FuelLog');
const { authenticateToken, requirePermission, requireFuelAccess } = require('../middleware/auth');

router.use(authenticateToken, requireFuelAccess);

// Get all fuel logs
router.get('/', async (req, res) => {
  try {
    const { 
      vehicleId, 
      storageId, 
      fuelType, 
      startDate, 
      endDate,
      page = 1,
      limit = 20
    } = req.query;

    const filter = {};
    if (vehicleId) filter.vehicleId = vehicleId;
    if (storageId) filter.storageId = storageId;
    if (fuelType) filter.fuelType = fuelType;
    
    if (startDate || endDate) {
      filter.fuelDate = {};
      if (startDate) filter.fuelDate.$gte = new Date(startDate);
      if (endDate) filter.fuelDate.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    
    const logs = await FuelLog.find(filter)
      .populate('vehicleId', 'vehicleNumber make model')
      .populate('storageId', 'name location fuelType')
      .populate('filledBy', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName email')
      .sort({ fuelDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await FuelLog.countDocuments(filter);

    res.json({
      success: true,
      data: logs,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching fuel logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fuel logs',
      error: error.message
    });
  }
});

// Get single fuel log
router.get('/:id', async (req, res) => {
  try {
    const log = await FuelLog.findById(req.params.id)
      .populate('vehicleId', 'vehicleNumber make model')
      .populate('storageId', 'name location fuelType')
      .populate('filledBy', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName email');

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Fuel log not found'
      });
    }

    res.json({
      success: true,
      data: log
    });
  } catch (error) {
    console.error('Error fetching fuel log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fuel log',
      error: error.message
    });
  }
});

// Create new fuel log (manual entry)
router.post('/', requirePermission('fuel.log'), async (req, res) => {
  try {
    const {
      vehicleId,
      storageId,
      fuelType,
      quantityLiters,
      odometerReading,
      previousOdometerReading,
      notes,
      costPerLiter,
      location,
      coordinates
    } = req.body;

    // Validate required fields
    if (!vehicleId || !storageId || !quantityLiters || !odometerReading) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle, storage, quantity, and odometer reading are required'
      });
    }

    const log = new FuelLog({
      vehicleId,
      storageId,
      fuelType,
      quantityLiters,
      odometerReading,
      previousOdometerReading,
      notes,
      costPerLiter,
      location,
      coordinates,
      filledBy: req.user._id,
      status: 'completed'
    });

    await log.save();

    await log.populate([
      { path: 'vehicleId', select: 'vehicleNumber make model' },
      { path: 'storageId', select: 'name location fuelType' },
      { path: 'filledBy', select: 'firstName lastName email' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Fuel log created successfully',
      data: log
    });
  } catch (error) {
    console.error('Error creating fuel log:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to create fuel log',
      error: error.message
    });
  }
});

// Update fuel log
router.put('/:id', requirePermission('fuel.update'), async (req, res) => {
  try {
    const log = await FuelLog.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate([
      { path: 'vehicleId', select: 'vehicleNumber make model' },
      { path: 'storageId', select: 'name location fuelType' },
      { path: 'filledBy', select: 'firstName lastName email' },
      { path: 'approvedBy', select: 'firstName lastName email' }
    ]);

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Fuel log not found'
      });
    }

    res.json({
      success: true,
      message: 'Fuel log updated successfully',
      data: log
    });
  } catch (error) {
    console.error('Error updating fuel log:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to update fuel log',
      error: error.message
    });
  }
});

// Delete fuel log
router.delete('/:id', requirePermission('fuel.delete'), async (req, res) => {
  try {
    const log = await FuelLog.findByIdAndDelete(req.params.id);
    
    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Fuel log not found'
      });
    }

    res.json({
      success: true,
      message: 'Fuel log deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting fuel log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete fuel log',
      error: error.message
    });
  }
});

// Get fuel consumption report
router.get('/reports/consumption', async (req, res) => {
  try {
    const { 
      vehicleId, 
      startDate, 
      endDate,
      groupBy = 'day' // day, week, month
    } = req.query;

    const filter = { status: 'completed' };
    if (vehicleId) filter.vehicleId = vehicleId;
    
    if (startDate || endDate) {
      filter.fuelDate = {};
      if (startDate) filter.fuelDate.$gte = new Date(startDate);
      if (endDate) filter.fuelDate.$lte = new Date(endDate);
    }

    let groupFormat;
    switch (groupBy) {
      case 'day':
        groupFormat = '%Y-%m-%d';
        break;
      case 'week':
        groupFormat = '%Y-%U';
        break;
      case 'month':
        groupFormat = '%Y-%m';
        break;
      default:
        groupFormat = '%Y-%m-%d';
    }

    const consumption = await FuelLog.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            $dateToString: { format: groupFormat, date: '$fuelDate' }
          },
          totalLiters: { $sum: '$quantityLiters' },
          totalCost: { $sum: '$totalCost' },
          totalDistance: { $sum: '$distanceTraveled' },
          avgEfficiency: { $avg: '$fuelEfficiency' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get vehicle-specific data if requested
    let vehicleData = null;
    if (vehicleId) {
      vehicleData = await FuelLog.aggregate([
        { $match: { ...filter, vehicleId: new mongoose.Types.ObjectId(vehicleId) } },
        {
          $group: {
            _id: null,
            totalLiters: { $sum: '$quantityLiters' },
            totalCost: { $sum: '$totalCost' },
            totalDistance: { $sum: '$distanceTraveled' },
            avgEfficiency: { $avg: '$fuelEfficiency' },
            count: { $sum: 1 }
          }
        }
      ]);
    }

    res.json({
      success: true,
      data: {
        consumption,
        vehicleData: vehicleData?.[0] || null
      }
    });
  } catch (error) {
    console.error('Error fetching consumption report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch consumption report',
      error: error.message
    });
  }
});

// Get fuel efficiency report
router.get('/reports/efficiency', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const filter = { 
      status: 'completed',
      fuelEfficiency: { $gt: 0 }
    };
    
    if (startDate || endDate) {
      filter.fuelDate = {};
      if (startDate) filter.fuelDate.$gte = new Date(startDate);
      if (endDate) filter.fuelDate.$lte = new Date(endDate);
    }

    const efficiency = await FuelLog.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$vehicleId',
          avgEfficiency: { $avg: '$fuelEfficiency' },
          totalLiters: { $sum: '$quantityLiters' },
          totalDistance: { $sum: '$distanceTraveled' },
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'vehicles',
          localField: '_id',
          foreignField: '_id',
          as: 'vehicle'
        }
      },
      {
        $unwind: '$vehicle'
      },
      {
        $project: {
          vehicleNumber: '$vehicle.vehicleNumber',
          make: '$vehicle.make',
          model: '$vehicle.model',
          avgEfficiency: { $round: ['$avgEfficiency', 2] },
          totalLiters: { $round: ['$totalLiters', 2] },
          totalDistance: { $round: ['$totalDistance', 2] },
          count: 1
        }
      },
      { $sort: { avgEfficiency: -1 } }
    ]);

    res.json({
      success: true,
      data: efficiency
    });
  } catch (error) {
    console.error('Error fetching efficiency report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch efficiency report',
      error: error.message
    });
  }
});

// Refuel vehicle from sub storage (Admin, Fuel Sub Manager)
router.post('/refuel-vehicle', async (req, res) => {
  // Check if user has fuel management role
  if (!['admin', 'fuel_sub_manager'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Fuel sub manager role required.'
    });
  }
  try {
    const { 
      vehicleId, 
      subStorageId, 
      fuelAmount, 
      odometerReading, 
      notes 
    } = req.body;
    const userId = req.user.id;

    if (!vehicleId || !subStorageId || !fuelAmount || fuelAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle ID, sub storage ID, and valid fuel amount are required'
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

    // Check if sub storage has enough fuel
    if (subStorage.currentReading < fuelAmount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient fuel in sub storage'
      });
    }

    // Get vehicle (assuming Vehicle model exists)
    const Vehicle = require('../models/Vehicle');
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    // Create fuel log
    const fuelLog = new FuelLog({
      vehicleId: vehicleId,
      storageId: subStorageId,
      fuelType: subStorage.fuelType,
      fuelAmount: fuelAmount,
      fuelDate: new Date(),
      odometerReading: odometerReading || 0,
      filledBy: userId,
      status: 'completed',
      notes: notes || `Refueled from ${subStorage.name}`,
      refuelLocation: subStorage.location
    });

    await fuelLog.save();

    // Update sub storage fuel level
    subStorage.currentReading -= fuelAmount;
    subStorage.lastUpdatedBy = userId;
    await subStorage.save();

    // Populate the response
    await fuelLog.populate([
      { path: 'vehicleId', select: 'vehicleNumber make model' },
      { path: 'storageId', select: 'name location fuelType' },
      { path: 'filledBy', select: 'firstName lastName email' }
    ]);

    res.json({
      success: true,
      message: 'Vehicle refueled successfully',
      data: fuelLog
    });
  } catch (error) {
    console.error('Error refueling vehicle:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refuel vehicle',
      error: error.message
    });
  }
});

// Get fuel consumption report for vehicles
router.get('/consumption-report', async (req, res) => {
  try {
    const { 
      vehicleId, 
      startDate, 
      endDate,
      groupBy = 'daily' // daily, weekly, monthly
    } = req.query;

    const matchStage = { status: 'completed' };
    if (vehicleId) matchStage.vehicleId = vehicleId;
    
    if (startDate || endDate) {
      matchStage.fuelDate = {};
      if (startDate) matchStage.fuelDate.$gte = new Date(startDate);
      if (endDate) matchStage.fuelDate.$lte = new Date(endDate);
    }

    let groupStage;
    switch (groupBy) {
      case 'daily':
        groupStage = {
          _id: {
            year: { $year: '$fuelDate' },
            month: { $month: '$fuelDate' },
            day: { $dayOfMonth: '$fuelDate' }
          },
          totalFuel: { $sum: '$fuelAmount' },
          refuelCount: { $sum: 1 },
          vehicles: { $addToSet: '$vehicleId' }
        };
        break;
      case 'weekly':
        groupStage = {
          _id: {
            year: { $year: '$fuelDate' },
            week: { $week: '$fuelDate' }
          },
          totalFuel: { $sum: '$fuelAmount' },
          refuelCount: { $sum: 1 },
          vehicles: { $addToSet: '$vehicleId' }
        };
        break;
      case 'monthly':
        groupStage = {
          _id: {
            year: { $year: '$fuelDate' },
            month: { $month: '$fuelDate' }
          },
          totalFuel: { $sum: '$fuelAmount' },
          refuelCount: { $sum: 1 },
          vehicles: { $addToSet: '$vehicleId' }
        };
        break;
    }

    const report = await FuelLog.aggregate([
      { $match: matchStage },
      { $group: groupStage },
      { $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 } }
    ]);

    res.json({
      success: true,
      data: report,
      groupBy: groupBy
    });
  } catch (error) {
    console.error('Error generating consumption report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate consumption report',
      error: error.message
    });
  }
});

module.exports = router;
