const mongoose = require('mongoose');

const siteSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Site name is required'],
    trim: true,
    maxlength: [100, 'Site name cannot exceed 100 characters']
  },
  siteType: {
    type: String,
    enum: {
      values: ['BT_ROAD', 'CC_ROAD', 'BRIDGE', 'DRAINAGE'],
      message: 'Invalid site type'
    },
    required: [true, 'Site type is required']
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
      values: ['planning', 'active', 'on_hold', 'completed'],
      message: 'Invalid site status'
    },
    default: 'planning'
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
    required: [true, 'Site manager is required']
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

// Index for performance
siteSchema.index({ status: 1 });
siteSchema.index({ siteManager: 1 });
siteSchema.index({ 'address.city': 1 });
siteSchema.index({ startDate: 1, expectedEndDate: 1 });

module.exports = mongoose.model('Site', siteSchema);