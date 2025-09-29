const mongoose = require('mongoose');

const fuelLogSchema = new mongoose.Schema({
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: true
  },
  storageId: {
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
  fuelDate: {
    type: Date,
    default: Date.now
  },
  odometerReading: {
    type: Number,
    required: true,
    min: 0
  },
  previousOdometerReading: {
    type: Number,
    min: 0
  },
  // Calculated fields
  distanceTraveled: {
    type: Number,
    min: 0
  },
  fuelEfficiency: {
    type: Number, // km/liter
    min: 0
  },
  filledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notes: {
    type: String,
    trim: true
  },
  // Cost tracking
  costPerLiter: {
    type: Number,
    min: 0
  },
  totalCost: {
    type: Number,
    min: 0
  },
  // Location tracking
  location: {
    type: String,
    trim: true
  },
  coordinates: {
    latitude: Number,
    longitude: Number
  },
  // Status tracking
  status: {
    type: String,
    enum: ['completed', 'pending_approval', 'cancelled'],
    default: 'completed'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Pre-save middleware to calculate derived fields
fuelLogSchema.pre('save', function(next) {
  // Calculate distance traveled
  if (this.previousOdometerReading && this.odometerReading) {
    this.distanceTraveled = this.odometerReading - this.previousOdometerReading;
  }
  
  // Calculate fuel efficiency
  if (this.distanceTraveled && this.quantityLiters && this.distanceTraveled > 0) {
    this.fuelEfficiency = this.distanceTraveled / this.quantityLiters;
  }
  
  // Calculate total cost
  if (this.costPerLiter && this.quantityLiters) {
    this.totalCost = this.costPerLiter * this.quantityLiters;
  }
  
  next();
});

// Index for efficient queries
fuelLogSchema.index({ vehicleId: 1, fuelDate: -1 });
fuelLogSchema.index({ storageId: 1, fuelDate: -1 });
fuelLogSchema.index({ filledBy: 1, fuelDate: -1 });
fuelLogSchema.index({ fuelDate: -1 });
fuelLogSchema.index({ status: 1 });

module.exports = mongoose.model('FuelLog', fuelLogSchema);
