const mongoose = require('mongoose');

const subPumpSchema = new mongoose.Schema({
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
  totalCapacity: {
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
subPumpSchema.index({ name: 1 });
subPumpSchema.index({ location: 1 });
subPumpSchema.index({ manager: 1 });
subPumpSchema.index({ isActive: 1 });

// Virtual for fuel level percentage
subPumpSchema.virtual('fuelLevelPercentage').get(function() {
  if (this.totalCapacity === 0) return 0;
  return Math.round((this.currentFuelLevel / this.totalCapacity) * 100);
});

// Method to calculate fuel level from scale reading
subPumpSchema.methods.calculateFuelLevel = function(scaleReading) {
  // Simplified calculation - adjust based on pump geometry
  const maxScaleReading = 100; // Assuming 0-100 scale
  const fuelLevel = (scaleReading / maxScaleReading) * this.totalCapacity;
  return Math.max(0, Math.min(fuelLevel, this.totalCapacity));
};

// Method to update current reading and fuel level
subPumpSchema.methods.updateReading = function(scaleReading, image) {
  this.currentReading = {
    value: scaleReading,
    image: image,
    date: new Date()
  };
  this.currentFuelLevel = this.calculateFuelLevel(scaleReading);
  return this.save();
};

module.exports = mongoose.model('SubPump', subPumpSchema);

