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

// Index for performance
storageSiteSchema.index({ name: 1 });
storageSiteSchema.index({ code: 1 });
storageSiteSchema.index({ 'assignedManagers.manager': 1 });
storageSiteSchema.index({ isActive: 1 });
storageSiteSchema.index({ 'address.city': 1 });

module.exports = mongoose.model('StorageSite', storageSiteSchema);
