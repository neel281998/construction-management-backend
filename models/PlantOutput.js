const mongoose = require('mongoose');

const plantOutputSchema = new mongoose.Schema({
  plant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plant',
    required: [true, 'Plant is required']
  },
  outputType: {
    type: String,
    required: [true, 'Output type is required'],
    enum: {
      values: ['concrete', 'asphalt', 'precast'],
      message: 'Invalid output type'
    },
    default: 'concrete'
  },
  batchNumber: {
    type: String,
    required: [true, 'Batch number is required'],
    trim: true,
    maxlength: [50, 'Batch number cannot exceed 50 characters']
  },
  volumeM3: {
    type: Number,
    required: [true, 'Volume is required'],
    min: [0, 'Volume cannot be negative']
  },
  productionDate: {
    type: Date,
    required: [true, 'Production date is required'],
    default: Date.now
  },
  qualityMetrics: {
    strength: {
      type: Number,
      min: [0, 'Strength cannot be negative']
    },
    slump: {
      type: Number,
      min: [0, 'Slump cannot be negative']
    },
    temperature: {
      type: Number,
      min: [-50, 'Temperature cannot be below -50°C'],
      max: [100, 'Temperature cannot exceed 100°C']
    },
    waterCementRatio: {
      type: Number,
      min: [0, 'Water-cement ratio cannot be negative']
    },
    airContent: {
      type: Number,
      min: [0, 'Air content cannot be negative'],
      max: [100, 'Air content cannot exceed 100%']
    },
    testedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    testedAt: {
      type: Date
    },
    testResults: [{
      testType: {
        type: String,
        enum: ['compressive_strength', 'slump_test', 'temperature', 'air_content', 'other']
      },
      value: Number,
      unit: String,
      passed: Boolean,
      notes: String,
      testedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  consumedMaterials: [{
    materialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PlantInventory',
      required: true
    },
    materialName: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [0, 'Quantity cannot be negative']
    },
    unit: {
      type: String,
      required: true
    },
    cost: {
      type: Number,
      min: [0, 'Cost cannot be negative']
    }
  }],
  status: {
    type: String,
    enum: ['produced', 'transferred', 'delivered', 'cancelled'],
    default: 'produced'
  },
  transferHistory: [{
    transferType: {
      type: String,
      enum: ['dispatch', 'transfer', 'direct_delivery'],
      required: true
    },
    destination: {
      type: {
        type: String,
        enum: ['construction_site', 'storage_site', 'plant'],
        required: true
      },
      id: {
        type: String,
        required: true
      },
      name: {
        type: String,
        required: true
      }
    },
    quantity: {
      type: Number,
      required: true,
      min: [0, 'Transfer quantity cannot be negative']
    },
    vehicle: {
      _id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vehicle'
      },
      vehicleNumber: String,
      driverName: String
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
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    receivedAt: Date,
    dispatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryDispatch'
    },
    transferId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryTransfer'
    },
    notes: {
      type: String,
      maxlength: [200, 'Notes cannot exceed 200 characters']
    }
  }],
  productionEfficiency: {
    materialEfficiency: {
      type: Number,
      min: [0, 'Material efficiency cannot be negative'],
      max: [100, 'Material efficiency cannot exceed 100%']
    },
    timeEfficiency: {
      type: Number,
      min: [0, 'Time efficiency cannot be negative'],
      max: [100, 'Time efficiency cannot exceed 100%']
    },
    overallEfficiency: {
      type: Number,
      min: [0, 'Overall efficiency cannot be negative'],
      max: [100, 'Overall efficiency cannot exceed 100%']
    }
  },
  productionNotes: {
    type: String,
    maxlength: [500, 'Production notes cannot exceed 500 characters']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
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

// Virtual for total material cost
plantOutputSchema.virtual('totalMaterialCost').get(function() {
  return this.consumedMaterials.reduce((total, material) => {
    return total + (material.cost || 0);
  }, 0);
});

// Virtual for remaining quantity (not yet transferred)
plantOutputSchema.virtual('remainingQuantity').get(function() {
  const transferredQuantity = this.transferHistory.reduce((total, transfer) => {
    return total + transfer.quantity;
  }, 0);
  return this.volumeM3 - transferredQuantity;
});

// Virtual for production efficiency score
plantOutputSchema.virtual('efficiencyScore').get(function() {
  if (!this.productionEfficiency.overallEfficiency) {
    // Calculate basic efficiency based on material usage
    const totalMaterialCost = this.totalMaterialCost;
    const volumeM3 = this.volumeM3;
    
    if (totalMaterialCost > 0 && volumeM3 > 0) {
      // Simple efficiency calculation - can be enhanced
      return Math.min(100, Math.round((volumeM3 / totalMaterialCost) * 100));
    }
  }
  return this.productionEfficiency.overallEfficiency || 0;
});

// Method to add quality test result
plantOutputSchema.methods.addQualityTest = function(testType, value, unit, passed, notes, testedBy) {
  this.qualityMetrics.testResults.push({
    testType,
    value,
    unit,
    passed,
    notes,
    testedAt: new Date()
  });
  
  this.qualityMetrics.testedBy = testedBy;
  this.qualityMetrics.testedAt = new Date();
  
  return this.save();
};

// Method to transfer output
plantOutputSchema.methods.transferOutput = function(transferType, destination, quantity, vehicle, transferredBy, dispatchId = null, transferId = null, notes = '') {
  if (quantity > this.remainingQuantity) {
    throw new Error('Insufficient quantity available for transfer');
  }
  
  this.transferHistory.push({
    transferType,
    destination,
    quantity,
    vehicle,
    transferredBy,
    dispatchId,
    transferId,
    notes
  });
  
  // Update status if all quantity is transferred
  if (this.remainingQuantity <= 0) {
    this.status = 'transferred';
  }
  
  return this.save();
};

// Method to calculate production efficiency
plantOutputSchema.methods.calculateEfficiency = function() {
  // Material efficiency calculation
  const totalMaterialCost = this.totalMaterialCost;
  const volumeM3 = this.volumeM3;
  
  if (totalMaterialCost > 0 && volumeM3 > 0) {
    // This is a simplified calculation - can be enhanced based on industry standards
    this.productionEfficiency.materialEfficiency = Math.min(100, Math.round((volumeM3 / totalMaterialCost) * 100));
  }
  
  // Time efficiency calculation (can be enhanced with actual production time tracking)
  this.productionEfficiency.timeEfficiency = 85; // Placeholder
  
  // Overall efficiency
  this.productionEfficiency.overallEfficiency = Math.round(
    (this.productionEfficiency.materialEfficiency + this.productionEfficiency.timeEfficiency) / 2
  );
  
  return this.save();
};

// Static method to get production summary for a plant
plantOutputSchema.statics.getProductionSummary = function(plantId, startDate, endDate) {
  const query = {
    plant: plantId,
    isActive: true,
    productionDate: {
      $gte: startDate,
      $lte: endDate
    }
  };
  
  return this.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalVolumeM3: { $sum: '$volumeM3' },
        totalBatches: { $sum: 1 },
        averageEfficiency: { $avg: '$productionEfficiency.overallEfficiency' },
        totalMaterialCost: { $sum: '$totalMaterialCost' }
      }
    }
  ]);
};

// Index for performance
plantOutputSchema.index({ plant: 1, productionDate: -1 });
plantOutputSchema.index({ batchNumber: 1, plant: 1 });
plantOutputSchema.index({ outputType: 1 });
plantOutputSchema.index({ status: 1 });
plantOutputSchema.index({ productionDate: -1 });
plantOutputSchema.index({ isActive: 1 });

module.exports = mongoose.model('PlantOutput', plantOutputSchema);
