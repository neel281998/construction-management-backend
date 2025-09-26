const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
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
    enum: ['info', 'success', 'warning', 'error', 'reminder', 'update', 'system']
  },
  category: {
    type: String,
    required: true,
    enum: ['site', 'vehicle', 'inventory', 'staff', 'dispatch', 'receive', 'system', 'maintenance', 'progress']
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  actionUrl: {
    type: String
  },
  actionText: {
    type: String
  },
  relatedEntity: {
    entityType: {
      type: String,
      enum: ['site', 'vehicle', 'inventory', 'user', 'dispatch', 'receipt', 'alert']
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
    },
    alertId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Alert'
    }
  },
  expiresAt: {
    type: Date
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  }
}, {
  timestamps: true
});

// Indexes for better performance
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ type: 1, category: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for time since creation
notificationSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diffInSeconds = Math.floor((now - this.createdAt) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  return `${Math.floor(diffInSeconds / 86400)} days ago`;
});

// Method to mark as read
notificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

// Method to mark as unread
notificationSchema.methods.markAsUnread = function() {
  this.isRead = false;
  this.readAt = undefined;
  return this.save();
};

// Static method to create notification
notificationSchema.statics.createNotification = function(recipientId, title, message, type, category, metadata = {}) {
  return this.create({
    recipient: recipientId,
    title,
    message,
    type,
    category,
    metadata
  });
};

// Static method to create bulk notifications
notificationSchema.statics.createBulkNotifications = function(recipientIds, title, message, type, category, metadata = {}) {
  const notifications = recipientIds.map(recipientId => ({
    recipient: recipientId,
    title,
    message,
    type,
    category,
    metadata
  }));
  return this.insertMany(notifications);
};

// Static method to get unread count for user
notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({ recipient: userId, isRead: false });
};

// Static method to mark all as read for user
notificationSchema.statics.markAllAsRead = function(userId) {
  return this.updateMany(
    { recipient: userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
};

module.exports = mongoose.model('Notification', notificationSchema);
