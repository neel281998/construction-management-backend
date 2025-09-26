const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['info', 'warning', 'error', 'success', 'maintenance', 'low_stock', 'vehicle_issue', 'site_issue', 'system']
  },
  priority: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  category: {
    type: String,
    required: true,
    enum: ['site', 'vehicle', 'inventory', 'staff', 'system', 'maintenance', 'dispatch', 'receive']
  },
  status: {
    type: String,
    required: true,
    enum: ['active', 'acknowledged', 'resolved', 'dismissed'],
    default: 'active'
  },
  targetUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  targetRoles: [{
    type: String,
    enum: ['admin', 'site_manager', 'inventory_manager', 'vehicle_manager', 'staff']
  }],
  relatedEntity: {
    entityType: {
      type: String,
      enum: ['site', 'vehicle', 'inventory', 'user', 'dispatch', 'receipt']
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId
    }
  },
  metadata: {
    siteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Site'
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle'
    },
    inventoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory'
    },
    dispatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryDispatch'
    }
  },
  acknowledgedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    acknowledgedAt: {
      type: Date,
      default: Date.now
    },
    notes: String
  }],
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedAt: {
    type: Date
  },
  resolutionNotes: String,
  expiresAt: {
    type: Date
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes for better performance
alertSchema.index({ status: 1, createdAt: -1 });
alertSchema.index({ targetUsers: 1, status: 1 });
alertSchema.index({ targetRoles: 1, status: 1 });
alertSchema.index({ type: 1, category: 1 });
alertSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for time since creation
alertSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diffInSeconds = Math.floor((now - this.createdAt) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  return `${Math.floor(diffInSeconds / 86400)} days ago`;
});

// Method to acknowledge alert
alertSchema.methods.acknowledge = function(userId, notes = '') {
  if (this.status === 'active') {
    this.acknowledgedBy.push({
      user: userId,
      acknowledgedAt: new Date(),
      notes
    });
    this.status = 'acknowledged';
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to resolve alert
alertSchema.methods.resolve = function(userId, resolutionNotes = '') {
  this.resolvedBy = userId;
  this.resolvedAt = new Date();
  this.resolutionNotes = resolutionNotes;
  this.status = 'resolved';
  return this.save();
};

// Method to dismiss alert
alertSchema.methods.dismiss = function() {
  this.status = 'dismissed';
  return this.save();
};

// Static method to create system alerts
alertSchema.statics.createSystemAlert = function(title, message, type, category, priority = 'medium', metadata = {}) {
  return this.create({
    title,
    message,
    type,
    category,
    priority,
    metadata,
    targetRoles: ['admin']
  });
};

// Static method to create low stock alert
alertSchema.statics.createLowStockAlert = function(inventoryItem, currentStock, minimumStock) {
  return this.create({
    title: 'Low Stock Alert',
    message: `${inventoryItem.materialName} is running low. Current: ${currentStock}, Minimum: ${minimumStock}`,
    type: 'warning',
    category: 'inventory',
    priority: 'high',
    metadata: {
      inventoryId: inventoryItem._id,
      siteId: inventoryItem.siteId
    },
    targetRoles: ['inventory_manager', 'admin']
  });
};

// Static method to create vehicle maintenance alert
alertSchema.statics.createVehicleMaintenanceAlert = function(vehicle, maintenanceType, daysUntilDue) {
  return this.create({
    title: 'Vehicle Maintenance Due',
    message: `${vehicle.vehicleNumber} requires ${maintenanceType} in ${daysUntilDue} days`,
    type: 'warning',
    category: 'maintenance',
    priority: daysUntilDue <= 1 ? 'critical' : 'medium',
    metadata: {
      vehicleId: vehicle._id
    },
    targetRoles: ['vehicle_manager', 'admin']
  });
};

module.exports = mongoose.model('Alert', alertSchema);