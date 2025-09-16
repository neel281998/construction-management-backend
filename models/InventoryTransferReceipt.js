const mongoose = require('mongoose');

const inventoryTransferReceiptSchema = new mongoose.Schema({
  transferId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryTransfer',
    required: true
  },
  receivedQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  quantityDifference: {
    type: Number,
    default: 0
  },
  discrepancyPercentage: {
    type: Number,
    default: 0
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
  receiptImages: [{
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
  status: {
    type: String,
    enum: ['received', 'disputed', 'resolved'],
    default: 'received'
  },
  // Discrepancy handling
  hasDiscrepancy: {
    type: Boolean,
    default: false
  },
  discrepancyReason: String,
  discrepancyResolved: {
    type: Boolean,
    default: false
  },
  resolvedBy: {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    firstName: String,
    lastName: String,
    email: String
  },
  resolvedAt: Date,
  resolutionNotes: String
}, {
  timestamps: true
});

// Indexes for better query performance
inventoryTransferReceiptSchema.index({ transferId: 1 });
inventoryTransferReceiptSchema.index({ receivedBy: 1 });
inventoryTransferReceiptSchema.index({ status: 1 });
inventoryTransferReceiptSchema.index({ hasDiscrepancy: 1 });

module.exports = mongoose.model('InventoryTransferReceipt', inventoryTransferReceiptSchema);
