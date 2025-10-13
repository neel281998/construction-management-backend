const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  itemName: {
    type: String,
    required: [true, 'Item name is required'],
    trim: true,
    maxlength: [100, 'Item name cannot exceed 100 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: [
        'Building Materials',
        'Steel Products',
        'Safety Equipment',
        'Tools & Equipment',
        'Electrical Supplies',
        'Plumbing Supplies',
        'Finishing Materials',
        'Hardware',
        'Other'
      ],
      message: 'Invalid category'
    }
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  unit: {
    type: String,
    required: [true, 'Unit is required'],
    enum: {
      values: ['kg', 'pieces', 'meters', 'liters', 'tons', 'boxes', 'rolls', 'bags'],
      message: 'Invalid unit type'
    }
  },
  currentStock: {
    type: Number,
    required: [true, 'Current stock is required'],
    min: [0, 'Current stock cannot be negative'],
    default: 0
  },
  minimumStock: {
    type: Number,
    required: [true, 'Minimum stock level is required'],
    min: [0, 'Minimum stock cannot be negative']
  },
  maximumStock: {
    type: Number,
    required: [true, 'Maximum stock level is required'],
    min: [0, 'Maximum stock cannot be negative'],
    validate: {
      validator: function(value) {
        return value >= this.minimumStock;
      },
      message: 'Maximum stock must be greater than or equal to minimum stock'
    }
  },

  supplier: {
    name: {
      type: String,
      required: false, // Made optional
      trim: true,
      maxlength: [100, 'Supplier name cannot exceed 100 characters']
    },
    contact: {
      type: String,
      trim: true,
      match: [/^\+?[\d\s\-\(\)]{10,}$/, 'Please enter a valid contact number']
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    address: {
      type: String,
      trim: true
    }
  },
  storageSite: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StorageSite',
    required: [true, 'Storage site is required']
  },
  lastRestocked: {
    type: Date,
    default: null
  },
  restockHistory: [{
    quantity: {
      type: Number,
      required: false, // Made optional for new items
      min: [0, 'Restock quantity must be positive']
    },
    supplier: {
      type: String,
      required: false // Made optional for new items
    },
    restockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false // Made optional for new items
    },
    restockedAt: {
      type: Date,
      default: Date.now
    },
    notes: {
      type: String,
      maxlength: [200, 'Notes cannot exceed 200 characters']
    },
    vehicle: {
      _id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vehicle',
        required: false
      },
      vehicleNumber: {
        type: String,
        required: false
      },
      vehicleType: {
        type: String,
        required: false
      }
    },
    cost: {
      type: Number,
      required: false,
      min: [0, 'Cost cannot be negative']
    }
  }],
  transferHistory: [{
    fromStorageSite: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StorageSite',
      required: false // Made optional for new items
    },
    toStorageSite: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StorageSite',
      required: false // Made optional for new items
    },
    toPlant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plant',
      required: false
    },
    toConstructionSite: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Site',
      required: false
    },
    toConstructionStep: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Step',
      required: false
    },
    quantity: {
      type: Number,
      required: false, // Made optional for new items
      min: [0, 'Transfer quantity must be positive']
    },
    transferredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false // Made optional for new items
    },
    transferredAt: {
      type: Date,
      default: Date.now
    },
    notes: {
      type: String,
      maxlength: [200, 'Notes cannot exceed 200 characters']
    },
    transferId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryTransfer',
      required: false
    },
    status: {
      type: String,
      enum: ['in_transit', 'delivered', 'cancelled'],
      default: 'in_transit'
    },
    dispatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryDispatch',
      required: false
    }
  }],
  photos: [{
    fileId: String, // GridFS file ID
    caption: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for low stock status
inventorySchema.virtual('isLowStock').get(function() {
  return this.currentStock <= this.minimumStock;
});

// Virtual for stock percentage
inventorySchema.virtual('stockPercentage').get(function() {
  return this.maximumStock > 0 ? Math.round((this.currentStock / this.maximumStock) * 100) : 0;
});



// Method to restock item
inventorySchema.methods.restock = function(quantity, supplier, restockedBy, notes = '', vehicle = null, cost = null) {
  // Add to restock history
  this.restockHistory.push({
    quantity,
    supplier,
    restockedBy,
    notes,
    vehicle,
    cost
  });
  
  // Update current stock
  this.currentStock += quantity;
  this.lastRestocked = new Date();
  
  return this.save();
};

// Method to consume stock
inventorySchema.methods.consumeStock = function(quantity, consumedBy, notes = '') {
  if (quantity > this.currentStock) {
    throw new Error('Insufficient stock available');
  }
  
  this.currentStock -= quantity;
  
  // Add consumption record (you might want a separate schema for this)
  return this.save();
};

// Method to transfer stock to another storage site
inventorySchema.methods.transferToStorageSite = function(toStorageSiteId, quantity, transferredBy, notes = '') {
  if (quantity > this.currentStock) {
    throw new Error('Insufficient stock available for transfer');
  }
  
  if (this.storageSite.toString() === toStorageSiteId.toString()) {
    throw new Error('Cannot transfer to the same storage site');
  }
  
  // Add to transfer history
  this.transferHistory.push({
    fromStorageSite: this.storageSite,
    toStorageSite: toStorageSiteId,
    quantity,
    transferredBy,
    notes
  });
  
  // Decrease current stock
  this.currentStock -= quantity;
  
  return this.save();
};

// Index for performance
inventorySchema.index({ itemName: 1, storageSite: 1 }); // Compound index for unique item per storage site
inventorySchema.index({ itemCode: 1 }, { unique: true, sparse: true }); // Sparse unique index for itemCode
inventorySchema.index({ storageSite: 1 });
inventorySchema.index({ category: 1 });
inventorySchema.index({ currentStock: 1, minimumStock: 1 });
inventorySchema.index({ isActive: 1 });

module.exports = mongoose.model('Inventory', inventorySchema);