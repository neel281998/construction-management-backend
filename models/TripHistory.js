const mongoose = require('mongoose');

const tripHistorySchema = new mongoose.Schema({
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: [true, 'Vehicle reference is required']
  },
  vehicleNumber: {
    type: String,
    required: [true, 'Vehicle number is required'],
    trim: true,
    uppercase: true
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    index: true
  },
  tripCount: {
    type: Number,
    required: [true, 'Trip count is required'],
    min: [0, 'Trip count cannot be negative'],
    default: 0
  },
  // Additional trip details
  tripDetails: [{
    dispatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryDispatch'
    },
    destination: {
      type: String,
      enum: ['construction_site', 'storage_site', 'construction_step', 'plant']
    },
    destinationName: String,
    completedAt: {
      type: Date,
      default: Date.now
    },
    distance: Number, // in km (if available)
    duration: Number, // in minutes (if available)
    notes: String
  }],
  // Performance metrics
  performance: {
    averageTripDuration: Number, // in minutes
    totalDistance: Number, // in km
    efficiency: Number // trips per hour
  },
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index for efficient queries
tripHistorySchema.index({ vehicle: 1, date: -1 });
tripHistorySchema.index({ date: -1 });
tripHistorySchema.index({ vehicleNumber: 1, date: -1 });

// Virtual for formatted date
tripHistorySchema.virtual('formattedDate').get(function() {
  return this.date.toLocaleDateString();
});

// Virtual for day of week
tripHistorySchema.virtual('dayOfWeek').get(function() {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[this.date.getDay()];
});

// Static method to get trip history for a vehicle
tripHistorySchema.statics.getVehicleHistory = function(vehicleId, options = {}) {
  const { startDate, endDate, limit = 100 } = options;
  
  let query = { vehicle: vehicleId };
  
  if (startDate && endDate) {
    query.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.find(query)
    .sort({ date: -1 })
    .limit(limit)
    .populate('vehicle', 'vehicleNumber type brand model');
};

// Static method to get daily fleet summary
tripHistorySchema.statics.getDailyFleetSummary = function(date) {
  const targetDate = new Date(date);
  const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
  const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
  
  return this.aggregate([
    {
      $match: {
        date: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      }
    },
    {
      $group: {
        _id: null,
        totalTrips: { $sum: '$tripCount' },
        totalVehicles: { $addToSet: '$vehicle' },
        averageTripsPerVehicle: { $avg: '$tripCount' },
        maxTrips: { $max: '$tripCount' },
        minTrips: { $min: '$tripCount' }
      }
    },
    {
      $project: {
        _id: 0,
        totalTrips: 1,
        totalVehicles: { $size: '$totalVehicles' },
        averageTripsPerVehicle: { $round: ['$averageTripsPerVehicle', 2] },
        maxTrips: 1,
        minTrips: 1
      }
    }
  ]);
};

// Static method to get weekly/monthly trends
tripHistorySchema.statics.getTrends = function(period = '30d') {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        date: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' }
        },
        totalTrips: { $sum: '$tripCount' },
        totalVehicles: { $addToSet: '$vehicle' }
      }
    },
    {
      $project: {
        _id: 0,
        date: {
          $dateFromParts: {
            year: '$_id.year',
            month: '$_id.month',
            day: '$_id.day'
          }
        },
        totalTrips: 1,
        activeVehicles: { $size: '$totalVehicles' }
      }
    },
    {
      $sort: { date: 1 }
    }
  ]);
};

module.exports = mongoose.model('TripHistory', tripHistorySchema);
