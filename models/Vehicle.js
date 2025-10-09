const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  vehicleNumber: {
    type: String,
    required: [true, 'Vehicle number is required'],
    unique: true,
    trim: true
  },
  type: {
    type: String,
    required: [true, 'Vehicle type is required'],
    enum: {
      values: ['truck', 'excavator', 'crane', 'bulldozer', 'mixer', 'loader', 'dump_truck', 'other'],
      message: 'Invalid vehicle type'
    }
  },
  brand: {
    type: String,
    required: [true, 'Brand is required'],
    trim: true,
    maxlength: [50, 'Brand cannot exceed 50 characters']
  },
  model: {
    type: String,
    required: [true, 'Model is required'],
    trim: true,
    maxlength: [50, 'Model cannot exceed 50 characters']
  },
  year: {
    type: Number,
    required: [true, 'Year is required'],
    min: [1990, 'Year must be 1990 or later'],
    max: [new Date().getFullYear() + 1, 'Year cannot be in the future']
  },
  status: {
    type: String,
    enum: {
      values: ['available', 'busy', 'maintenance', 'unavailable'],
      message: 'Invalid vehicle status'
    },
    default: 'available'
  },
  currentLocation: {
    latitude: {
      type: Number,
      min: [-90, 'Latitude must be between -90 and 90'],
      max: [90, 'Latitude must be between -90 and 90']
    },
    longitude: {
      type: Number,
      min: [-180, 'Longitude must be between -180 and 180'],
      max: [180, 'Longitude must be between -180 and 180']
    },
    address: {
      type: String,
      trim: true
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  assignedSite: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
    default: null
  },
  fuelLevel: {
    type: Number,
    min: [0, 'Fuel level cannot be negative'],
    max: [100, 'Fuel level cannot exceed 100'],
    default: 100
  },
  maintenanceSchedule: {
    nextService: {
      type: Date,
      required: [true, 'Next service date is required']
    },
    lastService: {
      type: Date,
      default: null
    },
    mileage: {
      type: Number,
      min: [0, 'Mileage cannot be negative'],
      default: 0
    },
    serviceInterval: {
      type: Number, // in days
      default: 90
    },
    notes: {
      type: String,
      maxlength: [500, 'Maintenance notes cannot exceed 500 characters']
    }
  },
  specifications: {
    engineType: String,
    fuelCapacity: Number, // in liters
    maxLoad: Number, // in kg
    capacityM3: Number, // in cubic meters
    dimensions: {
      length: Number,
      width: Number,
      height: Number
    }
  },
  documents: [{
    fileId: String, // GridFS file ID
    fileName: String,
    fileType: String,
    category: {
      type: String,
      enum: ['registration', 'insurance', 'maintenance', 'inspection', 'other']
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  photos: [{
    fileId: String, // GridFS file ID
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
  isActive: {
    type: Boolean,
    default: true
  },
  // Trip tracking
  tripTracking: {
    dailyTrips: {
      type: Number,
      default: 0
    },
    lastTripDate: {
      type: Date,
      default: Date.now
    },
    totalTrips: {
      type: Number,
      default: 0
    },
    currentTrip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryTransfer',
      default: null
    }
  },
  // Fuel efficiency tracking
  fuelEfficiency: {
    currentOdometer: {
      type: Number,
      default: 0
    },
    odometerType: {
      type: String,
      enum: ['km', 'hours'],
      default: 'km'
    },
    latestEfficiency: {
      type: Number,
      default: 0
    },
    averageEfficiency: {
      type: Number,
      default: 0
    },
    totalFuelConsumed: {
      type: Number,
      default: 0
    },
    totalDistance: {
      type: Number,
      default: 0
    },
    lastRefuelingDate: {
      type: Date
    },
    efficiencyHistory: [{
      date: {
        type: Date,
        default: Date.now
      },
      efficiency: {
        type: Number,
        required: true
      },
      fuelQuantity: {
        type: Number,
        required: true
      },
      distance: {
        type: Number,
        required: true
      }
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for maintenance status
vehicleSchema.virtual('maintenanceStatus').get(function() {
  if (!this.maintenanceSchedule.nextService) return 'unknown';
  
  const today = new Date();
  const nextService = new Date(this.maintenanceSchedule.nextService);
  const daysUntilService = Math.ceil((nextService - today) / (1000 * 60 * 60 * 24));
  
  if (daysUntilService < 0) return 'overdue';
  if (daysUntilService <= 7) return 'due_soon';
  return 'good';
});

// Virtual for fuel status
vehicleSchema.virtual('fuelStatus').get(function() {
  if (this.fuelLevel >= 50) return 'good';
  if (this.fuelLevel >= 25) return 'medium';
  return 'low';
});

// Index for performance (vehicleNumber already has unique index from schema definition)
vehicleSchema.index({ status: 1 });
vehicleSchema.index({ type: 1 });
vehicleSchema.index({ assignedSite: 1 });
vehicleSchema.index({ assignedTo: 1 });

module.exports = mongoose.model('Vehicle', vehicleSchema);