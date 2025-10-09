const express = require('express');
const mongoose = require('mongoose');
const VehicleAnalytics = require('../models/VehicleAnalytics');
const Vehicle = require('../models/Vehicle');
const { authenticateToken, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get analytics for a specific vehicle
router.get('/vehicle/:vehicleId', authenticateToken, requirePermission('vehicle.read'), async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { 
      startDate, 
      endDate, 
      page = 1, 
      limit = 30,
      includeImages = false 
    } = req.query;

    // Build date filter
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Build query
    const query = { 
      vehicleId, 
      status: 'completed',
      ...dateFilter 
    };

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [analytics, totalCount] = await Promise.all([
      VehicleAnalytics.find(query)
        .populate('driver', 'firstName lastName')
        .populate('verifiedBy', 'firstName lastName')
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select(includeImages === 'true' ? '' : '-images'),
      VehicleAnalytics.countDocuments(query)
    ]);

    // Calculate summary statistics
    const summary = await VehicleAnalytics.aggregate([
      { $match: { vehicleId: mongoose.Types.ObjectId(vehicleId), status: 'completed', ...dateFilter } },
      {
        $group: {
          _id: null,
          totalDays: { $sum: 1 },
          totalMileage: { $sum: '$dailyMileage' },
          totalHours: { $sum: '$dailyHours' },
          avgMileage: { $avg: '$dailyMileage' },
          avgHours: { $avg: '$dailyHours' },
          totalFuelConsumed: { $sum: '$fuelConsumed' },
          avgFuelEfficiency: { $avg: '$fuelEfficiency' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        analytics,
        summary: summary[0] || {
          totalDays: 0,
          totalMileage: 0,
          totalHours: 0,
          avgMileage: 0,
          avgHours: 0,
          totalFuelConsumed: 0,
          avgFuelEfficiency: 0
        },
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + analytics.length < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Get vehicle analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicle analytics'
    });
  }
});

// Add daily reading
router.post('/daily-reading', authenticateToken, requirePermission('vehicle.update'), async (req, res) => {
  try {
    const {
      vehicleId,
      startingOdometer,
      endingOdometer,
      startingHours,
      endingHours,
      fuelConsumed,
      notes,
      weather,
      driver,
      route,
      vehicleCondition,
      issues,
      images
    } = req.body;

    // Validate required fields
    if (!vehicleId || startingOdometer === undefined || endingOdometer === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle ID, starting odometer, and ending odometer are required'
      });
    }

    // Check if vehicle exists
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    // Calculate daily mileage and hours
    const dailyMileage = endingOdometer - startingOdometer;
    const dailyHours = endingHours ? endingHours - (startingHours || 0) : 0;
    const fuelEfficiency = fuelConsumed && dailyMileage > 0 ? dailyMileage / fuelConsumed : 0;

    // Create analytics record
    const analytics = new VehicleAnalytics({
      vehicleId,
      startingOdometer,
      endingOdometer,
      startingHours,
      endingHours,
      dailyMileage,
      dailyHours,
      fuelConsumed,
      fuelEfficiency,
      notes,
      weather,
      driver,
      route,
      vehicleCondition,
      issues,
      images,
      status: 'completed',
      verified: true,
      verifiedBy: req.user._id,
      verifiedAt: new Date()
    });

    await analytics.save();

    // Update vehicle's current odometer reading
    vehicle.maintenanceSchedule.mileage = endingOdometer;
    await vehicle.save();

    res.status(201).json({
      success: true,
      message: 'Daily reading added successfully',
      data: { analytics }
    });

  } catch (error) {
    console.error('Add daily reading error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to add daily reading'
    });
  }
});

// Get analytics summary for dashboard
router.get('/summary/:vehicleId', authenticateToken, requirePermission('vehicle.read'), async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { period = '30' } = req.query; // days

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const summary = await VehicleAnalytics.aggregate([
      { 
        $match: { 
          vehicleId: mongoose.Types.ObjectId(vehicleId), 
          status: 'completed',
          date: { $gte: startDate }
        } 
      },
      {
        $group: {
          _id: null,
          totalDays: { $sum: 1 },
          totalMileage: { $sum: '$dailyMileage' },
          totalHours: { $sum: '$dailyHours' },
          avgMileage: { $avg: '$dailyMileage' },
          avgHours: { $avg: '$dailyHours' },
          totalFuelConsumed: { $sum: '$fuelConsumed' },
          avgFuelEfficiency: { $avg: '$fuelEfficiency' },
          lastReading: { $max: '$date' },
          lastOdometer: { $max: '$endingOdometer' }
        }
      }
    ]);

    // Get recent readings
    const recentReadings = await VehicleAnalytics.find({
      vehicleId,
      status: 'completed'
    })
    .sort({ date: -1 })
    .limit(7)
    .select('date startingOdometer endingOdometer dailyMileage dailyHours fuelConsumed notes');

    res.json({
      success: true,
      data: {
        summary: summary[0] || {
          totalDays: 0,
          totalMileage: 0,
          totalHours: 0,
          avgMileage: 0,
          avgHours: 0,
          totalFuelConsumed: 0,
          avgFuelEfficiency: 0,
          lastReading: null,
          lastOdometer: 0
        },
        recentReadings
      }
    });

  } catch (error) {
    console.error('Get analytics summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics summary'
    });
  }
});

// Update daily reading
router.put('/:id', authenticateToken, requirePermission('vehicle.update'), async (req, res) => {
  try {
    const analytics = await VehicleAnalytics.findById(req.params.id);
    
    if (!analytics) {
      return res.status(404).json({
        success: false,
        message: 'Analytics record not found'
      });
    }

    // Update fields
    Object.assign(analytics, req.body);
    
    // Recalculate derived fields
    if (analytics.endingOdometer && analytics.startingOdometer) {
      analytics.dailyMileage = analytics.endingOdometer - analytics.startingOdometer;
    }
    
    if (analytics.endingHours && analytics.startingHours) {
      analytics.dailyHours = analytics.endingHours - analytics.startingHours;
    }
    
    if (analytics.fuelConsumed && analytics.dailyMileage > 0) {
      analytics.fuelEfficiency = analytics.dailyMileage / analytics.fuelConsumed;
    }

    await analytics.save();

    res.json({
      success: true,
      message: 'Daily reading updated successfully',
      data: { analytics }
    });

  } catch (error) {
    console.error('Update daily reading error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update daily reading'
    });
  }
});

// Delete daily reading
router.delete('/:id', authenticateToken, requirePermission('vehicle.delete'), async (req, res) => {
  try {
    const analytics = await VehicleAnalytics.findById(req.params.id);
    
    if (!analytics) {
      return res.status(404).json({
        success: false,
        message: 'Analytics record not found'
      });
    }

    await VehicleAnalytics.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Daily reading deleted successfully'
    });

  } catch (error) {
    console.error('Delete daily reading error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete daily reading'
    });
  }
});

module.exports = router;
