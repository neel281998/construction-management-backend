const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const Notification = require('../models/Notification');
const { authenticateToken } = require('../middleware/auth');

// Get all alerts for user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type, category, priority } = req.query;
    const skip = (page - 1) * limit;

    // Build query based on user role and permissions
    let query = {};
    
    // If user is admin, they can see all alerts
    if (req.user.role === 'admin') {
      // Admin can see all alerts
    } else {
      // Non-admin users can only see alerts targeted to them or their role
      query.$or = [
        { targetUsers: req.user._id },
        { targetRoles: req.user.role },
        { targetRoles: 'all' }
      ];
    }

    // Add filters
    if (status) query.status = status;
    if (type) query.type = type;
    if (category) query.category = category;
    if (priority) query.priority = priority;

    const alerts = await Alert.find(query)
      .populate('targetUsers', 'firstName lastName email')
      .populate('acknowledgedBy.user', 'firstName lastName email')
      .populate('resolvedBy', 'firstName lastName email')
      .populate('metadata.siteId', 'name siteType')
      .populate('metadata.vehicleId', 'vehicleNumber type')
      .populate('metadata.inventoryId', 'materialName materialCategory')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Alert.countDocuments(query);

    res.json({
      success: true,
      data: {
        alerts,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch alerts',
      error: error.message
    });
  }
});

// Get alert by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id)
      .populate('targetUsers', 'firstName lastName email')
      .populate('acknowledgedBy.user', 'firstName lastName email')
      .populate('resolvedBy', 'firstName lastName email')
      .populate('metadata.siteId', 'name siteType')
      .populate('metadata.vehicleId', 'vehicleNumber type')
      .populate('metadata.inventoryId', 'materialName materialCategory');

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    // Check if user has permission to view this alert
    const hasPermission = req.user.role === 'admin' || 
      alert.targetUsers.includes(req.user._id) ||
      alert.targetRoles.includes(req.user.role) ||
      alert.targetRoles.includes('all');

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: { alert }
    });
  } catch (error) {
    console.error('Error fetching alert:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch alert',
      error: error.message
    });
  }
});

// Acknowledge alert
router.post('/:id/acknowledge', authenticateToken, async (req, res) => {
  try {
    const { notes } = req.body;
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    // Check if user has permission to acknowledge this alert
    const hasPermission = req.user.role === 'admin' || 
      alert.targetUsers.includes(req.user._id) ||
      alert.targetRoles.includes(req.user.role) ||
      alert.targetRoles.includes('all');

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await alert.acknowledge(req.user._id, notes);

    res.json({
      success: true,
      message: 'Alert acknowledged successfully',
      data: { alert }
    });
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to acknowledge alert',
      error: error.message
    });
  }
});

// Resolve alert
router.post('/:id/resolve', authenticateToken, async (req, res) => {
  try {
    const { resolutionNotes } = req.body;
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    // Check if user has permission to resolve this alert
    const hasPermission = req.user.role === 'admin' || 
      alert.targetUsers.includes(req.user._id) ||
      alert.targetRoles.includes(req.user.role) ||
      alert.targetRoles.includes('all');

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await alert.resolve(req.user._id, resolutionNotes);

    res.json({
      success: true,
      message: 'Alert resolved successfully',
      data: { alert }
    });
  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve alert',
      error: error.message
    });
  }
});

// Dismiss alert
router.post('/:id/dismiss', authenticateToken, async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    // Check if user has permission to dismiss this alert
    const hasPermission = req.user.role === 'admin' || 
      alert.targetUsers.includes(req.user._id) ||
      alert.targetRoles.includes(req.user.role) ||
      alert.targetRoles.includes('all');

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await alert.dismiss();

    res.json({
      success: true,
      message: 'Alert dismissed successfully',
      data: { alert }
    });
  } catch (error) {
    console.error('Error dismissing alert:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to dismiss alert',
      error: error.message
    });
  }
});

// Get alert statistics
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    let query = {};
    
    // If user is not admin, filter by their permissions
    if (req.user.role !== 'admin') {
      query.$or = [
        { targetUsers: req.user._id },
        { targetRoles: req.user.role },
        { targetRoles: 'all' }
      ];
    }

    const stats = await Alert.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalAlerts = await Alert.countDocuments(query);
    const activeAlerts = await Alert.countDocuments({ ...query, status: 'active' });
    const criticalAlerts = await Alert.countDocuments({ ...query, priority: 'critical', status: 'active' });

    res.json({
      success: true,
      data: {
        total: totalAlerts,
        active: activeAlerts,
        critical: criticalAlerts,
        byStatus: stats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Error fetching alert stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch alert statistics',
      error: error.message
    });
  }
});

// Create new alert (admin only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    const {
      title,
      message,
      type,
      category,
      priority = 'medium',
      targetUsers = [],
      targetRoles = [],
      relatedEntity = {},
      metadata = {},
      expiresAt
    } = req.body;

    const alert = new Alert({
      title,
      message,
      type,
      category,
      priority,
      targetUsers,
      targetRoles,
      relatedEntity,
      metadata,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined
    });

    await alert.save();

    // Create notifications for target users
    if (targetUsers.length > 0) {
      const notifications = targetUsers.map(userId => ({
        recipient: userId,
        title: `New Alert: ${title}`,
        message: message,
        type: type,
        category: category,
        priority: priority,
        metadata: {
          alertId: alert._id,
          ...metadata
        }
      }));

      await Notification.insertMany(notifications);
    }

    res.status(201).json({
      success: true,
      message: 'Alert created successfully',
      data: { alert }
    });
  } catch (error) {
    console.error('Error creating alert:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create alert',
      error: error.message
    });
  }
});

module.exports = router;
