const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
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
  unitPrice: {
    type: Number,
    required: [true, 'Unit price is required'],
    min: [0, 'Unit price cannot be negative']
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
  location: {
    type: String,
    required: [true, 'Storage location is required'],
    trim: true,
    maxlength: [100, 'Location cannot exceed 100 characters']
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
    unitPrice: {
      type: Number,
      required: true,
      min: [0, 'Unit price must be positive']
    },
    totalCost: {
      type: Number,
      required: true
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

// Virtual for total value
inventorySchema.virtual('totalValue').get(function() {
  return this.currentStock * this.unitPrice;
});

// Method to restock item
inventorySchema.methods.restock = function(quantity, unitPrice, supplier, restockedBy, notes = '') {
  const totalCost = quantity * unitPrice;
  
  // Add to restock history
  this.restockHistory.push({
    quantity,
    unitPrice,
    totalCost,
    supplier,
    restockedBy,
    notes
  });
  
  // Update current stock and price
  this.currentStock += quantity;
  this.unitPrice = unitPrice;
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

// Index for performance
inventorySchema.index({ itemCode: 1 });
inventorySchema.index({ category: 1 });
inventorySchema.index({ currentStock: 1, minimumStock: 1 });
inventorySchema.index({ isActive: 1 });

module.exports = mongoose.model('Inventory', inventorySchema);