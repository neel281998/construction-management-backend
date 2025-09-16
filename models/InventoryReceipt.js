const mongoose = require('mongoose');

const inventoryReceiptSchema = new mongoose.Schema({
  dispatchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryDispatch',
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
  status: {
    type: String,
    enum: ['received', 'verified', 'disputed'],
    default: 'received'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
inventoryReceiptSchema.index({ dispatchId: 1, receivedAt: -1 });
inventoryReceiptSchema.index({ receivedBy: 1 });
inventoryReceiptSchema.index({ status: 1 });

module.exports = mongoose.model('InventoryReceipt', inventoryReceiptSchema);
