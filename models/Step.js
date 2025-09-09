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
  stepType: {
    type: String,
    enum: ['foundation', 'wall', 'slab', 'column', 'beam', 'roof', 'road_base', 'road_surface', 'drainage', 'custom'],
    required: true,
    default: 'custom'
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
  // Estimated dimensions (what needs to be built)
  estimatedDimensions: {
    length: { type: Number, default: 0 },
    breadth: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    thickness: { type: Number, default: 0 },
    count: { type: Number, default: 1 },
    unit: { 
      type: String, 
      enum: ['mm', 'cm', 'm', 'km', 'in', 'ft', 'yd', 'mi'],
      default: 'm'
    },
    // Additional fields for specific step types
    additionalFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: new Map()
    }
  },
  // Completed dimensions (what's actually built)
  completedDimensions: {
    length: { type: Number, default: 0 },
    breadth: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    thickness: { type: Number, default: 0 },
    count: { type: Number, default: 0 },
    unit: { 
      type: String, 
      enum: ['mm', 'cm', 'm', 'km', 'in', 'ft', 'yd', 'mi'],
      default: 'm'
    },
    additionalFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: new Map()
    }
  },
  // Volume calculations
  volumeCalculations: {
    estimatedVolume: { type: Number, default: 0 },
    completedVolume: { type: Number, default: 0 },
    volumeUnit: { 
      type: String, 
      enum: ['mm³', 'cm³', 'm³', 'km³', 'in³', 'ft³', 'yd³', 'mi³'],
      default: 'm³'
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
  // Step assignment to users
  assignedUsers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    assignedDate: {
      type: Date,
      default: Date.now
    },
    role: {
      type: String,
      enum: ['primary', 'secondary', 'supervisor', 'worker'],
      default: 'worker'
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  // Primary assigned user (for backward compatibility)
  assignedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Step type configurations
const stepTypeConfigs = {
  foundation: {
    name: 'Foundation',
    requiredFields: ['length', 'breadth', 'thickness'],
    formula: (dims) => dims.length * dims.breadth * dims.thickness,
    defaultThickness: 0.5
  },
  wall: {
    name: 'Wall Construction',
    requiredFields: ['length', 'height', 'thickness'],
    formula: (dims) => dims.length * dims.height * dims.thickness,
    defaultThickness: 0.2
  },
  slab: {
    name: 'Slab/Floor',
    requiredFields: ['length', 'breadth', 'thickness'],
    formula: (dims) => dims.length * dims.breadth * dims.thickness,
    defaultThickness: 0.15
  },
  column: {
    name: 'Column',
    requiredFields: ['count', 'length', 'breadth', 'height'],
    formula: (dims) => dims.count * dims.length * dims.breadth * dims.height,
    defaultThickness: 0.3
  },
  beam: {
    name: 'Beam',
    requiredFields: ['length', 'breadth', 'height'],
    formula: (dims) => dims.length * dims.breadth * dims.height,
    defaultThickness: 0.3
  },
  roof: {
    name: 'Roof',
    requiredFields: ['length', 'breadth', 'thickness'],
    formula: (dims) => dims.length * dims.breadth * dims.thickness,
    defaultThickness: 0.1
  },
  road_base: {
    name: 'Road Base',
    requiredFields: ['length', 'breadth', 'thickness'],
    formula: (dims) => dims.length * dims.breadth * dims.thickness,
    defaultThickness: 0.2
  },
  road_surface: {
    name: 'Road Surface',
    requiredFields: ['length', 'breadth', 'thickness'],
    formula: (dims) => dims.length * dims.breadth * dims.thickness,
    defaultThickness: 0.05
  },
  drainage: {
    name: 'Drainage',
    requiredFields: ['length', 'breadth', 'height'],
    formula: (dims) => dims.length * dims.breadth * dims.height,
    defaultThickness: 0.3
  },
  custom: {
    name: 'Custom',
    requiredFields: ['length', 'breadth', 'height'],
    formula: (dims) => dims.length * dims.breadth * dims.height,
    defaultThickness: 0.1
  }
};

// Unit conversion methods
stepSchema.methods.convertToMeters = function(value, unit) {
  const conversions = {
    'mm': value / 1000,
    'cm': value / 100,
    'm': value,
    'km': value * 1000,
    'in': value * 0.0254,
    'ft': value * 0.3048,
    'yd': value * 0.9144,
    'mi': value * 1609.34
  };
  return conversions[unit] || value;
};

stepSchema.methods.convertFromMeters = function(value, targetUnit) {
  const conversions = {
    'mm': value * 1000,
    'cm': value * 100,
    'm': value,
    'km': value / 1000,
    'in': value / 0.0254,
    'ft': value / 0.3048,
    'yd': value / 0.9144,
    'mi': value / 1609.34
  };
  return conversions[targetUnit] || value;
};

stepSchema.methods.getVolumeUnit = function(unit) {
  const volumeUnits = {
    'mm': 'mm³',
    'cm': 'cm³',
    'm': 'm³',
    'km': 'km³',
    'in': 'in³',
    'ft': 'ft³',
    'yd': 'yd³',
    'mi': 'mi³'
  };
  return volumeUnits[unit] || 'm³';
};

// Method to calculate volume based on step type and dimensions
stepSchema.methods.calculateVolume = function(dimensions) {
  const config = stepTypeConfigs[this.stepType] || stepTypeConfigs.custom;
  
  // Convert all dimensions to meters for calculation
  const baseDimensions = {
    length: this.convertToMeters(dimensions.length || 0, dimensions.unit || 'm'),
    breadth: this.convertToMeters(dimensions.breadth || 0, dimensions.unit || 'm'),
    height: this.convertToMeters(dimensions.height || 0, dimensions.unit || 'm'),
    thickness: this.convertToMeters(dimensions.thickness || 0, dimensions.unit || 'm'),
    count: dimensions.count || 1
  };
  
  // Calculate volume in cubic meters
  const volumeM3 = config.formula(baseDimensions);
  
  return {
    volume: volumeM3,
    unit: 'm³',
    displayUnit: this.getVolumeUnit(dimensions.unit || 'm')
  };
};

// Method to calculate progress based on dimensions
stepSchema.methods.calculateProgressFromDimensions = function() {
  const config = stepTypeConfigs[this.stepType] || stepTypeConfigs.custom;
  
  // Calculate estimated volume
  const estimatedVolume = this.calculateVolume(this.estimatedDimensions);
  this.volumeCalculations.estimatedVolume = estimatedVolume.volume;
  this.volumeCalculations.volumeUnit = estimatedVolume.unit;
  
  // Calculate completed volume
  const completedVolume = this.calculateVolume(this.completedDimensions);
  this.volumeCalculations.completedVolume = completedVolume.volume;
  
  // Update progress - use the larger of existing progressM3 or calculated volume
  this.progressM3 = Math.max(this.progressM3 || 0, completedVolume.volume);
  
  // Only update estimatedVolumeM3 if it's not already set or if calculated volume is larger
  if (!this.estimatedVolumeM3 || this.estimatedVolumeM3 === 0) {
    this.estimatedVolumeM3 = estimatedVolume.volume;
  }
  
  // Calculate progress percentage
  this.progressPercentage = this.estimatedVolumeM3 > 0 
    ? Math.min((this.progressM3 / this.estimatedVolumeM3) * 100, 100)
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
    status: this.status,
    estimatedVolume: this.estimatedVolumeM3,
    completedVolume: this.progressM3,
    volumeUnit: estimatedVolume.unit
  };
};

// Index for efficient queries
stepSchema.index({ siteId: 1, stepNumber: 1 });
stepSchema.index({ siteId: 1, status: 1 });

module.exports = mongoose.model('Step', stepSchema);
