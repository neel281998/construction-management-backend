const mongoose = require('mongoose');

const mainStorageSchema = new mongoose.Schema({
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
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  scaleType: {
    type: String,
    enum: ['mm', 'cm'],
    required: true,
    default: 'mm'
  },
  totalCapacity: {
    type: Number,
    required: true,
    min: 0
  },
  // Initial fuel level in liters (actual quantity)
  initialFuelLevel: {
    type: Number,
    required: true,
    min: 0
  },
  // Initial scale reading in mm/cm (physical measurement)
  initialScaleReading: {
    type: Number,
    required: true,
    min: 0
  },
  initialReading: {
    value: {
      type: Number,
      required: true
    },
    image: {
      type: String,
      required: true
    },
    date: {
      type: Date,
      required: true,
      default: Date.now
    }
  },
  currentReading: {
    value: {
      type: Number,
      required: true
    },
    image: {
      type: String,
      required: true
    },
    date: {
      type: Date,
      required: true,
      default: Date.now
    }
  },
  // Track fuel level in liters (calculated from scale reading)
  currentFuelLevel: {
    type: Number,
    default: 0
  },
  // Track total fuel dispensed
  totalDispensed: {
    type: Number,
    default: 0
  },
  // Track total fuel added
  totalAdded: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Metadata
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
mainStorageSchema.index({ name: 1 });
mainStorageSchema.index({ location: 1 });
mainStorageSchema.index({ manager: 1 });
mainStorageSchema.index({ isActive: 1 });

// Virtual for fuel level percentage
mainStorageSchema.virtual('fuelLevelPercentage').get(function() {
  if (this.totalCapacity === 0) return 0;
  return Math.round((this.currentFuelLevel / this.totalCapacity) * 100);
});

// Method to calculate fuel level from scale reading
mainStorageSchema.methods.calculateFuelLevel = function(scaleReading) {
  // This is a simplified calculation - you may need to adjust based on tank geometry
  // For now, assuming linear relationship between scale reading and fuel level
  const maxScaleReading = this.scaleType === 'mm' ? 1000 : 100; // Max scale reading
  const fuelLevel = (scaleReading / maxScaleReading) * this.totalCapacity;
  return Math.max(0, Math.min(fuelLevel, this.totalCapacity));
};

// Method to update current reading and fuel level
mainStorageSchema.methods.updateReading = function(scaleReading, image) {
  this.currentReading = {
    value: scaleReading,
    image: image,
    date: new Date()
  };
  this.currentFuelLevel = this.calculateFuelLevel(scaleReading);
  return this.save();
};

module.exports = mongoose.model('MainStorage', mainStorageSchema);

