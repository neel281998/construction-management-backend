const mongoose = require('mongoose');

const fuelStorageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  fuelType: {
    type: String,
    required: true,
    enum: ['diesel', 'petrol', 'oil', 'other'],
    default: 'diesel'
  },
  capacityLiters: {
    type: Number,
    required: true,
    min: 0
  },
  initialReading: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  currentReading: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  todayReading: {
    type: Number,
    default: 0,
    min: 0
  },
  lastReadingDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active'
  },
  storageType: {
    type: String,
    enum: ['main', 'sub'],
    required: true
  },
  parentStorageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FuelStorage',
    required: function() {
      return this.storageType === 'sub';
    }
  },
  siteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
    required: function() {
      return this.storageType === 'sub';
    }
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  restockHistory: [{
    date: {
      type: Date,
      default: Date.now
    },
    amount: {
      type: Number,
      required: true
    },
    previousLevel: {
      type: Number,
      required: true
    },
    newLevel: {
      type: Number,
      required: true
    },
    restockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    notes: String
  }],
  dailyReadings: [{
    date: {
      type: Date,
      required: true
    },
    reading: {
      type: Number,
      required: true,
      min: 0
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    notes: String
  }]
}, {
  timestamps: true
});

// Virtual for available capacity
fuelStorageSchema.virtual('availableCapacity').get(function() {
  return this.capacityLiters - this.currentReading;
});

// Virtual for utilization percentage
fuelStorageSchema.virtual('utilizationPercentage').get(function() {
  return (this.currentReading / this.capacityLiters) * 100;
});

// Index for efficient queries
fuelStorageSchema.index({ siteId: 1, status: 1 });
fuelStorageSchema.index({ fuelType: 1, status: 1 });
fuelStorageSchema.index({ storageType: 1 });
fuelStorageSchema.index({ parentStorageId: 1 });
fuelStorageSchema.index({ manager: 1 });

module.exports = mongoose.model('FuelStorage', fuelStorageSchema);
