const mongoose = require('mongoose');

const siteSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Site name is required'],
    trim: true,
    maxlength: [100, 'Site name cannot exceed 100 characters']
  },
  siteTypes: [{
    type: String,
    enum: {
      values: ['BT_ROAD', 'CC_ROAD', 'BRIDGE', 'DRAINAGE'],
      message: 'Invalid site type'
    }
  }],
  // Keep siteType for backward compatibility
  siteType: {
    type: String,
    enum: {
      values: ['BT_ROAD', 'CC_ROAD', 'BRIDGE', 'DRAINAGE'],
      message: 'Invalid site type'
    }
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
  status: {
    type: String,
    enum: {
      values: ['active', 'on_hold', 'completed'],
      message: 'Invalid site status'
    },
    default: 'active'
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  expectedEndDate: {
    type: Date,
    required: [true, 'Expected end date is required'],
    validate: {
      validator: function(value) {
        return value > this.startDate;
      },
      message: 'Expected end date must be after start date'
    }
  },
  actualEndDate: {
    type: Date,
    default: null
  },
  siteManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  inventoryManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  assignedStaff: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    assignedDate: {
      type: Date,
      default: Date.now
    },
    role: {
      type: String,
      enum: ['supervisor', 'worker', 'equipment_operator']
    }
  }],
  assignedVehicles: [{
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle'
    },
    assignedDate: {
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
  documents: [{
    fileId: String, // GridFS file ID
    fileName: String,
    fileType: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  progress: {
    type: Number,
    min: [0, 'Progress cannot be negative'],
    max: [100, 'Progress cannot exceed 100'],
    default: 0
  },
  totalProgressM3: {
    type: Number,
    default: 0,
    min: [0, 'Total progress cannot be negative']
  },
  estimatedVolumeM3: {
    type: Number,
    required: [true, 'Estimated volume is required'],
    min: [0, 'Estimated volume cannot be negative']
  },
  // Project specification dimensions
  projectDimensions: {
    length: {
      type: Number,
      default: 100,
      min: [0, 'Length cannot be negative']
    },
    breadth: {
      type: Number,
      default: 50,
      min: [0, 'Breadth cannot be negative']
    },
    height: {
      type: Number,
      default: 10,
      min: [0, 'Height cannot be negative']
    },
    unit: {
      type: String,
      enum: ['mm', 'cm', 'm', 'km', 'in', 'ft', 'yd', 'mi'],
      default: 'm'
    },
    totalVolume: {
      type: Number,
      default: 0
    }
  },
  currentStep: {
    type: Number,
    default: 1,
    min: [1, 'Current step must be at least 1']
  },
  milestones: [{
    name: String,
    description: String,
    targetDate: Date,
    completedDate: Date,
    isCompleted: {
      type: Boolean,
      default: false
    }
  }],
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
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
siteSchema.virtual('fullAddress').get(function() {
  return `${this.address.street}, ${this.address.city}, ${this.address.state} ${this.address.zipCode}`;
});

// Virtual for days remaining
siteSchema.virtual('daysRemaining').get(function() {
  if (this.status === 'completed') return 0;
  const today = new Date();
  const endDate = new Date(this.expectedEndDate);
  const diffTime = endDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
});

// Method to calculate total volume from project dimensions
siteSchema.methods.calculateProjectVolume = function() {
  if (!this.projectDimensions || !this.projectDimensions.length || !this.projectDimensions.breadth || !this.projectDimensions.height) {
    return 0;
  }

  // Convert to meters for calculation
  const lengthInMeters = this.convertToMeters(this.projectDimensions.length, this.projectDimensions.unit);
  const breadthInMeters = this.convertToMeters(this.projectDimensions.breadth, this.projectDimensions.unit);
  const heightInMeters = this.convertToMeters(this.projectDimensions.height, this.projectDimensions.unit);

  const volumeInM3 = lengthInMeters * breadthInMeters * heightInMeters;
  
  // Update the totalVolume field
  this.projectDimensions.totalVolume = volumeInM3;
  
  return volumeInM3;
};

// Helper method to convert units to meters
siteSchema.methods.convertToMeters = function(value, unit) {
  const conversions = {
    'mm': 0.001,
    'cm': 0.01,
    'm': 1,
    'km': 1000,
    'in': 0.0254,
    'ft': 0.3048,
    'yd': 0.9144,
    'mi': 1609.34
  };
  
  return value * (conversions[unit] || 1);
};

// Method to calculate overall site progress based on step progress
siteSchema.methods.calculateOverallProgress = async function() {
  const Step = require('./Step');
  
  try {
    const steps = await Step.find({ siteId: this._id });
    
    if (steps.length === 0) {
      this.progress = 0;
      this.totalProgressM3 = 0;
      return { progress: 0, totalProgressM3: 0 };
    }

    let totalEstimatedVolume = 0;
    let totalCompletedVolume = 0;

    steps.forEach(step => {
      // Use step's estimated volume or calculate from dimensions
      const stepEstimatedVolume = step.estimatedVolumeM3 || 
        (step.estimatedDimensions ? 
          this.convertToMeters(step.estimatedDimensions.length, step.estimatedDimensions.unit) *
          this.convertToMeters(step.estimatedDimensions.breadth, step.estimatedDimensions.unit) *
          this.convertToMeters(step.estimatedDimensions.height, step.estimatedDimensions.unit) : 0);
      
      const stepCompletedVolume = step.progressM3 || 
        (step.completedDimensions ? 
          this.convertToMeters(step.completedDimensions.length, step.completedDimensions.unit) *
          this.convertToMeters(step.completedDimensions.breadth, step.completedDimensions.unit) *
          this.convertToMeters(step.completedDimensions.height, step.completedDimensions.unit) : 0);

      totalEstimatedVolume += stepEstimatedVolume;
      totalCompletedVolume += stepCompletedVolume;
    });

    // Calculate progress percentage
    const progressPercentage = totalEstimatedVolume > 0 ? 
      Math.min((totalCompletedVolume / totalEstimatedVolume) * 100, 100) : 0;

    // Update site progress
    this.progress = Math.round(progressPercentage * 100) / 100; // Round to 2 decimal places
    this.totalProgressM3 = totalCompletedVolume;
    this.estimatedVolumeM3 = totalEstimatedVolume;

    return {
      progress: this.progress,
      totalProgressM3: this.totalProgressM3,
      estimatedVolumeM3: this.estimatedVolumeM3
    };
  } catch (error) {
    console.error('Error calculating overall progress:', error);
    return { progress: 0, totalProgressM3: 0 };
  }
};

// Index for performance
siteSchema.index({ status: 1 });
siteSchema.index({ siteManager: 1 });
siteSchema.index({ 'address.city': 1 });
siteSchema.index({ startDate: 1, expectedEndDate: 1 });

module.exports = mongoose.model('Site', siteSchema);