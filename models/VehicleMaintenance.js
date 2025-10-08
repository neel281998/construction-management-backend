const mongoose = require('mongoose');

const vehicleMaintenanceSchema = new mongoose.Schema({
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: true
  },
  // Maintenance type
  maintenanceType: {
    type: String,
    required: true,
    enum: [
      'routine_service',
      'oil_change',
      'brake_service',
      'tire_replacement',
      'engine_repair',
      'transmission_repair',
      'electrical_repair',
      'body_repair',
      'inspection',
      'other'
    ]
  },
  // Maintenance details
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  description: {
    type: String,
    maxlength: 1000
  },
  // Dates
  scheduledDate: {
    type: Date,
    required: true
  },
  completedDate: {
    type: Date
  },
  // Odometer readings
  odometerReading: {
    type: Number,
    min: 0
  },
  // Service provider
  serviceProvider: {
    name: String,
    contact: String,
    address: String
  },
  // Cost information
  cost: {
    labor: {
      type: Number,
      min: 0
    },
    parts: {
      type: Number,
      min: 0
    },
    total: {
      type: Number,
      min: 0
    }
  },
  // Parts replaced
  partsReplaced: [{
    name: String,
    partNumber: String,
    quantity: {
      type: Number,
      min: 1
    },
    cost: {
      type: Number,
      min: 0
    }
  }],
  // Work performed
  workPerformed: [{
    description: String,
    laborHours: Number,
    cost: Number
  }],
  // Next maintenance
  nextMaintenance: {
    type: String,
    maxlength: 500
  },
  nextMaintenanceDate: Date,
  nextMaintenanceOdometer: Number,
  // Status
  status: {
    type: String,
    enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  // Priority
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  // Assigned to
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Documents and images
  documents: [{
    fileId: String, // GridFS file ID
    fileName: String,
    fileType: String,
    category: {
      type: String,
      enum: ['invoice', 'receipt', 'warranty', 'manual', 'other']
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  images: [{
    fileId: String, // GridFS file ID
    fileName: String,
    fileType: String,
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
  // Notes
  notes: {
    type: String,
    maxlength: 1000
  },
  // Warranty information
  warranty: {
    validUntil: Date,
    terms: String
  },
  // Quality check
  qualityCheck: {
    performed: Boolean,
    passed: Boolean,
    notes: String,
    checkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    checkedAt: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for maintenance status
vehicleMaintenanceSchema.virtual('maintenanceStatus').get(function() {
  if (this.status === 'completed') return 'completed';
  if (this.status === 'cancelled') return 'cancelled';
  if (this.status === 'in_progress') return 'in_progress';
  
  const today = new Date();
  const scheduledDate = new Date(this.scheduledDate);
  const daysUntil = Math.ceil((scheduledDate - today) / (1000 * 60 * 60 * 24));
  
  if (daysUntil < 0) return 'overdue';
  if (daysUntil <= 3) return 'due_soon';
  return 'scheduled';
});

// Index for performance
vehicleMaintenanceSchema.index({ vehicleId: 1, scheduledDate: -1 });
vehicleMaintenanceSchema.index({ status: 1 });
vehicleMaintenanceSchema.index({ scheduledDate: 1 });

module.exports = mongoose.model('VehicleMaintenance', vehicleMaintenanceSchema);
