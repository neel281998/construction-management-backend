const mongoose = require('mongoose');

const vehicleAnalyticsSchema = new mongoose.Schema({
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  // Daily readings
  startingOdometer: {
    type: Number,
    required: true,
    min: 0
  },
  endingOdometer: {
    type: Number,
    required: true,
    min: 0
  },
  // For heavy vehicles that run on hours
  startingHours: {
    type: Number,
    min: 0
  },
  endingHours: {
    type: Number,
    min: 0
  },
  // Calculated fields
  dailyMileage: {
    type: Number,
    default: 0
  },
  dailyHours: {
    type: Number,
    default: 0
  },
  // Fuel consumption
  fuelConsumed: {
    type: Number,
    min: 0
  },
  fuelEfficiency: {
    type: Number,
    min: 0
  },
  // Images for daily readings
  images: [{
    fileId: String, // GridFS file ID
    fileName: String,
    fileType: String,
    caption: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Notes and observations
  notes: {
    type: String,
    maxlength: 1000
  },
  // Weather conditions
  weather: {
    type: String,
    enum: ['sunny', 'cloudy', 'rainy', 'snowy', 'foggy', 'other']
  },
  // Driver information
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Route information
  route: {
    startLocation: String,
    endLocation: String,
    distance: Number
  },
  // Vehicle condition
  vehicleCondition: {
    type: String,
    enum: ['excellent', 'good', 'fair', 'poor'],
    default: 'good'
  },
  // Issues reported
  issues: [{
    description: String,
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reportedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Status
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
  // Verification
  verified: {
    type: Boolean,
    default: false
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for total distance
vehicleAnalyticsSchema.virtual('totalDistance').get(function() {
  return this.endingOdometer - this.startingOdometer;
});

// Virtual for total hours
vehicleAnalyticsSchema.virtual('totalHours').get(function() {
  return this.endingHours - this.startingHours;
});

// Index for performance
vehicleAnalyticsSchema.index({ vehicleId: 1, date: -1 });
vehicleAnalyticsSchema.index({ date: -1 });
vehicleAnalyticsSchema.index({ vehicleId: 1, status: 1 });

module.exports = mongoose.model('VehicleAnalytics', vehicleAnalyticsSchema);
