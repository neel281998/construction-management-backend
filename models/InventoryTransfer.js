const mongoose = require('mongoose');

const inventoryTransferSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: true
  },
  itemName: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  unit: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  fromStorageSite: {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StorageSite',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    code: String
  },
  toStorageSite: {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StorageSite',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    code: String
  },
  vehicle: {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true
    },
    vehicleNumber: {
      type: String,
      required: true
    },
    vehicleType: {
      type: String,
      required: true
    },
    driverName: String,
    driverPhone: String
  },
  transferredBy: {
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
  receivedBy: {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    firstName: String,
    lastName: String,
    email: String
  },
  status: {
    type: String,
    enum: ['in_transit', 'received', 'disputed', 'cancelled'],
    default: 'in_transit'
  },
  transferredAt: {
    type: Date,
    default: Date.now
  },
  receivedAt: Date,
  transferImages: [{
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
  expectedDeliveryAt: Date,
  // Trip tracking
  tripDate: {
    type: Date,
    default: Date.now
  },
  tripNumber: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Indexes for better query performance
inventoryTransferSchema.index({ itemId: 1, status: 1 });
inventoryTransferSchema.index({ fromStorageSite: 1, status: 1 });
inventoryTransferSchema.index({ toStorageSite: 1, status: 1 });
inventoryTransferSchema.index({ vehicle: 1, tripDate: 1 });
inventoryTransferSchema.index({ transferredBy: 1 });
inventoryTransferSchema.index({ status: 1, transferredAt: -1 });

module.exports = mongoose.model('InventoryTransfer', inventoryTransferSchema);
