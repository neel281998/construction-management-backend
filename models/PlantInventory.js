const mongoose = require('mongoose');

const plantInventorySchema = new mongoose.Schema({
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
        'Cement',
        'Aggregates',
        'Water',
        'Admixtures',
        'Steel Reinforcement',
        'Concrete Mix',
        'Tools & Equipment',
        'Safety Equipment',
        'Other'
      ],
      message: 'Invalid category'
    }
  },
  materialType: {
    type: String,
    required: [true, 'Material type is required'],
    enum: {
      values: ['raw_material', 'finished_product', 'consumable'],
      message: 'Invalid material type'
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
      values: ['kg', 'tons', 'cubic_meters', 'liters', 'pieces', 'bags', 'cubic_feet'],
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
  consumptionRate: {
    daily: {
      type: Number,
      default: 0,
      min: [0, 'Daily consumption rate cannot be negative']
    },
    weekly: {
      type: Number,
      default: 0,
      min: [0, 'Weekly consumption rate cannot be negative']
    },
    monthly: {
      type: Number,
      default: 0,
      min: [0, 'Monthly consumption rate cannot be negative']
    }
  },
  supplier: {
    name: {
      type: String,
      required: false,
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
  plant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plant',
    required: [true, 'Plant is required']
  },
  lastRestocked: {
    type: Date,
    default: null
  },
  restockHistory: [{
    quantity: {
      type: Number,
      required: false,
      min: [0, 'Restock quantity must be positive']
    },
    supplier: {
      type: String,
      required: false
    },
    restockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false
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
  consumptionHistory: [{
    quantity: {
      type: Number,
      required: true,
      min: [0, 'Consumption quantity must be positive']
    },
    consumedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    consumedAt: {
      type: Date,
      default: Date.now
    },
    productionBatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PlantOutput',
      required: false
    },
    dispatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryDispatch',
      required: false
    },
    notes: {
      type: String,
      maxlength: [200, 'Notes cannot exceed 200 characters']
    }
  }],
  transferHistory: [{
    fromPlant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plant',
      required: false
    },
    toPlant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plant',
      required: false
    },
    fromStorageSite: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StorageSite',
      required: false
    },
    toStorageSite: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StorageSite',
      required: false
    },
    quantity: {
      type: Number,
      required: false,
      min: [0, 'Transfer quantity must be positive']
    },
    transferredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false
    },
    transferredAt: {
      type: Date,
      default: Date.now
    },
    notes: {
      type: String,
      maxlength: [200, 'Notes cannot exceed 200 characters']
    },
    dispatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryDispatch',
      required: false
    },
    transferId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryTransfer',
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
plantInventorySchema.virtual('isLowStock').get(function() {
  return this.currentStock <= this.minimumStock;
});

// Virtual for stock percentage
plantInventorySchema.virtual('stockPercentage').get(function() {
  return this.maximumStock > 0 ? Math.round((this.currentStock / this.maximumStock) * 100) : 0;
});

// Method to restock item
plantInventorySchema.methods.restock = function(quantity, supplier, restockedBy, notes = '') {
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

// Method to consume stock
plantInventorySchema.methods.consumeStock = function(quantity, consumedBy, productionBatchId = null, dispatchId = null, notes = '') {
  if (quantity > this.currentStock) {
    throw new Error('Insufficient stock available');
  }
  
  // Add to consumption history
  this.consumptionHistory.push({
    quantity,
    consumedBy,
    productionBatchId,
    dispatchId,
    notes
  });
  
  // Update current stock
  this.currentStock -= quantity;
  
  return this.save();
};

// Method to transfer stock
plantInventorySchema.methods.transferStock = function(toPlantId, toStorageSiteId, quantity, transferredBy, dispatchId = null, transferId = null, notes = '') {
  if (quantity > this.currentStock) {
    throw new Error('Insufficient stock available for transfer');
  }
  
  if (toPlantId && this.plant.toString() === toPlantId.toString()) {
    throw new Error('Cannot transfer to the same plant');
  }
  
  if (toStorageSiteId && this.plant.toString() === toStorageSiteId.toString()) {
    throw new Error('Cannot transfer to the same storage site');
  }
  
  // Add to transfer history
  this.transferHistory.push({
    fromPlant: this.plant,
    toPlant: toPlantId,
    fromStorageSite: null,
    toStorageSite: toStorageSiteId,
    quantity,
    transferredBy,
    dispatchId,
    transferId,
    notes
  });
  
  // Decrease current stock
  this.currentStock -= quantity;
  
  return this.save();
};

// Method to update consumption rates
plantInventorySchema.methods.updateConsumptionRates = function() {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  // Calculate daily consumption
  const dailyConsumption = this.consumptionHistory
    .filter(record => new Date(record.consumedAt) >= oneDayAgo)
    .reduce((sum, record) => sum + record.quantity, 0);
  
  // Calculate weekly consumption
  const weeklyConsumption = this.consumptionHistory
    .filter(record => new Date(record.consumedAt) >= oneWeekAgo)
    .reduce((sum, record) => sum + record.quantity, 0);
  
  // Calculate monthly consumption
  const monthlyConsumption = this.consumptionHistory
    .filter(record => new Date(record.consumedAt) >= oneMonthAgo)
    .reduce((sum, record) => sum + record.quantity, 0);
  
  this.consumptionRate.daily = dailyConsumption;
  this.consumptionRate.weekly = weeklyConsumption;
  this.consumptionRate.monthly = monthlyConsumption;
  
  return this.save();
};

// Index for performance
plantInventorySchema.index({ itemName: 1, plant: 1 }); // Compound index for unique item per plant
plantInventorySchema.index({ itemCode: 1 }, { unique: true, sparse: true });
plantInventorySchema.index({ plant: 1 });
plantInventorySchema.index({ category: 1 });
plantInventorySchema.index({ materialType: 1 });
plantInventorySchema.index({ currentStock: 1, minimumStock: 1 });
plantInventorySchema.index({ isActive: 1 });

module.exports = mongoose.model('PlantInventory', plantInventorySchema);
