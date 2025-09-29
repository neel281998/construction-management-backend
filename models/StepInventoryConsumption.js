const mongoose = require('mongoose');

const stepInventoryConsumptionSchema = new mongoose.Schema({
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
  receiptId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StepInventoryReceipt',
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
  // Consumption details
  consumedQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    default: 'm³',
    enum: ['m³', 'kg', 'liters', 'pieces', 'tons', 'sq.m', 'linear.m', 'bags', 'bundles']
  },
  consumptionDate: {
    type: Date,
    default: Date.now
  },
  // Work details
  workDescription: {
    type: String,
    required: true
  },
  workLocation: {
    type: String,
    required: false
  },
  workPhase: {
    type: String,
    required: false
  },
  // Quality and verification
  qualityCheck: {
    performed: {
      type: Boolean,
      default: false
    },
    passed: {
      type: Boolean,
      default: false
    },
    testResults: [{
      testType: String,
      value: Number,
      unit: String,
      passed: Boolean,
      notes: String
    }]
  },
  // Documentation
  consumptionImages: [{
    type: String // URLs to uploaded images
  }],
  notes: {
    type: String
  },
  // User information
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  verificationDate: {
    type: Date,
    required: false
  },
  // Status
  status: {
    type: String,
    enum: ['recorded', 'verified', 'rejected'],
    default: 'recorded'
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
stepInventoryConsumptionSchema.index({ stepId: 1, consumptionDate: -1 });
stepInventoryConsumptionSchema.index({ siteId: 1, consumptionDate: -1 });
stepInventoryConsumptionSchema.index({ receiptId: 1 });
stepInventoryConsumptionSchema.index({ recordedBy: 1 });

// Method to verify consumption
stepInventoryConsumptionSchema.methods.verifyConsumption = function(verifiedBy, verificationNotes) {
  this.status = 'verified';
  this.verifiedBy = verifiedBy;
  this.verificationDate = new Date();
  if (verificationNotes) {
    this.notes = (this.notes || '') + `\nVerification: ${verificationNotes}`;
  }
  return this;
};

// Method to reject consumption
stepInventoryConsumptionSchema.methods.rejectConsumption = function(rejectionReason) {
  this.status = 'rejected';
  this.notes = (this.notes || '') + `\nRejected: ${rejectionReason}`;
  return this;
};

module.exports = mongoose.model('StepInventoryConsumption', stepInventoryConsumptionSchema);





