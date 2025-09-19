const mongoose = require('mongoose');

const consumedMaterialSchema = new mongoose.Schema({
  inventoryItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PlantInventory',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    required: true
  },
  consumedAt: {
    type: Date,
    default: Date.now
  },
  notes: String
});

const outputMaterialSchema = new mongoose.Schema({
  materialType: {
    type: String,
    required: true,
    enum: ['concrete', 'asphalt', 'precast_element', 'other']
  },
  materialName: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    required: true,
    enum: ['cubic_meters', 'tons', 'pieces', 'kg', 'liters']
  },
  qualityMetrics: {
    strength: Number,        // MPa for concrete
    temperature: Number,     // °C for asphalt
    dimensions: {
      length: Number,
      width: Number,
      height: Number
    },
    other: mongoose.Schema.Types.Mixed
  },
  productionDate: {
    type: Date,
    default: Date.now
  },
  expiryDate: Date,         // For materials with expiry (like concrete)
  notes: String
});

const productionBatchSchema = new mongoose.Schema({
  batchId: {
    type: String,
    required: true,
    unique: true
  },
  plant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plant',
    required: true
  },
  batchType: {
    type: String,
    required: true,
    enum: ['concrete', 'asphalt', 'precast', 'other']
  },
  status: {
    type: String,
    required: true,
    enum: ['in_progress', 'completed', 'cancelled'],
    default: 'in_progress'
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: Date,
  consumedMaterials: [consumedMaterialSchema],
  outputMaterials: [outputMaterialSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notes: String,
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
productionBatchSchema.index({ plant: 1, status: 1 });
// batchId already has unique index from unique: true
productionBatchSchema.index({ createdBy: 1 });
productionBatchSchema.index({ startTime: -1 });

// Virtual for total consumed quantity
productionBatchSchema.virtual('totalConsumedQuantity').get(function() {
  return this.consumedMaterials.reduce((total, material) => total + material.quantity, 0);
});

// Virtual for total output quantity
productionBatchSchema.virtual('totalOutputQuantity').get(function() {
  return this.outputMaterials.reduce((total, material) => total + material.quantity, 0);
});

// Virtual for batch duration
productionBatchSchema.virtual('duration').get(function() {
  if (this.endTime && this.startTime) {
    return this.endTime - this.startTime;
  }
  return null;
});

// Pre-save middleware to generate batch ID if not provided
productionBatchSchema.pre('save', async function(next) {
  if (!this.batchId) {
    const count = await this.constructor.countDocuments();
    const plantCode = await mongoose.model('Plant').findById(this.plant).select('code');
    const code = plantCode ? plantCode.code : 'PLANT';
    this.batchId = `${code}-BATCH-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Method to complete batch
productionBatchSchema.methods.completeBatch = function() {
  this.status = 'completed';
  this.endTime = new Date();
  return this.save();
};

// Method to cancel batch
productionBatchSchema.methods.cancelBatch = function() {
  this.status = 'cancelled';
  this.endTime = new Date();
  return this.save();
};

// Method to add consumed material
productionBatchSchema.methods.addConsumedMaterial = function(materialData) {
  this.consumedMaterials.push(materialData);
  return this.save();
};

// Method to add output material
productionBatchSchema.methods.addOutputMaterial = function(outputData) {
  this.outputMaterials.push(outputData);
  return this.save();
};

module.exports = mongoose.model('ProductionBatch', productionBatchSchema);
