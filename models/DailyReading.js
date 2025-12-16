const mongoose = require('mongoose');

const dailyReadingSchema = new mongoose.Schema({
  storageType: {
    type: String,
    enum: ['main', 'sub'],
    required: true
  },
  storageId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'storageTypeModel'
  },
  storageTypeModel: {
    type: String,
    enum: ['MainStorage', 'SubPump'],
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  openingReading: {
    value: {
      type: Number,
      required: true
    },
    image: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now
    }
  },
  closingReading: {
    value: {
      type: Number,
      required: false // Will be set when closing reading is recorded
    },
    image: {
      type: String,
      required: false
    },
    timestamp: {
      type: Date,
      required: false
    }
  },
  operator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Calculated fields
  fuelConsumed: {
    type: Number,
    default: 0
  },
  isComplete: {
    type: Boolean,
    default: false
  },
  // Additional metadata
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
dailyReadingSchema.index({ storageType: 1, storageId: 1, date: -1 });
dailyReadingSchema.index({ date: -1 });
dailyReadingSchema.index({ operator: 1 });
dailyReadingSchema.index({ isComplete: 1 });

// Method to complete the daily reading
dailyReadingSchema.methods.completeReading = function(closingValue, closingImage) {
  this.closingReading = {
    value: closingValue,
    image: closingImage,
    timestamp: new Date()
  };
  
  // Calculate daily consumption in liters as the absolute difference
  this.fuelConsumed = Math.abs(closingValue - this.openingReading.value);
  this.isComplete = true;
  
  return this.save();
};

// Virtual for daily consumption in liters
dailyReadingSchema.virtual('dailyConsumptionLiters').get(function() {
  if (!this.isComplete) return 0;
  // This would need to be calculated based on the storage's scale type and capacity
  // For now, returning the raw difference
  return this.fuelConsumed;
});

module.exports = mongoose.model('DailyReading', dailyReadingSchema);

