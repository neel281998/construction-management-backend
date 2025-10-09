const mongoose = require('mongoose');

const fuelRestockSchema = new mongoose.Schema({
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
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  scaleReading: {
    type: Number,
    required: true
  },
  image: {
    type: String,
    required: false // Optional for restocking
  },
  source: {
    type: String,
    trim: true,
    required: false // For sub pumps - which main storage the fuel came from
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  operator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Additional metadata
  notes: {
    type: String,
    trim: true
  },
  // Cost tracking (optional)
  costPerLiter: {
    type: Number,
    min: 0
  },
  totalCost: {
    type: Number,
    min: 0
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
fuelRestockSchema.index({ storageType: 1, storageId: 1 });
fuelRestockSchema.index({ date: -1 });
fuelRestockSchema.index({ operator: 1 });

// Pre-save middleware to calculate total cost
fuelRestockSchema.pre('save', function(next) {
  if (this.costPerLiter && this.quantity) {
    this.totalCost = this.costPerLiter * this.quantity;
  }
  next();
});

module.exports = mongoose.model('FuelRestock', fuelRestockSchema);

