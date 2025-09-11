const express = require('express');
const StorageSite = require('../models/StorageSite');
const User = require('../models/User');
const Inventory = require('../models/Inventory');
const { authenticateToken, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get all storage sites (with access control)
router.get('/', authenticateToken, requirePermission('storage_site.read'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      isActive = 'true'
    } = req.query;
    
    // Build query based on user role
    let query = {};
    
    // If user is not admin, filter by assigned storage sites
    if (req.user.role !== 'admin') {
      query._id = { $in: req.user.assignedStorageSites };
    }
    
    // Apply filters
    if (isActive !== 'all') {
      query.isActive = isActive === 'true';
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } }
      ];
    }
    
    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [storageSites, totalCount] = await Promise.all([
      StorageSite.find(query)
        .populate('assignedManagers.manager', 'firstName lastName email role')
        .populate('assignedManagers.assignedBy', 'firstName lastName email')
        .sort({ name: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      StorageSite.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: {
        storageSites,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + storageSites.length < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });
    
  } catch (error) {
    console.error('Get storage sites error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch storage sites'
    });
  }
});

// Get single storage site
router.get('/:id', authenticateToken, requirePermission('storage_site.read'), async (req, res) => {
  try {
    const storageSite = await StorageSite.findById(req.params.id)
      .populate('assignedManagers.manager', 'firstName lastName email role')
      .populate('assignedManagers.assignedBy', 'firstName lastName email');
    
    if (!storageSite) {
      return res.status(404).json({
        success: false,
        message: 'Storage site not found'
      });
    }
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedStorageSites.includes(storageSite._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this storage site'
      });
    }
    
    // Get inventory summary for this storage site
    const inventorySummary = await Inventory.aggregate([
      { $match: { storageSite: storageSite._id, isActive: true } },
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          lowStockItems: {
            $sum: {
              $cond: [{ $lte: ['$currentStock', '$minimumStock'] }, 1, 0]
            }
          },
          totalValue: { $sum: { $multiply: ['$currentStock', 1] } } // Placeholder calculation
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        storageSite,
        inventorySummary: inventorySummary[0] || { totalItems: 0, lowStockItems: 0, totalValue: 0 }
      }
    });
    
  } catch (error) {
    console.error('Get storage site error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch storage site'
    });
  }
});

// Create new storage site
router.post('/', authenticateToken, requirePermission('storage_site.create'), async (req, res) => {
  try {
    const storageSite = new StorageSite(req.body);
    await storageSite.save();
    
    res.status(201).json({
      success: true,
      message: 'Storage site created successfully',
      data: { storageSite }
    });
    
  } catch (error) {
    console.error('Create storage site error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Storage site name already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create storage site'
    });
  }
});

// Update storage site
router.put('/:id', authenticateToken, requirePermission('storage_site.update'), async (req, res) => {
  try {
    const storageSite = await StorageSite.findById(req.params.id);
    
    if (!storageSite) {
      return res.status(404).json({
        success: false,
        message: 'Storage site not found'
      });
    }
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedStorageSites.includes(storageSite._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this storage site'
      });
    }
    
    // Update storage site fields
    Object.assign(storageSite, req.body);
    await storageSite.save();
    
    res.json({
      success: true,
      message: 'Storage site updated successfully',
      data: { storageSite }
    });
    
  } catch (error) {
    console.error('Update storage site error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Storage site name already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update storage site'
    });
  }
});

// Assign manager to storage site
router.post('/:id/assign-manager', authenticateToken, requirePermission('storage_site.update'), async (req, res) => {
  try {
    const { managerId } = req.body;
    
    if (!managerId) {
      return res.status(400).json({
        success: false,
        message: 'Manager ID is required'
      });
    }
    
    const storageSite = await StorageSite.findById(req.params.id);
    const manager = await User.findById(managerId);
    
    if (!storageSite) {
      return res.status(404).json({
        success: false,
        message: 'Storage site not found'
      });
    }
    
    if (!manager) {
      return res.status(404).json({
        success: false,
        message: 'Manager not found'
      });
    }
    
    // Check if user is an inventory manager
    if (!['inventory_manager', 'inventory_assistant'].includes(manager.role)) {
      return res.status(400).json({
        success: false,
        message: 'User must be an inventory manager or assistant'
      });
    }
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedStorageSites.includes(storageSite._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this storage site'
      });
    }
    
    // Add manager to storage site
    await storageSite.addManager(managerId, req.user._id);
    
    // Add storage site to manager's assigned storage sites
    if (!manager.assignedStorageSites.includes(storageSite._id)) {
      manager.assignedStorageSites.push(storageSite._id);
      await manager.save();
    }
    
    res.json({
      success: true,
      message: 'Manager assigned to storage site successfully'
    });
    
  } catch (error) {
    console.error('Assign manager error:', error);
    
    if (error.message === 'Manager is already assigned to this storage site') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to assign manager to storage site'
    });
  }
});

// Remove manager from storage site
router.delete('/:id/assign-manager/:managerId', authenticateToken, requirePermission('storage_site.update'), async (req, res) => {
  try {
    const storageSite = await StorageSite.findById(req.params.id);
    const manager = await User.findById(req.params.managerId);
    
    if (!storageSite) {
      return res.status(404).json({
        success: false,
        message: 'Storage site not found'
      });
    }
    
    if (!manager) {
      return res.status(404).json({
        success: false,
        message: 'Manager not found'
      });
    }
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedStorageSites.includes(storageSite._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this storage site'
      });
    }
    
    // Remove manager from storage site
    await storageSite.removeManager(req.params.managerId);
    
    // Remove storage site from manager's assigned storage sites
    manager.assignedStorageSites = manager.assignedStorageSites.filter(
      siteId => siteId.toString() !== storageSite._id.toString()
    );
    await manager.save();
    
    res.json({
      success: true,
      message: 'Manager removed from storage site successfully'
    });
    
  } catch (error) {
    console.error('Remove manager error:', error);
    
    if (error.message === 'Manager is not assigned to this storage site') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to remove manager from storage site'
    });
  }
});

// Get available managers for assignment
router.get('/available/managers', authenticateToken, requirePermission('storage_site.read'), async (req, res) => {
  try {
    const managers = await User.find({
      role: { $in: ['inventory_manager', 'inventory_assistant'] },
      isActive: true
    }).select('firstName lastName email role assignedStorageSites');
    
    res.json({
      success: true,
      data: { managers }
    });
    
  } catch (error) {
    console.error('Get available managers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available managers'
    });
  }
});

// Get storage site inventory
router.get('/:id/inventory', authenticateToken, requirePermission('storage_site.read'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      lowStock,
      search
    } = req.query;
    
    const storageSite = await StorageSite.findById(req.params.id);
    
    if (!storageSite) {
      return res.status(404).json({
        success: false,
        message: 'Storage site not found'
      });
    }
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedStorageSites.includes(storageSite._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this storage site'
      });
    }
    
    // Build query
    let query = { 
      storageSite: storageSite._id,
      isActive: true 
    };
    
    // Apply filters
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (lowStock === 'true') {
      query.$expr = { $lte: ['$currentStock', '$minimumStock'] };
    }
    
    if (search) {
      query.$or = [
        { itemName: { $regex: search, $options: 'i' } },
        { 'supplier.name': { $regex: search, $options: 'i' } }
      ];
    }
    
    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [items, totalCount, lowStockCount] = await Promise.all([
      Inventory.find(query)
        .populate('storageSite', 'name code')
        .sort({ itemName: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Inventory.countDocuments(query),
      Inventory.countDocuments({ 
        storageSite: storageSite._id,
        isActive: true,
        $expr: { $lte: ['$currentStock', '$minimumStock'] }
      })
    ]);
    
    res.json({
      success: true,
      data: {
        items,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + items.length < totalCount,
          hasPrev: parseInt(page) > 1
        },
        summary: {
          lowStockCount
        }
      }
    });
    
  } catch (error) {
    console.error('Get storage site inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch storage site inventory'
    });
  }
});

// Delete storage site (soft delete)
router.delete('/:id', authenticateToken, requirePermission('storage_site.delete'), async (req, res) => {
  try {
    const storageSite = await StorageSite.findById(req.params.id);
    
    if (!storageSite) {
      return res.status(404).json({
        success: false,
        message: 'Storage site not found'
      });
    }
    
    // Check if storage site has inventory
    const inventoryCount = await Inventory.countDocuments({
      storageSite: storageSite._id,
      isActive: true
    });
    
    if (inventoryCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete storage site with ${inventoryCount} inventory items. Please transfer or remove all inventory first.`
      });
    }
    
    storageSite.isActive = false;
    await storageSite.save();
    
    res.json({
      success: true,
      message: 'Storage site deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete storage site error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete storage site'
    });
  }
});

module.exports = router;
