const mongoose = require('mongoose');

const fuelTransferSchema = new mongoose.Schema({
  fromStorageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FuelStorage',
    required: true
  },
  toStorageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FuelStorage',
    required: true
  },
  fuelType: {
    type: String,
    required: true,
    enum: ['diesel', 'petrol', 'oil', 'other']
  },
  quantityLiters: {
    type: Number,
    required: true,
    min: 0.01
  },
  transferDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  transferredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String,
    trim: true
  },
  // For vehicle refueling
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: function() {
      return this.transferType === 'vehicle_refuel';
    }
  },
  odometerReading: {
    type: Number,
    min: 0
  },
  transferType: {
    type: String,
    enum: ['storage_to_storage', 'storage_to_vehicle', 'restock'],
    required: true
  },
  // Cost tracking
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

// Pre-save middleware to calculate total cost
fuelTransferSchema.pre('save', function(next) {
  if (this.costPerLiter && this.quantityLiters) {
    this.totalCost = this.costPerLiter * this.quantityLiters;
  }
  next();
});

// Index for efficient queries
fuelTransferSchema.index({ fromStorageId: 1, transferDate: -1 });
fuelTransferSchema.index({ toStorageId: 1, transferDate: -1 });
fuelTransferSchema.index({ vehicleId: 1, transferDate: -1 });
fuelTransferSchema.index({ status: 1, transferDate: -1 });
fuelTransferSchema.index({ transferredBy: 1, transferDate: -1 });

module.exports = mongoose.model('FuelTransfer', fuelTransferSchema);
