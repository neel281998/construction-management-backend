const express = require('express');
const router = express.Router();
const Site = require('../models/Site');
const Vehicle = require('../models/Vehicle');
const Inventory = require('../models/Inventory');
const InventoryDispatch = require('../models/InventoryDispatch');
const InventoryReceipt = require('../models/InventoryReceipt');
const Alert = require('../models/Alert');
const ActivityLog = require('../models/ActivityLog');
const { authenticateToken } = require('../middleware/auth');

// Get recent activities from ActivityLog
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { limit = 10, category, userId } = req.query;
    
    // Build query
    const query = {};
    if (category) query.category = category;
    if (userId) query.userId = userId;

    // Fetch activities from ActivityLog
    const activities = await ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('action category title message icon color entityType entityId entityName metadata userName userRole createdAt')
      .lean();

    // Format activities for frontend
    const formattedActivities = activities.map(activity => ({
      id: activity._id,
      type: activity.action,
      category: activity.category,
      title: activity.title,
      message: activity.message,
      icon: activity.icon,
      color: activity.color,
      timestamp: activity.createdAt,
      timeAgo: getTimeAgo(activity.createdAt),
      user: {
        name: activity.userName,
        role: activity.userRole
      },
      entity: activity.entityType ? {
        type: activity.entityType,
        id: activity.entityId,
        name: activity.entityName
      } : null,
      metadata: activity.metadata || {}
    }));

    res.json({
      success: true,
      data: {
        activities: formattedActivities,
        total: formattedActivities.length
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

    // Count activities by time period using ActivityLog
    const todayActivities = await ActivityLog.countDocuments({
      createdAt: { $gte: today, $lt: now }
    });
    
    const yesterdayActivities = await ActivityLog.countDocuments({
      createdAt: { $gte: yesterday, $lt: today }
    });
    
    const thisWeekActivities = await ActivityLog.countDocuments({
      createdAt: { $gte: thisWeek, $lt: now }
    });

    // Count by category using ActivityLog
    const categoryStats = await ActivityLog.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    const categoryCounts = {};
    categoryStats.forEach(stat => {
      categoryCounts[stat._id] = stat.count;
    });

    res.json({
      success: true,
      data: {
        timePeriods: {
          today: todayActivities,
          yesterday: yesterdayActivities,
          thisWeek: thisWeekActivities
        },
        byCategory: categoryCounts
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

module.exports = router;
