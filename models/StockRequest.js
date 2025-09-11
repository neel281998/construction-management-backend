const mongoose = require('mongoose');

const stockRequestSchema = new mongoose.Schema({
  requestNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  siteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
    required: [true, 'Site is required']
  },
  stepId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Step',
    required: [true, 'Step is required']
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Requested by is required']
  },
  requestedItems: [{
    itemName: {
      type: String,
      required: true,
      trim: true
    },
    itemCode: {
      type: String,
      trim: true,
      uppercase: true
    },
    category: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [0, 'Quantity must be positive']
    },
    unit: {
      type: String,
      required: true
    },
    description: {
      type: String,
      trim: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    }
  }],
  preferredStorageYard: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'partially_fulfilled', 'fulfilled', 'rejected', 'cancelled'],
    default: 'pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  fulfilledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  fulfilledAt: {
    type: Date
  },
  fulfillmentDetails: [{
    itemName: String,
    requestedQuantity: Number,
    fulfilledQuantity: Number,
    unit: String,
    fulfilledFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location'
    },
    fulfilledAt: {
      type: Date,
      default: Date.now
    },
    notes: String
  }],
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  rejectionReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Rejection reason cannot exceed 500 characters']
  },
  expectedDeliveryDate: {
    type: Date
  },
  actualDeliveryDate: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for request age
stockRequestSchema.virtual('requestAge').get(function() {
  const now = new Date();
  const diffTime = now - this.createdAt;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for total items requested
stockRequestSchema.virtual('totalItems').get(function() {
  return this.requestedItems.length;
});

// Virtual for total quantity requested
stockRequestSchema.virtual('totalQuantity').get(function() {
  return this.requestedItems.reduce((total, item) => total + item.quantity, 0);
});

// Pre-save middleware to generate request number
stockRequestSchema.pre('save', async function(next) {
  if (this.isNew && !this.requestNumber) {
    const count = await this.constructor.countDocuments();
    this.requestNumber = `SR-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Method to approve request
stockRequestSchema.methods.approve = function(approvedBy, notes = '') {
  this.status = 'approved';
  this.approvedBy = approvedBy;
  this.approvedAt = new Date();
  if (notes) {
    this.notes = notes;
  }
  return this.save();
};

// Method to reject request
stockRequestSchema.methods.reject = function(rejectedBy, reason) {
  this.status = 'rejected';
  this.approvedBy = rejectedBy;
  this.approvedAt = new Date();
  this.rejectionReason = reason;
  return this.save();
};

// Method to fulfill request
stockRequestSchema.methods.fulfill = function(fulfilledBy, fulfillmentDetails) {
  this.status = 'fulfilled';
  this.fulfilledBy = fulfilledBy;
  this.fulfilledAt = new Date();
  this.fulfillmentDetails = fulfillmentDetails;
  return this.save();
};

// Index for performance
stockRequestSchema.index({ requestNumber: 1 });
stockRequestSchema.index({ siteId: 1 });
stockRequestSchema.index({ stepId: 1 });
stockRequestSchema.index({ requestedBy: 1 });
stockRequestSchema.index({ status: 1 });
stockRequestSchema.index({ createdAt: -1 });
stockRequestSchema.index({ isActive: 1 });

module.exports = mongoose.model('StockRequest', stockRequestSchema);
