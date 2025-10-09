
const ActivityLog = require('../models/ActivityLog');

/**
 * Log an activity to the database
 * @param {Object} params - Activity parameters
 * @param {Object} params.user - User object (from req.user)
 * @param {String} params.action - Action type (e.g., 'site_created')
 * @param {String} params.category - Category (e.g., 'site', 'inventory')
 * @param {String} params.title - Activity title
 * @param {String} params.message - Activity message
 * @param {String} params.entityType - Entity type (optional)
 * @param {String} params.entityId - Entity ID (optional)
 * @param {String} params.entityName - Entity name (optional)
 * @param {Object} params.metadata - Additional metadata (optional)
 * @param {String} params.icon - Icon name (optional)
 * @param {String} params.color - Color (optional)
 * @param {Object} params.req - Express request object (optional, for IP and user agent)
 */
async function logActivity({
  user,
  action,
  category,
  title,
  message,
  entityType = null,
  entityId = null,
  entityName = null,
  metadata = {},
  icon = 'information-circle',
  color = 'blue',
  req = null
}) {
  try {
    const activityData = {
      userId: user._id || user.id,
      userName: user.name || `${user.firstName} ${user.lastName}` || user.email,
      userRole: user.role,
      action,
      category,
      title,
      message,
      icon,
      color,
      metadata
    };

    // Add entity information if provided
    if (entityType) activityData.entityType = entityType;
    if (entityId) activityData.entityId = entityId;
    if (entityName) activityData.entityName = entityName;

    // Add IP address and user agent if request object is provided
    if (req) {
      activityData.ipAddress = req.ip || req.connection.remoteAddress;
      activityData.userAgent = req.get('user-agent');
    }

    const activity = new ActivityLog(activityData);
    await activity.save();
    
    return activity;
  } catch (error) {
    console.error('Error logging activity:', error);
    // Don't throw error to prevent breaking the main operation
    return null;
  }
}

/**
 * Get icon and color based on action type
 */
function getActivityStyle(action) {
  const styles = {
    // Site activities
    site_created: { icon: 'construct', color: 'green' },
    site_updated: { icon: 'create', color: 'blue' },
    site_deleted: { icon: 'trash', color: 'red' },
    site_status_changed: { icon: 'swap-horizontal', color: 'orange' },
    site_progress_updated: { icon: 'trending-up', color: 'blue' },
    
    // Plant activities
    plant_created: { icon: 'business', color: 'green' },
    plant_updated: { icon: 'create', color: 'blue' },
    plant_deleted: { icon: 'trash', color: 'red' },
    
    // Storage site activities
    storage_site_created: { icon: 'cube', color: 'green' },
    storage_site_updated: { icon: 'create', color: 'blue' },
    storage_site_deleted: { icon: 'trash', color: 'red' },
    
    // Inventory activities
    inventory_created: { icon: 'add-circle', color: 'green' },
    inventory_updated: { icon: 'create', color: 'blue' },
    inventory_deleted: { icon: 'trash', color: 'red' },
    inventory_restocked: { icon: 'arrow-up', color: 'green' },
    inventory_consumed: { icon: 'arrow-down', color: 'orange' },
    
    // Transfer activities
    inventory_transferred: { icon: 'swap-horizontal', color: 'blue' },
    transfer_received: { icon: 'checkmark-circle', color: 'green' },
    transfer_cancelled: { icon: 'close-circle', color: 'red' },
    
    // Dispatch activities
    inventory_dispatched: { icon: 'send', color: 'blue' },
    dispatch_received: { icon: 'checkmark-circle', color: 'green' },
    dispatch_cancelled: { icon: 'close-circle', color: 'red' },
    
    // Vehicle activities
    vehicle_created: { icon: 'car', color: 'green' },
    vehicle_updated: { icon: 'create', color: 'blue' },
    vehicle_deleted: { icon: 'trash', color: 'red' },
    vehicle_maintenance_scheduled: { icon: 'build', color: 'orange' },
    vehicle_maintenance_completed: { icon: 'checkmark-circle', color: 'green' },
    
    // User activities
    user_created: { icon: 'person-add', color: 'green' },
    user_updated: { icon: 'create', color: 'blue' },
    user_deleted: { icon: 'person-remove', color: 'red' },
    user_role_changed: { icon: 'shield', color: 'orange' },
    
    // Step activities
    step_progress_updated: { icon: 'trending-up', color: 'blue' },
    step_status_changed: { icon: 'swap-horizontal', color: 'orange' },
    step_completed: { icon: 'checkmark-circle', color: 'green' },
    
    // Fuel activities
    fuel_log_created: { icon: 'water', color: 'blue' },
    fuel_transfer_created: { icon: 'swap-horizontal', color: 'blue' },
    vehicle_refueled: { icon: 'car', color: 'blue' },
    fuel_main_storage_created: { icon: 'cube', color: 'green' },
    fuel_main_storage_updated: { icon: 'cube-outline', color: 'blue' },
    fuel_main_storage_deleted: { icon: 'trash', color: 'red' },
    fuel_main_storage_restocked: { icon: 'add-circle', color: 'green' },
    fuel_sub_pump_created: { icon: 'water', color: 'green' },
    fuel_sub_pump_updated: { icon: 'water-outline', color: 'blue' },
    fuel_sub_pump_deleted: { icon: 'trash', color: 'red' },
    fuel_sub_pump_restocked: { icon: 'add-circle', color: 'green' },
    fuel_daily_reading_recorded: { icon: 'document-text', color: 'blue' },
    
    // Default
    default: { icon: 'information-circle', color: 'blue' }
  };

  return styles[action] || styles.default;
}

module.exports = {
  logActivity,
  getActivityStyle
};

