const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  // User who performed the action
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  userRole: {
    type: String,
    required: true
  },
  
  // Activity details
  action: {
    type: String,
    required: true,
    enum: [
      // Site activities
      'site_created', 'site_updated', 'site_deleted', 'site_status_changed', 'site_progress_updated',
      // Plant activities
      'plant_created', 'plant_updated', 'plant_deleted', 'plant_status_changed',
      // Storage site activities
      'storage_site_created', 'storage_site_updated', 'storage_site_deleted',
      // Inventory activities
      'inventory_created', 'inventory_updated', 'inventory_deleted', 'inventory_restocked', 'inventory_consumed',
      // Plant inventory activities
      'plant_inventory_created', 'plant_inventory_updated', 'plant_inventory_deleted', 'plant_inventory_restocked', 'plant_inventory_consumed',
      // Transfer activities
      'inventory_transferred', 'transfer_received', 'transfer_cancelled',
      // Dispatch activities
      'inventory_dispatched', 'dispatch_received', 'dispatch_cancelled',
      // Vehicle activities
      'vehicle_created', 'vehicle_updated', 'vehicle_deleted', 'vehicle_maintenance_scheduled', 'vehicle_maintenance_completed',
      // User activities
      'user_created', 'user_updated', 'user_deleted', 'user_role_changed', 'user_assigned_to_site',
      // Step activities
      'step_created', 'step_updated', 'step_progress_updated', 'step_status_changed', 'step_completed',
      // Fuel activities
      'fuel_log_created', 'fuel_transfer_created', 'fuel_transfer_completed',
      // Other activities
      'alert_created', 'notification_sent', 'report_generated'
    ]
  },
  
  category: {
    type: String,
    required: true,
    enum: ['site', 'plant', 'storage_site', 'inventory', 'transfer', 'dispatch', 'vehicle', 'user', 'step', 'fuel', 'alert', 'other']
  },
  
  // Activity description
  title: {
    type: String,
    required: true
  },
  
  message: {
    type: String,
    required: true
  },
  
  // Icon and color for UI
  icon: {
    type: String,
    default: 'information-circle'
  },
  
  color: {
    type: String,
    default: 'blue',
    enum: ['blue', 'green', 'red', 'orange', 'purple', 'gray']
  },
  
  // Related entity information
  entityType: {
    type: String,
    enum: ['site', 'plant', 'storage_site', 'inventory', 'vehicle', 'user', 'step', 'dispatch', 'transfer', 'fuel_log', 'alert', 'other']
  },
  
  entityId: {
    type: mongoose.Schema.Types.ObjectId
  },
  
  entityName: {
    type: String
  },
  
  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // IP address and device info
  ipAddress: String,
  userAgent: String,
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false // We only need createdAt
});

// Indexes for efficient querying
activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ category: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
activityLogSchema.index({ createdAt: -1 }); // For recent activities

// Auto-delete old activities after 90 days (optional)
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);

