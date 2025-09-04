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
  sourceInventoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: false // Optional for items not sourced from central inventory
  },
  materialName: {
    type: String,
    required: true
  },
  materialCategory: {
    type: String,
    enum: ['aggregates', 'cement_concrete', 'steel_reinforcement', 'timber_wood', 'tools_equipment', 'finishing_materials', 'other'],
    required: true
  },
  materialType: {
    type: String,
    enum: ['primary', 'secondary', 'auxiliary'],
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
    enum: ['m³', 'kg', 'liters', 'pieces', 'tons', 'sq.m', 'linear.m', 'bags', 'bundles']
  },
  supplier: {
    name: String,
    contact: String,
    address: String,
    phone: String,
    email: String
  },
  specifications: {
    grade: String,
    quality: String,
    brand: String,
    model: String,
    size: String
  },
  status: {
    type: String,
    enum: ['available', 'low_stock', 'out_of_stock', 'ordered', 'received'],
    default: 'available'
  },
  reorderLevel: {
    type: Number,
    default: 0,
    min: 0
  },
  notes: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for efficient queries
siteInventorySchema.index({ siteId: 1, stepId: 1 });
siteInventorySchema.index({ siteId: 1, materialName: 1 });
siteInventorySchema.index({ materialType: 1 });
siteInventorySchema.index({ materialCategory: 1 });
siteInventorySchema.index({ status: 1 });

module.exports = mongoose.model('SiteInventory', siteInventorySchema);
