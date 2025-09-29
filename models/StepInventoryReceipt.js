const mongoose = require('mongoose');

const stepInventoryReceiptSchema = new mongoose.Schema({
  stepId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Step',
    required: true
  },
  siteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
    required: true
  },
  // Source information
  sourceType: {
    type: String,
    enum: ['plant', 'storage_site'],
    required: true
  },
  sourceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  sourceName: {
    type: String,
    required: true
  },
  // Material information
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
  // Quality and specifications
  qualityGrade: {
    type: String,
    required: false
  },
  specifications: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  },
  // Delivery information
  deliveryDate: {
    type: Date,
    default: Date.now
  },
  deliveryImages: [{
    type: String // URLs to uploaded images
  }],
  deliveryNotes: {
    type: String
  },
  // Verification
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  verificationDate: {
    type: Date,
    default: Date.now
  },
  verificationNotes: {
    type: String
  },
  // Status
  status: {
    type: String,
    enum: ['received', 'verified', 'rejected'],
    default: 'received'
  },
  // Consumption tracking
  consumedQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  remainingQuantity: {
    type: Number,
    default: function() {
      return this.quantity;
    }
  },
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
stepInventoryReceiptSchema.index({ stepId: 1, status: 1 });
stepInventoryReceiptSchema.index({ siteId: 1, deliveryDate: -1 });
stepInventoryReceiptSchema.index({ sourceType: 1, sourceId: 1 });

// Virtual for consumption percentage
stepInventoryReceiptSchema.virtual('consumptionPercentage').get(function() {
  if (this.quantity === 0) return 0;
  return (this.consumedQuantity / this.quantity) * 100;
});

// Method to update remaining quantity
stepInventoryReceiptSchema.methods.updateRemainingQuantity = function() {
  this.remainingQuantity = this.quantity - this.consumedQuantity;
  return this.remainingQuantity;
};

// Method to consume inventory
stepInventoryReceiptSchema.methods.consumeInventory = function(quantity, notes) {
  if (quantity > this.remainingQuantity) {
    throw new Error('Insufficient inventory remaining');
  }
  
  this.consumedQuantity += quantity;
  this.remainingQuantity = this.quantity - this.consumedQuantity;
  
  return {
    consumedQuantity: this.consumedQuantity,
    remainingQuantity: this.remainingQuantity,
    consumptionPercentage: this.consumptionPercentage
  };
};

// Pre-save middleware to update remaining quantity
stepInventoryReceiptSchema.pre('save', function(next) {
  this.remainingQuantity = this.quantity - this.consumedQuantity;
  next();
});

module.exports = mongoose.model('StepInventoryReceipt', stepInventoryReceiptSchema);





