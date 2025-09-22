const mongoose = require('mongoose');

const plantOutputDispatchSchema = new mongoose.Schema({
  outputId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PlantOutput',
    required: true
  },
  outputName: {
    type: String,
    required: true
  },
  materialType: {
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
  fromPlant: {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plant',
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
      enum: ['construction_site', 'storage_site', 'construction_step', 'plant'],
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
      stepNumber: Number,
      plantType: String
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
    enum: ['dispatched', 'in_transit', 'delivered', 'received', 'partially_received', 'cancelled'],
    default: 'dispatched'
  },
  receivedQuantity: {
    type: Number,
    default: 0
  },
  remainingQuantity: {
    type: Number,
    default: function() { return this.quantity; }
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
plantOutputDispatchSchema.index({ outputId: 1, status: 1 });
plantOutputDispatchSchema.index({ fromPlant: 1, status: 1 });
plantOutputDispatchSchema.index({ 'destination.id': 1, 'destination.type': 1 });
plantOutputDispatchSchema.index({ dispatchedBy: 1 });
plantOutputDispatchSchema.index({ status: 1, dispatchedAt: -1 });

module.exports = mongoose.model('PlantOutputDispatch', plantOutputDispatchSchema);

