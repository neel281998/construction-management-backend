const express = require('express');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { 
  getVehicleTripStats, 
  getFleetTripStats, 
  resetDailyTripCounts 
} = require('../utils/tripTracking');
const TripHistory = require('../models/TripHistory');
const Vehicle = require('../models/Vehicle');
const InventoryTransfer = require('../models/InventoryTransfer');
const InventoryDispatch = require('../models/InventoryDispatch');
const VehicleTrip = require('../models/VehicleTrip');
const PlantOutputDispatch = require('../models/PlantOutputDispatch');

const router = express.Router();

// Get vehicle trips with from-to locations (merged from transfers, dispatches, vehicle trips, plant output dispatches)
router.get('/vehicle-trips-from-to', authenticateToken, requirePermission('vehicle.read'), async (req, res) => {
  try {
    const { startDate, endDate, vehicleId, fromLocationId, toLocationId, itemId, tripType } = req.query;

    const now = new Date();
    const defaultEnd = new Date(now);
    defaultEnd.setHours(23, 59, 59, 999);
    const defaultStart = new Date(now);
    defaultStart.setDate(defaultStart.getDate() - 30);
    defaultStart.setHours(0, 0, 0, 0);

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.$gte = new Date(startDate + 'T00:00:00.000Z');
      dateFilter.$lte = new Date(endDate + 'T23:59:59.999Z');
    } else {
      dateFilter.$gte = defaultStart;
      dateFilter.$lte = defaultEnd;
    }

    const transferQuery = {};
    const dispatchQuery = {};
    const vehicleTripQuery = {};
    const plantOutputQuery = {};

    if (Object.keys(dateFilter).length) {
      transferQuery.tripDate = dateFilter;
      dispatchQuery.dispatchedAt = dateFilter;
      vehicleTripQuery.tripDate = dateFilter;
      plantOutputQuery.dispatchedAt = dateFilter;
    }
    if (vehicleId) {
      transferQuery['vehicle._id'] = vehicleId;
      dispatchQuery['vehicle._id'] = vehicleId;
      vehicleTripQuery['vehicle._id'] = vehicleId;
      plantOutputQuery['vehicle._id'] = vehicleId;
    }
    if (fromLocationId) {
      transferQuery['fromStorageSite._id'] = fromLocationId;
      dispatchQuery['fromStorageSite._id'] = fromLocationId;
      plantOutputQuery['fromPlant._id'] = fromLocationId;
    }
    if (toLocationId) {
      transferQuery.$or = [
        { 'toStorageSite._id': toLocationId },
        { 'toPlant._id': toLocationId },
        { 'toConstructionSite._id': toLocationId },
        { 'toConstructionStep.siteId': toLocationId },
      ];
      dispatchQuery.$or = [
        { 'destination.id': toLocationId },
        { 'destination.id': String(toLocationId) },
      ];
      vehicleTripQuery.destinationId = toLocationId;
      plantOutputQuery.$or = [
        { 'destination.id': toLocationId },
        { 'destination.id': String(toLocationId) },
      ];
    }
    if (itemId) {
      transferQuery.itemId = itemId;
      dispatchQuery.itemId = itemId;
      vehicleTripQuery.itemId = itemId;
    }
    if (tripType && tripType === 'inbound') {
      vehicleTripQuery.tripType = 'inbound';
    }

    const [transfers, dispatches, vehicleTrips, plantOutputs] = await Promise.all([
      InventoryTransfer.find(transferQuery).populate('receivedBy', 'firstName lastName').sort({ tripDate: -1, tripNumber: -1 }).limit(500),
      InventoryDispatch.find(dispatchQuery).populate('receivedBy', 'firstName lastName').sort({ dispatchedAt: -1 }).limit(500),
      VehicleTrip.find(vehicleTripQuery).sort({ tripDate: -1 }).limit(500),
      PlantOutputDispatch.find(plantOutputQuery).populate('receivedBy', 'firstName lastName').sort({ dispatchedAt: -1 }).limit(500)
    ]);

    const formatFrom = (from) => from ? (from.name || '') + (from.code ? ' (' + from.code + ')' : '') : '';
    const formatTo = (to) => (to && to.name) ? to.name : '';

    const transferRows = transfers.map(function (t) {
      var toName = '';
      if (t.toStorageSite && t.toStorageSite.name) toName = t.toStorageSite.name + (t.toStorageSite.code ? ' (' + t.toStorageSite.code + ')' : '');
      else if (t.toPlant && t.toPlant.name) toName = t.toPlant.name;
      else if (t.toConstructionSite && t.toConstructionSite.name) toName = t.toConstructionSite.name + (t.toConstructionSite.siteType ? ' - ' + t.toConstructionSite.siteType : '');
      else if (t.toConstructionStep && t.toConstructionStep.siteName) toName = (t.toConstructionStep.siteName + ' - Step ' + (t.toConstructionStep.stepNumber || '') + ' ' + (t.toConstructionStep.stepName || '')).trim();
      return {
        source: 'transfer',
        tripType: 'transfer',
        _id: t._id,
        vehicleNumber: (t.vehicle && t.vehicle.vehicleNumber) ? t.vehicle.vehicleNumber : '',
        vehicleType: (t.vehicle && t.vehicle.vehicleType) ? t.vehicle.vehicleType : '',
        driverName: (t.vehicle && t.vehicle.driverName) ? t.vehicle.driverName : '',
        from: formatFrom(t.fromStorageSite),
        fromCode: (t.fromStorageSite && t.fromStorageSite.code) ? t.fromStorageSite.code : '',
        to: toName,
        date: t.tripDate,
        itemName: t.itemName,
        quantity: t.quantity,
        unit: t.unit,
        status: t.status,
        receivedBy: (t.receivedBy && (t.receivedBy.firstName || t.receivedBy.lastName)) ? ((t.receivedBy.firstName || '') + ' ' + (t.receivedBy.lastName || '')).trim() : ''
      };
    });

    const dispatchRows = dispatches.map(function (d) {
      return {
        source: 'dispatch',
        tripType: 'outbound',
        _id: d._id,
        vehicleNumber: (d.vehicle && d.vehicle.vehicleNumber) ? d.vehicle.vehicleNumber : '',
        vehicleType: (d.vehicle && d.vehicle.vehicleType) ? d.vehicle.vehicleType : '',
        driverName: (d.vehicle && d.vehicle.driverName) ? d.vehicle.driverName : '',
        from: formatFrom(d.fromStorageSite),
        fromCode: (d.fromStorageSite && d.fromStorageSite.code) ? d.fromStorageSite.code : '',
        to: formatTo(d.destination),
        date: d.dispatchedAt,
        itemName: d.itemName,
        quantity: d.quantity,
        unit: d.unit,
        status: d.status,
        receivedBy: (d.receivedBy && (d.receivedBy.firstName || d.receivedBy.lastName)) ? ((d.receivedBy.firstName || '') + ' ' + (d.receivedBy.lastName || '')).trim() : ''
      };
    });

    const vehicleTripRows = vehicleTrips.map(function (vt) {
      return {
        source: 'vehicle_trip',
        tripType: 'inbound',
        _id: vt._id,
        vehicleNumber: (vt.vehicle && vt.vehicle.vehicleNumber) ? vt.vehicle.vehicleNumber : '',
        vehicleType: (vt.vehicle && vt.vehicle.vehicleType) ? vt.vehicle.vehicleType : '',
        driverName: (vt.vehicle && vt.vehicle.driverName) ? vt.vehicle.driverName : '',
        from: vt.sourceName || 'Supplier',
        fromCode: '',
        to: vt.destinationName || '',
        date: vt.tripDate,
        itemName: vt.itemName,
        quantity: vt.quantity,
        unit: vt.unit,
        status: 'received',
        receivedBy: (vt.receivedBy && (vt.receivedBy.firstName || vt.receivedBy.lastName)) ? ((vt.receivedBy.firstName || '') + ' ' + (vt.receivedBy.lastName || '')).trim() : ''
      };
    });

    const plantOutputRows = plantOutputs.map(function (po) {
      var toName = (po.destination && po.destination.name) ? po.destination.name : '';
      return {
        source: 'plant_output',
        tripType: 'outbound',
        _id: po._id,
        vehicleNumber: (po.vehicle && po.vehicle.vehicleNumber) ? po.vehicle.vehicleNumber : '',
        vehicleType: (po.vehicle && po.vehicle.vehicleType) ? po.vehicle.vehicleType : '',
        driverName: (po.vehicle && po.vehicle.driverName) ? po.vehicle.driverName : '',
        from: (po.fromPlant && po.fromPlant.name) ? po.fromPlant.name : '',
        fromCode: '',
        to: toName,
        date: po.dispatchedAt,
        itemName: po.outputName || po.materialName || '',
        quantity: po.quantity,
        unit: po.unit,
        status: po.status,
        receivedBy: (po.receivedBy && (po.receivedBy.firstName || po.receivedBy.lastName)) ? ((po.receivedBy.firstName || '') + ' ' + (po.receivedBy.lastName || '')).trim() : ''
      };
    });

    var merged = transferRows.concat(dispatchRows).concat(vehicleTripRows).concat(plantOutputRows);
    if (tripType && tripType !== 'all') {
      merged = merged.filter(function (r) { return r.tripType === tripType; });
    }
    merged.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

    res.json({
      success: true,
      data: {
        trips: merged,
        totalCount: merged.length,
      },
    });
  } catch (error) {
    console.error('Get vehicle trips from-to error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicle trips report',
    });
  }
});

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
