const mongoose = require('mongoose');

const transferRecordSchema = new mongoose.Schema({
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  transferredTo: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'transferHistory.transferredToType',
    required: true
  },
  transferredToType: {
    type: String,
    required: true,
    enum: ['Site', 'StorageSite', 'Plant']
  },
  transferredAt: {
    type: Date,
    default: Date.now
  },
  transferredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  transferId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryTransfer'
  },
  notes: String
});

const plantOutputSchema = new mongoose.Schema({
  outputId: {
    type: String,
    unique: true
  },
  plant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plant',
    required: true
  },
  batch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductionBatch',
    required: false
  },
  materialType: {
    type: String,
    required: true,
    enum: ['concrete', 'asphalt', 'precast_element', 'other']
  },
  materialName: {
    type: String,
    required: true
  },
  currentStock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  unit: {
    type: String,
    required: true,
    enum: ['cubic_meters', 'tons', 'pieces', 'kg', 'liters']
  },
  minimumStock: {
    type: Number,
    default: 0,
    min: 0
  },
  maximumStock: {
    type: Number,
    default: 1000,
    min: 0
  },
  qualitySpecs: {
    strength: Number,        // MPa for concrete
    temperature: Number,     // °C for asphalt
    dimensions: {
      length: Number,
      width: Number,
      height: Number
    },
    other: mongoose.Schema.Types.Mixed
  },
  productionDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  expiryDate: Date,         // For materials with expiry (like concrete)
  status: {
    type: String,
    required: true,
    enum: ['fresh', 'aging', 'expired', 'transferred'],
    default: 'fresh'
  },
  transferHistory: [transferRecordSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notes: String
}, {
  timestamps: true
});

// Indexes for better query performance
plantOutputSchema.index({ plant: 1, status: 1 });
// outputId already has unique index from unique: true
plantOutputSchema.index({ batch: 1 });
plantOutputSchema.index({ materialType: 1 });
plantOutputSchema.index({ productionDate: -1 });
plantOutputSchema.index({ expiryDate: 1 });

// Virtual for stock percentage
plantOutputSchema.virtual('stockPercentage').get(function() {
  if (this.maximumStock > 0) {
    return (this.currentStock / this.maximumStock) * 100;
  }
  return 0;
});

// Virtual for is low stock
plantOutputSchema.virtual('isLowStock').get(function() {
  return this.currentStock <= this.minimumStock;
});

// Virtual for is expired
plantOutputSchema.virtual('isExpired').get(function() {
  if (this.expiryDate) {
    return new Date() > this.expiryDate;
  }
  return false;
});

// Virtual for total transferred quantity
plantOutputSchema.virtual('totalTransferred').get(function() {
  return this.transferHistory.reduce((total, transfer) => total + transfer.quantity, 0);
});

// Pre-save middleware to generate output ID if not provided
plantOutputSchema.pre('save', async function(next) {
  if (!this.outputId) {
    const count = await this.constructor.countDocuments();
    const plantDoc = await mongoose.model('Plant').findById(this.plant).select('name');
    const prefix = plantDoc && plantDoc.name
      ? plantDoc.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) || 'PLANT'
      : 'PLANT';
    this.outputId = `${prefix}-OUT-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Pre-save middleware to update status based on expiry
plantOutputSchema.pre('save', function(next) {
  if (this.expiryDate && new Date() > this.expiryDate) {
    this.status = 'expired';
  } else if (this.currentStock === 0) {
    this.status = 'transferred';
  } else if (this.expiryDate) {
    const daysUntilExpiry = (this.expiryDate - new Date()) / (1000 * 60 * 60 * 24);
    if (daysUntilExpiry <= 3) {
      this.status = 'aging';
    } else {
      this.status = 'fresh';
    }
  }
  next();
});

// Method to add stock (from production)
plantOutputSchema.methods.addStock = function(quantity, notes) {
  this.currentStock += quantity;
  if (notes) {
    this.notes = notes;
  }
  return this.save();
};

// Method to transfer stock
plantOutputSchema.methods.transferStock = function(quantity, destination, destinationType, userId, transferId, notes) {
  if (quantity > this.currentStock) {
    throw new Error('Insufficient stock for transfer');
  }
  
  this.currentStock -= quantity;
  this.transferHistory.push({
    quantity,
    transferredTo: destination,
    transferredToType: destinationType,
    transferredBy: userId,
    transferId,
    notes
  });
  
  return this.save();
};

// Method to check if material is transferable
plantOutputSchema.methods.isTransferable = function() {
  return this.isActive && 
         this.currentStock > 0 && 
         this.status !== 'expired' &&
         this.status !== 'transferred';
};

// Static method to get low stock outputs
plantOutputSchema.statics.getLowStockOutputs = function(plantId) {
  return this.find({
    plant: plantId,
    isActive: true,
    $expr: { $lte: ['$currentStock', '$minimumStock'] }
  });
};

// Static method to get expiring outputs
plantOutputSchema.statics.getExpiringOutputs = function(plantId, daysAhead = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  
  return this.find({
    plant: plantId,
    isActive: true,
    expiryDate: { $lte: futureDate, $gte: new Date() }
  });
};

module.exports = mongoose.model('PlantOutput', plantOutputSchema);