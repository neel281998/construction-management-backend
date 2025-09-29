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
  currentReading: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  initialReading: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active'
  },
  isMainStorage: {
    type: Boolean,
    default: false
  },
  siteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
    required: function() {
      return !this.isMainStorage;
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
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
fuelStorageSchema.index({ isMainStorage: 1 });

module.exports = mongoose.model('FuelStorage', fuelStorageSchema);
