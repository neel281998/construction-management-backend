const mongoose = require('mongoose');

const storageYardInventorySchema = new mongoose.Schema({
  itemName: {
    type: String,
    required: [true, 'Item name is required'],
    trim: true,
    maxlength: [100, 'Item name cannot exceed 100 characters']
  },
  itemCode: {
    type: String,
    required: [true, 'Item code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    match: [/^[A-Z]{3}-\d{3}$/, 'Item code must be in format XXX-000']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: [
        'Cement & Concrete',
        'Steel & Reinforcement',
        'Aggregates',
        'Bricks & Blocks',
        'Tools & Equipment',
        'Safety Equipment',
        'Electrical Materials',
        'Plumbing Materials',
        'Finishing Materials',
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
      values: ['kg', 'pieces', 'meters', 'liters', 'tons', 'bags', 'cubic_meters', 'square_meters'],
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
      required: [true, 'Supplier name is required'],
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
  storageYardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: [true, 'Storage yard is required']
  },
  storageLocation: {
    type: String,
    required: [true, 'Storage location within yard is required'],
    trim: true,
    maxlength: [100, 'Storage location cannot exceed 100 characters']
  },
  lastRestocked: {
    type: Date,
    default: null
  },
  restockHistory: [{
    quantity: {
      type: Number,
      required: true,
      min: [0, 'Restock quantity must be positive']
    },
    supplier: {
      type: String,
      required: true
    },
    restockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    restockedAt: {
      type: Date,
      default: Date.now
    },
    notes: {
      type: String,
      maxlength: [200, 'Notes cannot exceed 200 characters']
    }
  }],
  transferHistory: [{
    toLocation: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [0, 'Transfer quantity must be positive']
    },
    transferredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    transferredAt: {
      type: Date,
      default: Date.now
    },
    notes: {
      type: String,
      maxlength: [200, 'Notes cannot exceed 200 characters']
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
storageYardInventorySchema.virtual('isLowStock').get(function() {
  return this.currentStock <= this.minimumStock;
});

// Virtual for stock percentage
storageYardInventorySchema.virtual('stockPercentage').get(function() {
  return this.maximumStock > 0 ? Math.round((this.currentStock / this.maximumStock) * 100) : 0;
});

// Method to restock item
storageYardInventorySchema.methods.restock = function(quantity, supplier, restockedBy, notes = '') {
  // Add to restock history
  this.restockHistory.push({
    quantity,
    supplier,
    restockedBy,
    notes
  });
  
  // Update current stock
  this.currentStock += quantity;
  this.lastRestocked = new Date();
  
  return this.save();
};

// Method to transfer stock
storageYardInventorySchema.methods.transferStock = function(quantity, toLocation, transferredBy, notes = '') {
  if (quantity > this.currentStock) {
    throw new Error('Insufficient stock available');
  }
  
  // Add to transfer history
  this.transferHistory.push({
    toLocation,
    quantity,
    transferredBy,
    notes
  });
  
  // Reduce current stock
  this.currentStock -= quantity;
  
  return this.save();
};

// Index for performance
storageYardInventorySchema.index({ itemCode: 1 });
storageYardInventorySchema.index({ category: 1 });
storageYardInventorySchema.index({ currentStock: 1, minimumStock: 1 });
storageYardInventorySchema.index({ storageYardId: 1 });
storageYardInventorySchema.index({ storageYardId: 1, category: 1 });
storageYardInventorySchema.index({ storageYardId: 1, isActive: 1 });
storageYardInventorySchema.index({ isActive: 1 });

module.exports = mongoose.model('StorageYardInventory', storageYardInventorySchema);
