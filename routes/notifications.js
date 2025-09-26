const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { authenticateTokenenticateToken } = require('../middleware/authenticateToken');

// Get all notifications for user
router.get('/', authenticateTokenenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, isRead, type, category } = req.query;
    const skip = (page - 1) * limit;

    let query = { recipient: req.user._id };

    // Add filters
    if (isRead !== undefined) query.isRead = isRead === 'true';
    if (type) query.type = type;
    if (category) query.category = category;

    const notifications = await Notification.find(query)
      .populate('metadata.siteId', 'name siteType')
      .populate('metadata.vehicleId', 'vehicleNumber type')
      .populate('metadata.inventoryId', 'materialName materialCategory')
      .populate('metadata.alertId', 'title type priority')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments(query);

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
});

// Get notification by ID
router.get('/:id', authenticateTokenenticateToken, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id)
      .populate('metadata.siteId', 'name siteType')
      .populate('metadata.vehicleId', 'vehicleNumber type')
      .populate('metadata.inventoryId', 'materialName materialCategory')
      .populate('metadata.alertId', 'title type priority');

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Check if user owns this notification
    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: { notification }
    });
  } catch (error) {
    console.error('Error fetching notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification',
      error: error.message
    });
  }
});

// Mark notification as read
router.post('/:id/read', authenticateToken, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Check if user owns this notification
    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await notification.markAsRead();

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: { notification }
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
});

// Mark notification as unread
router.post('/:id/unread', authenticateToken, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Check if user owns this notification
    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await notification.markAsUnread();

    res.json({
      success: true,
      message: 'Notification marked as unread',
      data: { notification }
    });
  } catch (error) {
    console.error('Error marking notification as unread:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as unread',
      error: error.message
    });
  }
});

// Mark all notifications as read
router.post('/mark-all-read', authenticateToken, async (req, res) => {
  try {
    await Notification.markAllAsRead(req.user._id);

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error.message
    });
  }
});

// Get unread count
router.get('/unread/count', authenticateToken, async (req, res) => {
  try {
    const count = await Notification.getUnreadCount(req.user._id);

    res.json({
      success: true,
      data: { unreadCount: count }
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unread count',
      error: error.message
    });
  }
});

// Delete notification
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Check if user owns this notification
    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await Notification.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error.message
    });
  }
});

// Get notification statistics
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    const stats = await Notification.aggregate([
      { $match: { recipient: req.user._id } },
      {
        $group: {
          _id: '$isRead',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalNotifications = await Notification.countDocuments({ recipient: req.user._id });
    const unreadCount = await Notification.getUnreadCount(req.user._id);

    res.json({
      success: true,
      data: {
        total: totalNotifications,
        unread: unreadCount,
        read: totalNotifications - unreadCount,
        byReadStatus: stats.reduce((acc, stat) => {
          acc[stat._id ? 'read' : 'unread'] = stat.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification statistics',
      error: error.message
    });
  }
});

module.exports = router;
