const mongoose = require('mongoose');

const vehicleRefuelingSchema = new mongoose.Schema({
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: true
  },
  pumpType: {
    type: String,
    enum: ['main', 'sub'],
    required: true
  },
  pumpId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'pumpTypeModel'
  },
  pumpTypeModel: {
    type: String,
    enum: ['MainStorage', 'SubPump'],
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  images: [{
    type: String,
    required: true
  }],
  odometerReading: {
    type: Number,
    required: true,
    min: 0
  },
  odometerType: {
    type: String,
    enum: ['km', 'hours'],
    required: true,
    default: 'km'
  },
  operator: {
    type: String,
    required: true,
    trim: true
  },
  shift: {
    type: String,
    trim: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  // For efficiency calculation
  previousOdometer: {
    type: Number,
    required: false
  },
  fuelEfficiency: {
    type: Number,
    required: false
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
vehicleRefuelingSchema.index({ vehicleId: 1, date: -1 });
vehicleRefuelingSchema.index({ pumpType: 1, pumpId: 1 });
vehicleRefuelingSchema.index({ date: -1 });
vehicleRefuelingSchema.index({ operator: 1 });

// Pre-save middleware to calculate total cost
vehicleRefuelingSchema.pre('save', function(next) {
  if (this.costPerLiter && this.quantity) {
    this.totalCost = this.costPerLiter * this.quantity;
  }
  next();
});

// Method to calculate fuel efficiency
vehicleRefuelingSchema.methods.calculateEfficiency = function(previousOdometer) {
  if (!previousOdometer || this.quantity === 0) {
    return null;
  }
  
  const distance = this.odometerReading - previousOdometer;
  if (distance <= 0) {
    return null;
  }
  
  // Efficiency = Distance / Fuel Quantity
  // For km: km/liter, For hours: hours/liter
  return distance / this.quantity;
};

module.exports = mongoose.model('VehicleRefueling', vehicleRefuelingSchema);

