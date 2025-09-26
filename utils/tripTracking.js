const Vehicle = require('../models/Vehicle');
const TripHistory = require('../models/TripHistory');

/**
 * Increment trip count for a vehicle when delivery is completed
 * @param {string} vehicleId - Vehicle ID
 * @param {Object} tripData - Trip details
 * @returns {Promise<Object>} Updated vehicle with trip data
 */
async function incrementTripCount(vehicleId, tripData = {}) {
  try {
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    const today = new Date();
    const lastTripDate = new Date(vehicle.tripTracking.lastTripDate);
    
    // Check if it's a new day - reset daily trips if so
    const isNewDay = today.toDateString() !== lastTripDate.toDateString();
    
    if (isNewDay) {
      // Save yesterday's trip count to history before resetting
      if (vehicle.tripTracking.dailyTrips > 0) {
        await saveTripHistory(vehicle._id, {
          date: lastTripDate,
          tripCount: vehicle.tripTracking.dailyTrips,
          vehicleNumber: vehicle.vehicleNumber
        });
      }
      
      // Reset daily trips for new day
      vehicle.tripTracking.dailyTrips = 0;
      vehicle.tripTracking.lastTripDate = today;
    }

    // Increment trip counts
    vehicle.tripTracking.dailyTrips += 1;
    vehicle.tripTracking.totalTrips += 1;
    vehicle.tripTracking.currentTrip = null; // Clear current trip as it's completed

    await vehicle.save();

    console.log(`Trip count updated for vehicle ${vehicle.vehicleNumber}:`, {
      dailyTrips: vehicle.tripTracking.dailyTrips,
      totalTrips: vehicle.tripTracking.totalTrips,
      date: today.toDateString()
    });

    return vehicle;
  } catch (error) {
    console.error('Error incrementing trip count:', error);
    throw error;
  }
}

/**
 * Save trip history for a specific date
 * @param {string} vehicleId - Vehicle ID
 * @param {Object} historyData - History data
 */
async function saveTripHistory(vehicleId, historyData) {
  try {
    const tripHistory = new TripHistory({
      vehicle: vehicleId,
      date: historyData.date,
      tripCount: historyData.tripCount,
      vehicleNumber: historyData.vehicleNumber
    });
    
    await tripHistory.save();
    console.log(`Trip history saved for vehicle ${historyData.vehicleNumber} on ${historyData.date}`);
  } catch (error) {
    console.error('Error saving trip history:', error);
    // Don't throw error as this is not critical
  }
}

/**
 * Reset daily trip count for all vehicles (called at midnight)
 */
async function resetDailyTripCounts() {
  try {
    const vehicles = await Vehicle.find({ isActive: true });
    const today = new Date();
    
    for (const vehicle of vehicles) {
      if (vehicle.tripTracking.dailyTrips > 0) {
        // Save yesterday's trip count to history
        await saveTripHistory(vehicle._id, {
          date: vehicle.tripTracking.lastTripDate,
          tripCount: vehicle.tripTracking.dailyTrips,
          vehicleNumber: vehicle.vehicleNumber
        });
      }
      
      // Reset daily trips
      vehicle.tripTracking.dailyTrips = 0;
      vehicle.tripTracking.lastTripDate = today;
      await vehicle.save();
    }
    
    console.log(`Daily trip counts reset for ${vehicles.length} vehicles`);
  } catch (error) {
    console.error('Error resetting daily trip counts:', error);
    throw error;
  }
}

/**
 * Get trip statistics for a vehicle
 * @param {string} vehicleId - Vehicle ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Trip statistics
 */
async function getVehicleTripStats(vehicleId, options = {}) {
  try {
    const { startDate, endDate, period = '30d' } = options;
    
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    // Calculate date range
    let dateRange = {};
    if (startDate && endDate) {
      dateRange = {
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    } else {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      dateRange = {
        date: {
          $gte: startDate,
          $lte: endDate
        }
      };
    }

    // Get trip history
    const tripHistory = await TripHistory.find({
      vehicle: vehicleId,
      ...dateRange
    }).sort({ date: -1 });

    // Calculate statistics
    const totalTrips = tripHistory.reduce((sum, record) => sum + record.tripCount, 0);
    const averageTripsPerDay = tripHistory.length > 0 ? totalTrips / tripHistory.length : 0;
    const maxTripsInDay = Math.max(...tripHistory.map(record => record.tripCount), 0);
    
    // Get current day's trips
    const today = new Date().toDateString();
    const todayRecord = tripHistory.find(record => 
      new Date(record.date).toDateString() === today
    );
    const todayTrips = todayRecord ? todayRecord.tripCount : vehicle.tripTracking.dailyTrips;

    return {
      vehicle: {
        _id: vehicle._id,
        vehicleNumber: vehicle.vehicleNumber,
        type: vehicle.type,
        brand: vehicle.brand,
        model: vehicle.model
      },
      currentDay: {
        trips: todayTrips,
        date: today
      },
      lifetime: {
        totalTrips: vehicle.tripTracking.totalTrips
      },
      period: {
        totalTrips,
        averageTripsPerDay: Math.round(averageTripsPerDay * 100) / 100,
        maxTripsInDay,
        daysWithTrips: tripHistory.length,
        tripHistory: tripHistory.map(record => ({
          date: record.date,
          tripCount: record.tripCount
        }))
      }
    };
  } catch (error) {
    console.error('Error getting vehicle trip stats:', error);
    throw error;
  }
}

/**
 * Get fleet-wide trip statistics
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Fleet statistics
 */
async function getFleetTripStats(options = {}) {
  try {
    const { startDate, endDate, period = '30d' } = options;
    
    // Calculate date range
    let dateRange = {};
    if (startDate && endDate) {
      dateRange = {
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    } else {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      dateRange = {
        date: {
          $gte: startDate,
          $lte: endDate
        }
      };
    }

    // Get all vehicles
    const vehicles = await Vehicle.find({ isActive: true });
    
    // Get trip history for all vehicles
    const tripHistory = await TripHistory.find(dateRange).sort({ date: -1 });
    
    // Calculate fleet statistics
    const totalTrips = tripHistory.reduce((sum, record) => sum + record.tripCount, 0);
    const averageTripsPerDay = tripHistory.length > 0 ? totalTrips / tripHistory.length : 0;
    
    // Get today's total trips
    const today = new Date().toDateString();
    const todayTrips = vehicles.reduce((sum, vehicle) => sum + vehicle.tripTracking.dailyTrips, 0);
    
    // Top performing vehicles
    const vehicleStats = await Promise.all(
      vehicles.map(async (vehicle) => {
        const vehicleHistory = tripHistory.filter(record => 
          record.vehicle.toString() === vehicle._id.toString()
        );
        const vehicleTotalTrips = vehicleHistory.reduce((sum, record) => sum + record.tripCount, 0);
        
        return {
          vehicle: {
            _id: vehicle._id,
            vehicleNumber: vehicle.vehicleNumber,
            type: vehicle.type,
            brand: vehicle.brand,
            model: vehicle.model
          },
          currentDayTrips: vehicle.tripTracking.dailyTrips,
          periodTrips: vehicleTotalTrips,
          lifetimeTrips: vehicle.tripTracking.totalTrips
        };
      })
    );
    
    // Sort by period trips (descending)
    vehicleStats.sort((a, b) => b.periodTrips - a.periodTrips);
    
    return {
      summary: {
        totalVehicles: vehicles.length,
        currentDayTrips: todayTrips,
        periodTotalTrips: totalTrips,
        averageTripsPerDay: Math.round(averageTripsPerDay * 100) / 100,
        period: period
      },
      topPerformers: vehicleStats.slice(0, 10), // Top 10 vehicles
      allVehicles: vehicleStats
    };
  } catch (error) {
    console.error('Error getting fleet trip stats:', error);
    throw error;
  }
}

module.exports = {
  incrementTripCount,
  saveTripHistory,
  resetDailyTripCounts,
  getVehicleTripStats,
  getFleetTripStats
};
