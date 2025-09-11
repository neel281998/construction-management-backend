const express = require('express');
const Inventory = require('../models/Inventory');
const StorageSite = require('../models/StorageSite');
const User = require('../models/User');
const { authenticateToken, requirePermission, canAccessStorageSite } = require('../middleware/auth');

const router = express.Router();

// Get low stock alerts for all accessible storage sites
router.get('/', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    const { storageSiteId, page = 1, limit = 10 } = req.query;
    
    // Build query based on user role and access
    let query = {
      isActive: true,
      $expr: { $lte: ['$currentStock', '$minimumStock'] }
    };
    
    // Apply storage site access control for non-admin users
    if (req.user.role !== 'admin') {
      query.storageSite = { $in: req.user.assignedStorageSites };
    }
    
    // Filter by specific storage site if provided
    if (storageSiteId && storageSiteId !== 'all') {
      query.storageSite = storageSiteId;
    }
    
    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [lowStockItems, totalCount] = await Promise.all([
      Inventory.find(query)
        .populate('storageSite', 'name code')
        .sort({ currentStock: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Inventory.countDocuments(query)
    ]);
    
    // Group by storage site for better organization
    const alertsByStorageSite = lowStockItems.reduce((acc, item) => {
      const siteId = item.storageSite._id.toString();
      if (!acc[siteId]) {
        acc[siteId] = {
          storageSite: item.storageSite,
          items: [],
          totalItems: 0,
          criticalItems: 0
        };
      }
      
      acc[siteId].items.push({
        _id: item._id,
        itemName: item.itemName,
        category: item.category,
        currentStock: item.currentStock,
        minimumStock: item.minimumStock,
        unit: item.unit,
        stockPercentage: item.stockPercentage,
        isCritical: item.currentStock === 0
      });
      
      acc[siteId].totalItems++;
      if (item.currentStock === 0) {
        acc[siteId].criticalItems++;
      }
      
      return acc;
    }, {});
    
    res.json({
      success: true,
      data: {
        alerts: Object.values(alertsByStorageSite),
        totalAlerts: totalCount,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + lowStockItems.length < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });
    
  } catch (error) {
    console.error('Get low stock alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch low stock alerts'
    });
  }
});

// Get low stock alerts for a specific storage site
router.get('/storage-site/:storageSiteId', authenticateToken, requirePermission('inventory.read'), canAccessStorageSite, async (req, res) => {
  try {
    const { storageSiteId } = req.params;
    const { page = 1, limit = 10, critical = false } = req.query;
    
    // Build query
    let query = {
      storageSite: storageSiteId,
      isActive: true,
      $expr: { $lte: ['$currentStock', '$minimumStock'] }
    };
    
    // Filter for critical items (zero stock) if requested
    if (critical === 'true') {
      query.currentStock = 0;
    }
    
    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [lowStockItems, totalCount, criticalCount] = await Promise.all([
      Inventory.find(query)
        .populate('storageSite', 'name code')
        .sort({ currentStock: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Inventory.countDocuments(query),
      Inventory.countDocuments({
        storageSite: storageSiteId,
        isActive: true,
        currentStock: 0
      })
    ]);
    
    // Get storage site details
    const storageSite = await StorageSite.findById(storageSiteId);
    
    res.json({
      success: true,
      data: {
        storageSite,
        items: lowStockItems.map(item => ({
          _id: item._id,
          itemName: item.itemName,
          category: item.category,
          currentStock: item.currentStock,
          minimumStock: item.minimumStock,
          maximumStock: item.maximumStock,
          unit: item.unit,
          stockPercentage: item.stockPercentage,
          isCritical: item.currentStock === 0,
          lastRestocked: item.lastRestocked,
          supplier: item.supplier
        })),
        summary: {
          totalLowStock: totalCount,
          criticalItems: criticalCount,
          warningItems: totalCount - criticalCount
        },
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + lowStockItems.length < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });
    
  } catch (error) {
    console.error('Get storage site low stock alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch storage site low stock alerts'
    });
  }
});

// Get low stock alerts summary for dashboard
router.get('/summary', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    // Build query based on user role and access
    let query = {
      isActive: true,
      $expr: { $lte: ['$currentStock', '$minimumStock'] }
    };
    
    // Apply storage site access control for non-admin users
    if (req.user.role !== 'admin') {
      query.storageSite = { $in: req.user.assignedStorageSites };
    }
    
    const [totalLowStock, criticalItems, warningItems] = await Promise.all([
      Inventory.countDocuments(query),
      Inventory.countDocuments({
        ...query,
        currentStock: 0
      }),
      Inventory.countDocuments({
        ...query,
        currentStock: { $gt: 0 }
      })
    ]);
    
    // Get alerts by storage site
    const alertsByStorageSite = await Inventory.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$storageSite',
          totalItems: { $sum: 1 },
          criticalItems: {
            $sum: { $cond: [{ $eq: ['$currentStock', 0] }, 1, 0] }
          },
          warningItems: {
            $sum: { $cond: [{ $gt: ['$currentStock', 0] }, 1, 0] }
          }
        }
      },
      {
        $lookup: {
          from: 'storagesites',
          localField: '_id',
          foreignField: '_id',
          as: 'storageSite'
        }
      },
      { $unwind: '$storageSite' },
      {
        $project: {
          storageSite: {
            _id: '$storageSite._id',
            name: '$storageSite.name',
            code: '$storageSite.code'
          },
          totalItems: 1,
          criticalItems: 1,
          warningItems: 1
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        summary: {
          totalLowStock,
          criticalItems,
          warningItems
        },
        alertsByStorageSite
      }
    });
    
  } catch (error) {
    console.error('Get low stock alerts summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch low stock alerts summary'
    });
  }
});

// Send low stock alerts to assigned managers
router.post('/notify', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    const { storageSiteId, itemIds } = req.body;
    
    // Get low stock items
    let query = {
      isActive: true,
      $expr: { $lte: ['$currentStock', '$minimumStock'] }
    };
    
    if (storageSiteId && storageSiteId !== 'all') {
      query.storageSite = storageSiteId;
    }
    
    if (itemIds && itemIds.length > 0) {
      query._id = { $in: itemIds };
    }
    
    // Apply storage site access control for non-admin users
    if (req.user.role !== 'admin') {
      query.storageSite = { $in: req.user.assignedStorageSites };
    }
    
    const lowStockItems = await Inventory.find(query)
      .populate('storageSite', 'name code assignedManagers')
      .populate('storageSite.assignedManagers.manager', 'firstName lastName email');
    
    // Group items by storage site and get assigned managers
    const notifications = [];
    
    for (const item of lowStockItems) {
      const storageSite = item.storageSite;
      
      // Get active managers for this storage site
      const activeManagers = storageSite.assignedManagers
        .filter(assignment => assignment.isActive)
        .map(assignment => assignment.manager);
      
      for (const manager of activeManagers) {
        notifications.push({
          managerId: manager._id,
          managerName: `${manager.firstName} ${manager.lastName}`,
          managerEmail: manager.email,
          storageSite: {
            _id: storageSite._id,
            name: storageSite.name,
            code: storageSite.code
          },
          item: {
            _id: item._id,
            itemName: item.itemName,
            category: item.category,
            currentStock: item.currentStock,
            minimumStock: item.minimumStock,
            unit: item.unit,
            isCritical: item.currentStock === 0
          }
        });
      }
    }
    
    // Here you would typically send actual notifications (email, push notifications, etc.)
    // For now, we'll just return the notification data
    
    res.json({
      success: true,
      message: 'Low stock alerts prepared for notification',
      data: {
        notifications,
        totalNotifications: notifications.length,
        uniqueManagers: [...new Set(notifications.map(n => n.managerId))].length
      }
    });
    
  } catch (error) {
    console.error('Send low stock alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send low stock alerts'
    });
  }
});

// Get low stock alerts for a specific manager
router.get('/manager/:managerId', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    const { managerId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    // Get manager's assigned storage sites
    const manager = await User.findById(managerId).select('assignedStorageSites');
    
    if (!manager) {
      return res.status(404).json({
        success: false,
        message: 'Manager not found'
      });
    }
    
    // Check if current user can access this manager's data
    if (req.user.role !== 'admin' && req.user._id.toString() !== managerId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    // Build query for manager's assigned storage sites
    const query = {
      storageSite: { $in: manager.assignedStorageSites },
      isActive: true,
      $expr: { $lte: ['$currentStock', '$minimumStock'] }
    };
    
    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [lowStockItems, totalCount] = await Promise.all([
      Inventory.find(query)
        .populate('storageSite', 'name code')
        .sort({ currentStock: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Inventory.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: {
        manager: {
          _id: manager._id,
          assignedStorageSites: manager.assignedStorageSites
        },
        items: lowStockItems,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + lowStockItems.length < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });
    
  } catch (error) {
    console.error('Get manager low stock alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch manager low stock alerts'
    });
  }
});

module.exports = router;
