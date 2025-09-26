const express = require('express');
const router = express.Router();
const Site = require('../models/Site');
const Vehicle = require('../models/Vehicle');
const Inventory = require('../models/Inventory');
const InventoryDispatch = require('../models/InventoryDispatch');
const InventoryReceipt = require('../models/InventoryReceipt');
const Alert = require('../models/Alert');
const { authenticateToken } = require('../middleware/auth');

// Get recent activities
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const activities = [];

    // Get recent site activities
    const recentSites = await Site.find()
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('name siteType status progress totalProgressM3 estimatedVolumeM3 updatedAt createdAt');

    recentSites.forEach(site => {
      const isNew = new Date() - new Date(site.createdAt) < 24 * 60 * 60 * 1000; // Within 24 hours
      const progressUpdated = new Date() - new Date(site.updatedAt) < 24 * 60 * 60 * 1000; // Within 24 hours

      if (isNew) {
        activities.push({
          id: `site-new-${site._id}`,
          type: 'site_created',
          category: 'site',
          title: 'New Site Added',
          message: `${site.name} has been created`,
          icon: 'construct',
          color: 'green',
          timestamp: site.createdAt,
          metadata: {
            siteId: site._id,
            siteName: site.name,
            siteType: site.siteType
          }
        });
      } else if (progressUpdated && site.progress > 0) {
        activities.push({
          id: `site-progress-${site._id}`,
          type: 'site_progress',
          category: 'site',
          title: 'Site Progress Updated',
          message: `${site.name} is now ${site.progress.toFixed(1)}% complete`,
          icon: 'trending-up',
          color: 'blue',
          timestamp: site.updatedAt,
          metadata: {
            siteId: site._id,
            siteName: site.name,
            progress: site.progress
          }
        });
      }
    });

    // Get recent vehicle activities
    const recentVehicles = await Vehicle.find()
      .sort({ updatedAt: -1 })
      .limit(3)
      .select('vehicleNumber type status lastMaintenanceDate updatedAt');

    recentVehicles.forEach(vehicle => {
      const maintenanceDue = vehicle.lastMaintenanceDate && 
        new Date() - new Date(vehicle.lastMaintenanceDate) > 30 * 24 * 60 * 60 * 1000; // 30 days

      if (maintenanceDue) {
        activities.push({
          id: `vehicle-maintenance-${vehicle._id}`,
          type: 'vehicle_maintenance',
          category: 'vehicle',
          title: 'Vehicle Maintenance Due',
          message: `${vehicle.vehicleNumber} requires maintenance`,
          icon: 'car',
          color: 'orange',
          timestamp: vehicle.updatedAt,
          metadata: {
            vehicleId: vehicle._id,
            vehicleNumber: vehicle.vehicleNumber
          }
        });
      }
    });

    // Get recent inventory activities
    const lowStockItems = await Inventory.aggregate([
      {
        $addFields: {
          threshold: { $multiply: ['$minimumStock', 1.2] } // 20% above minimum
        }
      },
      {
        $match: {
          currentStock: { $lte: '$threshold' }
        }
      },
      {
        $sort: { updatedAt: -1 }
      },
      {
        $limit: 3
      },
      {
        $project: {
          materialName: 1,
          currentStock: 1,
          minimumStock: 1,
          updatedAt: 1
        }
      }
    ]);

    lowStockItems.forEach(item => {
      activities.push({
        id: `inventory-low-${item._id}`,
        type: 'inventory_low_stock',
        category: 'inventory',
        title: 'Low Stock Alert',
        message: `${item.materialName} is running low (${item.currentStock} remaining)`,
        icon: 'warning',
        color: 'red',
        timestamp: item.updatedAt,
        metadata: {
          inventoryId: item._id,
          materialName: item.materialName,
          currentStock: item.currentStock,
          minimumStock: item.minimumStock
        }
      });
    });

    // Get recent dispatch activities
    const recentDispatches = await InventoryDispatch.find()
      .sort({ createdAt: -1 })
      .limit(3)
      .populate('itemId', 'materialName')
      .populate('vehicleId', 'vehicleNumber')
      .select('status itemId vehicleId destinationType destinationId createdAt');

    recentDispatches.forEach(dispatch => {
      activities.push({
        id: `dispatch-${dispatch._id}`,
        type: 'dispatch_created',
        category: 'dispatch',
        title: 'New Dispatch Created',
        message: `${dispatch.itemId.materialName} dispatched via ${dispatch.vehicleId.vehicleNumber}`,
        icon: 'truck',
        color: 'blue',
        timestamp: dispatch.createdAt,
        metadata: {
          dispatchId: dispatch._id,
          materialName: dispatch.itemId.materialName,
          vehicleNumber: dispatch.vehicleId.vehicleNumber
        }
      });
    });

    // Get recent alerts
    const recentAlerts = await Alert.find({
      $or: [
        { targetUsers: req.user._id },
        { targetRoles: req.user.role },
        { targetRoles: 'all' }
      ],
      status: 'active'
    })
      .sort({ createdAt: -1 })
      .limit(3)
      .select('title message type priority createdAt');

    recentAlerts.forEach(alert => {
      activities.push({
        id: `alert-${alert._id}`,
        type: 'alert_created',
        category: 'alert',
        title: 'New Alert',
        message: alert.message,
        icon: 'alert-circle',
        color: alert.priority === 'critical' ? 'red' : alert.priority === 'high' ? 'orange' : 'blue',
        timestamp: alert.createdAt,
        metadata: {
          alertId: alert._id,
          priority: alert.priority
        }
      });
    });

    // Sort all activities by timestamp and limit
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const limitedActivities = activities.slice(0, parseInt(limit));

    // Add time ago formatting
    const formattedActivities = limitedActivities.map(activity => ({
      ...activity,
      timeAgo: getTimeAgo(activity.timestamp)
    }));

    res.json({
      success: true,
      data: {
        activities: formattedActivities,
        total: activities.length
      }
    });
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activities',
      error: error.message
    });
  }
});

// Get activity statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Count activities by time period
    const todayActivities = await getActivityCount(today, now);
    const yesterdayActivities = await getActivityCount(yesterday, today);
    const thisWeekActivities = await getActivityCount(thisWeek, now);

    // Count by category
    const categoryStats = await getCategoryStats();

    res.json({
      success: true,
      data: {
        timePeriods: {
          today: todayActivities,
          yesterday: yesterdayActivities,
          thisWeek: thisWeekActivities
        },
        byCategory: categoryStats
      }
    });
  } catch (error) {
    console.error('Error fetching activity stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity statistics',
      error: error.message
    });
  }
});

// Helper function to get time ago
function getTimeAgo(timestamp) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - new Date(timestamp)) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

// Helper function to get activity count for time period
async function getActivityCount(startDate, endDate) {
  const siteCount = await Site.countDocuments({
    createdAt: { $gte: startDate, $lt: endDate }
  });
  
  const vehicleCount = await Vehicle.countDocuments({
    updatedAt: { $gte: startDate, $lt: endDate }
  });
  
  const dispatchCount = await InventoryDispatch.countDocuments({
    createdAt: { $gte: startDate, $lt: endDate }
  });
  
  const alertCount = await Alert.countDocuments({
    createdAt: { $gte: startDate, $lt: endDate }
  });

  return siteCount + vehicleCount + dispatchCount + alertCount;
}

// Helper function to get category stats
async function getCategoryStats() {
  const siteCount = await Site.countDocuments();
  const vehicleCount = await Vehicle.countDocuments();
  const inventoryCount = await Inventory.countDocuments();
  const dispatchCount = await InventoryDispatch.countDocuments();
  const alertCount = await Alert.countDocuments({ status: 'active' });

  return {
    sites: siteCount,
    vehicles: vehicleCount,
    inventory: inventoryCount,
    dispatch: dispatchCount,
    alerts: alertCount
  };
}

module.exports = router;
