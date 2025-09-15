const mongoose = require('mongoose');

const inventoryDispatchSchema = new mongoose.Schema({
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
  destination: {
    type: {
      type: String,
      enum: ['construction_site', 'storage_site', 'construction_step'],
      required: true
    },
    id: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    details: {
      siteType: String,
      stepName: String,
      stepNumber: Number
    }
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
  dispatchedBy: {
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
    enum: ['dispatched', 'in_transit', 'delivered', 'received', 'cancelled'],
    default: 'dispatched'
  },
  dispatchedAt: {
    type: Date,
    default: Date.now
  },
  expectedDeliveryAt: Date,
  deliveredAt: Date,
  receivedAt: Date,
  notes: String,
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
  }]
}, {
  timestamps: true
});

// Indexes for better query performance
inventoryDispatchSchema.index({ itemId: 1, status: 1 });
inventoryDispatchSchema.index({ fromStorageSite: 1, status: 1 });
inventoryDispatchSchema.index({ 'destination.id': 1, 'destination.type': 1 });
inventoryDispatchSchema.index({ dispatchedBy: 1 });
inventoryDispatchSchema.index({ status: 1, dispatchedAt: -1 });

module.exports = mongoose.model('InventoryDispatch', inventoryDispatchSchema);
