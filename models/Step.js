const mongoose = require('mongoose');

const stepSchema = new mongoose.Schema({
  siteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
    required: true
  },
  stepNumber: {
    type: Number,
    required: true
  },
  stepName: {
    type: String,
    required: true
  },
  primaryStock: {
    type: String,
    required: true
  },
  secondaryStock: {
    type: String,
    required: true
  },
  estimatedVolumeM3: {
    type: Number,
    required: true,
    default: 0
  },
  progressM3: {
    type: Number,
    default: 0
  },
  // Dimensions for progress calculation
  dimensions: {
    length: {
      type: Number,
      default: 0
    },
    breadth: {
      type: Number,
      default: 0
    },
    height: {
      type: Number,
      default: 0
    }
  },
  // Calculated progress percentage
  progressPercentage: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed'],
    default: 'pending'
  },
  startDate: {
    type: Date
  },
  completedDate: {
    type: Date
  },
  notes: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Method to calculate progress based on dimensions
stepSchema.methods.calculateProgressFromDimensions = function() {
  const { length, breadth, height } = this.dimensions;
  
  // Calculate current volume from dimensions
  const currentVolumeM3 = length * breadth * height;
  
  // Update progress
  this.progressM3 = currentVolumeM3;
  
  // Calculate progress percentage
  this.progressPercentage = this.estimatedVolumeM3 > 0 
    ? Math.min((currentVolumeM3 / this.estimatedVolumeM3) * 100, 100)
    : 0;
  
  // Update status based on progress
  if (this.progressPercentage >= 100) {
    this.status = 'completed';
    this.completedDate = new Date();
  } else if (this.progressPercentage > 0) {
    this.status = 'in_progress';
    if (!this.startDate) this.startDate = new Date();
  }
  
  return {
    progressM3: this.progressM3,
    progressPercentage: this.progressPercentage,
    status: this.status
  };
};

// Index for efficient queries
stepSchema.index({ siteId: 1, stepNumber: 1 });
stepSchema.index({ siteId: 1, status: 1 });

module.exports = mongoose.model('Step', stepSchema);
