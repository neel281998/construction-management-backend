const mongoose = require('mongoose');

const siteInventorySchema = new mongoose.Schema({
  siteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
    required: true
  },
  stepId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Step',
    required: true
  },
  materialName: {
    type: String,
    required: true
  },
  materialType: {
    type: String,
    enum: ['primary', 'secondary'],
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    default: 'm³',
    enum: ['m³', 'kg', 'liters', 'pieces', 'tons']
  },
  estimatedCost: {
    type: Number,
    default: 0,
    min: 0
  },
  supplier: {
    type: String
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

// Index for efficient queries
siteInventorySchema.index({ siteId: 1, stepId: 1 });
siteInventorySchema.index({ siteId: 1, materialName: 1 });
siteInventorySchema.index({ materialType: 1 });

module.exports = mongoose.model('SiteInventory', siteInventorySchema);
