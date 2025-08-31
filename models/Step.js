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

// Index for efficient queries
stepSchema.index({ siteId: 1, stepNumber: 1 });
stepSchema.index({ siteId: 1, status: 1 });

module.exports = mongoose.model('Step', stepSchema);
