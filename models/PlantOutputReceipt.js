const mongoose = require('mongoose');

const plantOutputReceiptSchema = new mongoose.Schema({
  dispatchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PlantOutputDispatch',
    required: true
  },
  receivedQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  receivedBy: {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    firstName: {
      type: String,
      required: true
    },
    lastName: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    }
  },
  receivedAt: {
    type: Date,
    default: Date.now
  },
  deliveryImages: [{
    fileId: {
      type: String,
      required: true
    },
    caption: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  notes: String,
  qualityCheck: {
    performed: {
      type: Boolean,
      default: false
    },
    passed: Boolean,
    testResults: [{
      testType: String,
      value: Number,
      unit: String,
      passed: Boolean,
      notes: String
    }],
    checkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    checkedAt: Date
  }
}, {
  timestamps: true
});

// Indexes for better query performance
plantOutputReceiptSchema.index({ dispatchId: 1, receivedAt: -1 });
plantOutputReceiptSchema.index({ receivedBy: 1 });

module.exports = mongoose.model('PlantOutputReceipt', plantOutputReceiptSchema);

