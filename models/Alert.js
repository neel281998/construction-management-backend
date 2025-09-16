const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'low_stock',
      'quantity_discrepancy',
      'transfer_completed',
      'vehicle_trip_completed',
      'maintenance_due',
      'system_error',
      'user_action_required'
    ]
  },
  category: {
    type: String,
    required: true,
    enum: ['inventory', 'vehicle', 'system', 'user', 'maintenance']
  },
  severity: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical']
  },
  title: {
    type: String,
    required: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['active', 'acknowledged', 'resolved', 'dismissed'],
    default: 'active'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  acknowledgedAt: Date,
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedAt: Date,
  resolutionNotes: {
    type: String,
    maxlength: [500, 'Resolution notes cannot exceed 500 characters']
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  expiresAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
alertSchema.index({ type: 1, status: 1 });
alertSchema.index({ category: 1, severity: 1 });
alertSchema.index({ assignedTo: 1, status: 1 });
alertSchema.index({ createdBy: 1 });
alertSchema.index({ status: 1, createdAt: -1 });
alertSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for time since creation
alertSchema.virtual('timeSinceCreation').get(function() {
  return Date.now() - this.createdAt.getTime();
});

// Virtual for time since acknowledgment
alertSchema.virtual('timeSinceAcknowledgment').get(function() {
  if (!this.acknowledgedAt) return null;
  return Date.now() - this.acknowledgedAt.getTime();
});

// Virtual for time since resolution
alertSchema.virtual('timeSinceResolution').get(function() {
  if (!this.resolvedAt) return null;
  return Date.now() - this.resolvedAt.getTime();
});

// Pre-save middleware to set priority based on severity
alertSchema.pre('save', function(next) {
  if (this.isModified('severity')) {
    switch (this.severity) {
      case 'critical':
        this.priority = 'urgent';
        break;
      case 'high':
        this.priority = 'high';
        break;
      case 'medium':
        this.priority = 'medium';
        break;
      case 'low':
        this.priority = 'low';
        break;
    }
  }
  next();
});

// Static method to get alert statistics
alertSchema.statics.getAlertStats = async function(userId = null) {
  const matchStage = userId ? { $or: [{ assignedTo: userId }, { createdBy: userId }] } : {};
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const result = {
    active: 0,
    acknowledged: 0,
    resolved: 0,
    dismissed: 0,
    total: 0
  };

  stats.forEach(stat => {
    result[stat._id] = stat.count;
    result.total += stat.count;
  });

  return result;
};

// Static method to get alerts by category
alertSchema.statics.getAlertsByCategory = async function(userId = null, category = null) {
  const matchStage = { ...(userId ? { $or: [{ assignedTo: userId }, { createdBy: userId }] } : {}) };
  if (category) matchStage.category = category;

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        active: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

module.exports = mongoose.model('Alert', alertSchema);
