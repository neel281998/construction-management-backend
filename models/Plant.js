const mongoose = require('mongoose');

const plantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Plant name is required'],
    trim: true,
    maxlength: [100, 'Plant name cannot exceed 100 characters']
    // unique removed - defined in index below to avoid duplicate
  },
  code: {
    type: String,
    trim: true,
    uppercase: true,
    maxlength: [20, 'Plant code cannot exceed 20 characters'],
    match: [/^[A-Z]{2,4}-\d{3}$/, 'Plant code must be in format XX-000 or XXX-000']
  },
  plantType: {
    type: String,
    required: [true, 'Plant type is required'],
    enum: {
      values: ['concrete_batching', 'asphalt_production', 'precast_manufacturing'],
      message: 'Invalid plant type'
    },
    default: 'concrete_batching'
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
    dailyCapacityM3: {
      type: Number,
      required: [true, 'Daily capacity is required'],
      min: [0, 'Daily capacity cannot be negative']
    },
    monthlyCapacityM3: {
      type: Number,
      required: [true, 'Monthly capacity is required'],
      min: [0, 'Monthly capacity cannot be negative']
    },
    currentUtilization: {
      type: Number,
      default: 0,
      min: [0, 'Current utilization cannot be negative'],
      max: [100, 'Current utilization cannot exceed 100%']
    }
  },
  productionMetrics: {
    totalOutputM3: {
      type: Number,
      default: 0,
      min: [0, 'Total output cannot be negative']
    },
    averageDailyOutputM3: {
      type: Number,
      default: 0,
      min: [0, 'Average daily output cannot be negative']
    },
    efficiency: {
      type: Number,
      default: 0,
      min: [0, 'Efficiency cannot be negative'],
      max: [100, 'Efficiency cannot exceed 100%']
    },
    lastCalculated: {
      type: Date,
      default: Date.now
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
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full address
plantSchema.virtual('fullAddress').get(function() {
  return `${this.address.street}, ${this.address.city}, ${this.address.state} ${this.address.zipCode}`;
});

// Virtual for capacity utilization percentage
plantSchema.virtual('capacityUtilizationPercentage').get(function() {
  if (!this.capacity.dailyCapacityM3 || this.capacity.dailyCapacityM3 === 0) return 0;
  return Math.round((this.productionMetrics.averageDailyOutputM3 / this.capacity.dailyCapacityM3) * 100);
});

// Virtual for active managers count
plantSchema.virtual('activeManagersCount').get(function() {
  return (this.assignedManagers || []).filter(assignment => assignment.isActive).length;
});

// Method to add manager
plantSchema.methods.addManager = function(managerId, assignedBy) {
  // Initialize assignedManagers if it doesn't exist
  if (!this.assignedManagers) {
    this.assignedManagers = [];
  }
  
  // Check if manager is already assigned
  const existingAssignment = this.assignedManagers.find(
    assignment => assignment.manager.toString() === managerId.toString() && assignment.isActive
  );
  
  if (existingAssignment) {
    throw new Error('Manager is already assigned to this plant');
  }
  
  this.assignedManagers.push({
    manager: managerId,
    assignedBy: assignedBy
  });
  
  return this.save();
};

// Method to remove manager
plantSchema.methods.removeManager = function(managerId) {
  if (!this.assignedManagers) {
    throw new Error('No managers assigned to this plant');
  }
  
  const assignment = this.assignedManagers.find(
    assignment => assignment.manager.toString() === managerId.toString() && assignment.isActive
  );
  
  if (!assignment) {
    throw new Error('Manager is not assigned to this plant');
  }
  
  assignment.isActive = false;
  return this.save();
};

// Method to check if user is assigned manager
plantSchema.methods.isManagerAssigned = function(userId) {
  return (this.assignedManagers || []).some(
    assignment => assignment.manager.toString() === userId.toString() && assignment.isActive
  );
};

// Method to update production metrics
plantSchema.methods.updateProductionMetrics = function() {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  // This would typically be calculated from PlantOutput records
  // For now, we'll set a placeholder calculation
  this.productionMetrics.lastCalculated = today;
  
  return this.save();
};

// Static method to get plants for a manager
plantSchema.statics.getPlantsForManager = function(managerId) {
  return this.find({
    'assignedManagers.manager': managerId,
    'assignedManagers.isActive': true,
    isActive: true
  });
};

// Index for performance
plantSchema.index({ name: 1 }, { unique: true });
plantSchema.index({ code: 1 });
plantSchema.index({ plantType: 1 });
plantSchema.index({ 'assignedManagers.manager': 1 });
plantSchema.index({ isActive: 1 });
plantSchema.index({ 'address.city': 1 });

module.exports = mongoose.model('Plant', plantSchema);
