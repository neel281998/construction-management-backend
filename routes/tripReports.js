const express = require('express');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { 
  getVehicleTripStats, 
  getFleetTripStats, 
  resetDailyTripCounts 
} = require('../utils/tripTracking');
const TripHistory = require('../models/TripHistory');
const Vehicle = require('../models/Vehicle');

const router = express.Router();

// Get trip statistics for a specific vehicle
router.get('/vehicle/:vehicleId', authenticateToken, requirePermission('vehicle.read'), async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { startDate, endDate, period = '30d' } = req.query;
    
    const stats = await getVehicleTripStats(vehicleId, {
      startDate,
      endDate,
      period
    });
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get vehicle trip stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicle trip statistics'
    });
  }
});

// Get fleet-wide trip statistics
router.get('/fleet', authenticateToken, requirePermission('vehicle.read'), async (req, res) => {
  try {
    const { startDate, endDate, period = '30d' } = req.query;
    
    const stats = await getFleetTripStats({
      startDate,
      endDate,
      period
    });
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get fleet trip stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fleet trip statistics'
    });
  }
});

// Get daily trip summary
router.get('/daily/:date', authenticateToken, requirePermission('vehicle.read'), async (req, res) => {
  try {
    const { date } = req.params;
    
    const summary = await TripHistory.getDailyFleetSummary(date);
    
    res.json({
      success: true,
      data: {
        date,
        summary: summary[0] || {
          totalTrips: 0,
          totalVehicles: 0,
          averageTripsPerVehicle: 0,
          maxTrips: 0,
          minTrips: 0
        }
      }
    });
  } catch (error) {
    console.error('Get daily trip summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch daily trip summary'
    });
  }
});

// Get trip trends (weekly/monthly)
router.get('/trends', authenticateToken, requirePermission('vehicle.read'), async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    const trends = await TripHistory.getTrends(period);
    
    res.json({
      success: true,
      data: {
        period,
        trends
      }
    });
  } catch (error) {
    console.error('Get trip trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trip trends'
    });
  }
});

// Get vehicle trip history
router.get('/vehicle/:vehicleId/history', authenticateToken, requirePermission('vehicle.read'), async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { startDate, endDate, limit = 100 } = req.query;
    
    const history = await TripHistory.getVehicleHistory(vehicleId, {
      startDate,
      endDate,
      limit: parseInt(limit)
    });
    
    res.json({
      success: true,
      data: {
        vehicleId,
        history
      }
    });
  } catch (error) {
    console.error('Get vehicle trip history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicle trip history'
    });
  }
});

// Get current day trip status for all vehicles
router.get('/current-day', authenticateToken, requirePermission('vehicle.read'), async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ isActive: true })
      .select('vehicleNumber type brand model tripTracking status')
      .sort({ 'tripTracking.dailyTrips': -1 });
    
    const today = new Date().toDateString();
    
    const vehicleStatus = vehicles.map(vehicle => ({
      _id: vehicle._id,
      vehicleNumber: vehicle.vehicleNumber,
      type: vehicle.type,
      brand: vehicle.brand,
      model: vehicle.model,
      status: vehicle.status,
      currentDayTrips: vehicle.tripTracking.dailyTrips,
      totalTrips: vehicle.tripTracking.totalTrips,
      lastTripDate: vehicle.tripTracking.lastTripDate
    }));
    
    const totalTripsToday = vehicles.reduce((sum, vehicle) => sum + vehicle.tripTracking.dailyTrips, 0);
    const activeVehicles = vehicles.filter(vehicle => vehicle.tripTracking.dailyTrips > 0).length;
    
    res.json({
      success: true,
      data: {
        date: today,
        summary: {
          totalVehicles: vehicles.length,
          activeVehicles,
          totalTripsToday,
          averageTripsPerVehicle: vehicles.length > 0 ? Math.round((totalTripsToday / vehicles.length) * 100) / 100 : 0
        },
        vehicles: vehicleStatus
      }
    });
  } catch (error) {
    console.error('Get current day trip status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch current day trip status'
    });
  }
});

// Reset daily trip counts (admin only)
router.post('/reset-daily', authenticateToken, requirePermission('admin'), async (req, res) => {
  try {
    await resetDailyTripCounts();
    
    res.json({
      success: true,
      message: 'Daily trip counts reset successfully'
    });
  } catch (error) {
    console.error('Reset daily trip counts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset daily trip counts'
    });
  }
});

// Export trip data to CSV
router.get('/export/:vehicleId', authenticateToken, requirePermission('vehicle.read'), async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { startDate, endDate, format = 'csv' } = req.query;
    
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }
    
    const history = await TripHistory.getVehicleHistory(vehicleId, {
      startDate,
      endDate,
      limit: 1000
    });
    
    if (format === 'csv') {
      // Generate CSV
      let csv = 'Date,Vehicle Number,Trip Count,Day of Week\n';
      history.forEach(record => {
        csv += `${record.formattedDate},${record.vehicleNumber},${record.tripCount},${record.dayOfWeek}\n`;
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="trip-history-${vehicle.vehicleNumber}-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } else {
      res.json({
        success: true,
        data: {
          vehicle: {
            _id: vehicle._id,
            vehicleNumber: vehicle.vehicleNumber,
            type: vehicle.type,
            brand: vehicle.brand,
            model: vehicle.model
          },
          history
        }
      });
    }
  } catch (error) {
    console.error('Export trip data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export trip data'
    });
  }
});

// Get trip performance analytics
router.get('/analytics', authenticateToken, requirePermission('vehicle.read'), async (req, res) => {
  try {
    const { period = '30d', groupBy = 'day' } = req.query;
    
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    let groupStage;
    if (groupBy === 'day') {
      groupStage = {
        _id: {
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' }
        },
        totalTrips: { $sum: '$tripCount' },
        totalVehicles: { $addToSet: '$vehicle' },
        date: { $first: '$date' }
      };
    } else if (groupBy === 'week') {
      groupStage = {
        _id: {
          year: { $year: '$date' },
          week: { $week: '$date' }
        },
        totalTrips: { $sum: '$tripCount' },
        totalVehicles: { $addToSet: '$vehicle' },
        startDate: { $min: '$date' },
        endDate: { $max: '$date' }
      };
    } else {
      groupStage = {
        _id: {
          year: { $year: '$date' },
          month: { $month: '$date' }
        },
        totalTrips: { $sum: '$tripCount' },
        totalVehicles: { $addToSet: '$vehicle' },
        month: { $first: { $month: '$date' } }
      };
    }
    
    const analytics = await TripHistory.aggregate([
      {
        $match: {
          date: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $group: groupStage
      },
      {
        $project: {
          _id: 0,
          period: groupBy === 'day' ? {
            date: {
              $dateFromParts: {
                year: '$_id.year',
                month: '$_id.month',
                day: '$_id.day'
              }
            }
          } : groupBy === 'week' ? {
            week: '$_id.week',
            year: '$_id.year',
            startDate: '$startDate',
            endDate: '$endDate'
          } : {
            month: '$_id.month',
            year: '$_id.year'
          },
          totalTrips: 1,
          activeVehicles: { $size: '$totalVehicles' },
          averageTripsPerVehicle: {
            $round: [
              { $divide: ['$totalTrips', { $size: '$totalVehicles' }] },
              2
            ]
          }
        }
      },
      {
        $sort: groupBy === 'day' ? { 'period.date': 1 } : 
               groupBy === 'week' ? { 'period.year': 1, 'period.week': 1 } :
               { 'period.year': 1, 'period.month': 1 }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        period,
        groupBy,
        analytics
      }
    });
  } catch (error) {
    console.error('Get trip analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trip analytics'
    });
  }
});

module.exports = router;
