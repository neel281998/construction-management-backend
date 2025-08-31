const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
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
  stockType: {
    type: String,
    enum: ['primary', 'secondary'],
    required: true
  },
  materialName: {
    type: String,
    required: true
  },
  quantityM3: {
    type: Number,
    required: true
  },
  unitPrice: {
    type: Number,
    required: true
  },
  totalCost: {
    type: Number,
    required: true
  },
  supplier: {
    type: String
  },
  notes: {
    type: String
  },
  date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
stockSchema.index({ siteId: 1, stepId: 1 });
stockSchema.index({ siteId: 1, date: -1 });
stockSchema.index({ materialName: 1 });

module.exports = mongoose.model('Stock', stockSchema);
