const mongoose = require('mongoose');

const storageSiteSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Storage site name is required'],
    trim: true,
    maxlength: [100, 'Storage site name cannot exceed 100 characters'],
    unique: true
  },
  code: {
    type: String,
    trim: true,
    uppercase: true,
    maxlength: [20, 'Storage site code cannot exceed 20 characters'],
    match: [/^[A-Z]{2,4}-\d{3}$/, 'Storage site code must be in format XX-000 or XXX-000']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  address: {
    street: {
      type: String,
      required: [true, 'Street address is required'],
      trim: true
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true
    },
    zipCode: {
      type: String,
      required: [true, 'ZIP code is required'],
      trim: true
    },
    coordinates: {
      latitude: {
        type: Number,
        min: [-90, 'Latitude must be between -90 and 90'],
        max: [90, 'Latitude must be between -90 and 90']
      },
      longitude: {
        type: Number,
        min: [-180, 'Longitude must be between -180 and 180'],
        max: [180, 'Longitude must be between -180 and 180']
      }
    }
  },
  assignedManagers: [{
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    assignedDate: {
      type: Date,
      default: Date.now
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  capacity: {
    totalCapacity: {
      type: Number,
      min: [0, 'Total capacity cannot be negative']
    },
    usedCapacity: {
      type: Number,
      default: 0,
      min: [0, 'Used capacity cannot be negative']
    },
    unit: {
      type: String,
      enum: ['sqft', 'sqm', 'cubic_meters', 'items'],
      default: 'items'
    }
  },
  contact: {
    phone: {
      type: String,
      trim: true,
      match: [/^\+?[\d\s\-\(\)]{10,}$/, 'Please enter a valid phone number']
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    }
  },
  operatingHours: {
    openTime: {
      type: String,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter a valid time in HH:MM format']
    },
    closeTime: {
      type: String,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter a valid time in HH:MM format']
    },
    workingDays: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }]
  },
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
  // Vehicle tracking for storage site operations
  vehicleActivity: [{
    operationType: {
      type: String,
      enum: ['restock', 'transfer_in', 'transfer_out', 'dispatch', 'receipt'],
      required: true
    },
    vehicle: {
      _id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vehicle',
        required: true
      },
      vehicleNumber: {
        type: String,
        required: true
      },
      vehicleType: {
        type: String,
        required: true
      }
    },
    inventoryItem: {
      _id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Inventory',
        required: false
      },
      itemName: {
        type: String,
        required: false
      },
      quantity: {
        type: Number,
        required: false
      },
      unit: {
        type: String,
        required: false
      }
    },
    operationDetails: {
      quantity: {
        type: Number,
        required: true
      },
      supplier: {
        type: String,
        required: false
      },
      cost: {
        type: Number,
        required: false
      },
      notes: {
        type: String,
        required: false
      }
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    performedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Trip statistics for this storage site
  tripStatistics: {
    totalTrips: {
      type: Number,
      default: 0
    },
    dailyTrips: {
      type: Number,
      default: 0
    },
    lastTripDate: {
      type: Date,
      default: null
    },
    vehiclesUsed: [{
      vehicle: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vehicle'
      },
      vehicleNumber: String,
      tripCount: {
        type: Number,
        default: 0
      },
      lastUsed: {
        type: Date,
        default: null
      }
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full address
storageSiteSchema.virtual('fullAddress').get(function() {
  return `${this.address.street}, ${this.address.city}, ${this.address.state} ${this.address.zipCode}`;
});

// Virtual for capacity percentage
storageSiteSchema.virtual('capacityPercentage').get(function() {
  if (!this.capacity.totalCapacity || this.capacity.totalCapacity === 0) return 0;
  return Math.round((this.capacity.usedCapacity / this.capacity.totalCapacity) * 100);
});

// Virtual for active managers count
storageSiteSchema.virtual('activeManagersCount').get(function() {
  return (this.assignedManagers || []).filter(assignment => assignment.isActive).length;
});

// Method to record vehicle activity
storageSiteSchema.methods.recordVehicleActivity = function(operationType, vehicle, inventoryItem, operationDetails, performedBy) {
  console.log('🏢 Recording vehicle activity for storage site:', {
    operationType,
    vehicle: vehicle.vehicleNumber,
    inventoryItem: inventoryItem?.itemName,
    quantity: operationDetails.quantity
  });

  // Add to vehicle activity
  this.vehicleActivity.push({
    operationType,
    vehicle: {
      _id: vehicle._id,
      vehicleNumber: vehicle.vehicleNumber,
      vehicleType: vehicle.type
    },
    inventoryItem: inventoryItem ? {
      _id: inventoryItem._id,
      itemName: inventoryItem.itemName,
      quantity: operationDetails.quantity,
      unit: inventoryItem.unit
    } : null,
    operationDetails,
    performedBy
  });

  // Update trip statistics
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const lastTripDateStr = this.tripStatistics.lastTripDate ? 
    this.tripStatistics.lastTripDate.toISOString().split('T')[0] : null;

  // If it's a new day, reset daily trips
  if (lastTripDateStr !== todayStr) {
    this.tripStatistics.dailyTrips = 1;
  } else {
    this.tripStatistics.dailyTrips += 1;
  }

  this.tripStatistics.totalTrips += 1;
  this.tripStatistics.lastTripDate = today;

  // Update vehicle usage statistics
  let vehicleStats = this.tripStatistics.vehiclesUsed.find(v => 
    v.vehicle.toString() === vehicle._id.toString()
  );

  if (!vehicleStats) {
    vehicleStats = {
      vehicle: vehicle._id,
      vehicleNumber: vehicle.vehicleNumber,
      tripCount: 0,
      lastUsed: null
    };
    this.tripStatistics.vehiclesUsed.push(vehicleStats);
  }

  vehicleStats.tripCount += 1;
  vehicleStats.lastUsed = today;

  console.log('📊 Updated storage site trip statistics:', {
    totalTrips: this.tripStatistics.totalTrips,
    dailyTrips: this.tripStatistics.dailyTrips,
    vehicleTrips: vehicleStats.tripCount
  });

  return this.save();
};

// Method to get recent vehicle activity
storageSiteSchema.methods.getRecentVehicleActivity = function(limit = 10) {
  return this.vehicleActivity
    .sort((a, b) => new Date(b.performedAt) - new Date(a.performedAt))
    .slice(0, limit);
};

// Method to get vehicle usage statistics
storageSiteSchema.methods.getVehicleUsageStats = function() {
  return {
    totalTrips: this.tripStatistics.totalTrips,
    dailyTrips: this.tripStatistics.dailyTrips,
    lastTripDate: this.tripStatistics.lastTripDate,
    vehiclesUsed: this.tripStatistics.vehiclesUsed.sort((a, b) => b.tripCount - a.tripCount)
  };
};

// Method to add manager
storageSiteSchema.methods.addManager = function(managerId, assignedBy) {
  // Initialize assignedManagers if it doesn't exist
  if (!this.assignedManagers) {
    this.assignedManagers = [];
  }
  
  // Check if manager is already assigned
  const existingAssignment = this.assignedManagers.find(
    assignment => assignment.manager.toString() === managerId.toString() && assignment.isActive
  );
  
  if (existingAssignment) {
    throw new Error('Manager is already assigned to this storage site');
  }
  
  this.assignedManagers.push({
    manager: managerId,
    assignedBy: assignedBy
  });
  
  return this.save();
};

// Method to remove manager
storageSiteSchema.methods.removeManager = function(managerId) {
  if (!this.assignedManagers) {
    throw new Error('No managers assigned to this storage site');
  }
  
  const assignment = this.assignedManagers.find(
    assignment => assignment.manager.toString() === managerId.toString() && assignment.isActive
  );
  
  if (!assignment) {
    throw new Error('Manager is not assigned to this storage site');
  }
  
  assignment.isActive = false;
  return this.save();
};

// Method to check if user is assigned manager
storageSiteSchema.methods.isManagerAssigned = function(userId) {
  return (this.assignedManagers || []).some(
    assignment => assignment.manager.toString() === userId.toString() && assignment.isActive
  );
};

// Static method to get storage sites for a manager
storageSiteSchema.statics.getSitesForManager = function(managerId) {
  return this.find({
    'assignedManagers.manager': managerId,
    'assignedManagers.isActive': true,
    isActive: true
  });
};

// Index for performance (name already has unique index from schema definition)
storageSiteSchema.index({ code: 1 });
storageSiteSchema.index({ 'assignedManagers.manager': 1 });
storageSiteSchema.index({ isActive: 1 });
storageSiteSchema.index({ 'address.city': 1 });
storageSiteSchema.index({ 'vehicleActivity.performedAt': -1 });
storageSiteSchema.index({ 'vehicleActivity.vehicle._id': 1 });
storageSiteSchema.index({ 'vehicleActivity.operationType': 1 });

module.exports = mongoose.model('StorageSite', storageSiteSchema);
