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
    
    // Admin sees all; supervisor and others see only assigned storage sites
    const role = (req.user.role || '').toLowerCase();
    if (role !== 'admin') {
      const assigned = req.user.assignedStorageSites || [];
      query._id = assigned.length ? { $in: assigned } : { $in: [] }; // Empty = no results
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

// Storage site inventory report (must be before /:id)
router.get('/report', authenticateToken, requirePermission('storage_site.read'), async (req, res) => {
  try {
    const { storageSiteId, category, lowStock, startDate, endDate } = req.query;

    let query = { isActive: true };

    if (storageSiteId) {
      query.storageSite = storageSiteId;
    } else if (req.user.role !== 'admin' && req.user.assignedStorageSites && req.user.assignedStorageSites.length > 0) {
      query.storageSite = { $in: req.user.assignedStorageSites };
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (lowStock === 'true') {
      query.$expr = { $lte: ['$currentStock', '$minimumStock'] };
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate + 'T23:59:59.999Z');
      query.$or = [
        { lastRestocked: { $gte: start, $lte: end } },
        { $and: [
          { $or: [{ lastRestocked: null }, { lastRestocked: { $exists: false } }] },
          { createdAt: { $gte: start, $lte: end } }
        ]}
      ];
    }

    const items = await Inventory.find(query)
      .populate('storageSite', 'name code address')
      .populate('restockHistory.restockedBy', 'firstName lastName email role phone')
      .sort({ 'storageSite.name': 1, itemName: 1 })
      .limit(1000)
      .lean();

    const locationStr = (addr) => {
      if (!addr) return '';
      const parts = [addr.street, addr.city, addr.state, addr.zipCode].filter(Boolean);
      return parts.join(', ');
    };

    const rows = items.map((inv) => {
      const site = inv.storageSite;
      const lastRestock = inv.restockHistory && inv.restockHistory.length > 0
        ? inv.restockHistory[inv.restockHistory.length - 1]
        : null;
      const lastRestockUser = lastRestock && lastRestock.restockedBy ? lastRestock.restockedBy : null;

      let stockStatus = 'Normal';
      if (inv.currentStock <= inv.minimumStock) stockStatus = 'Low Stock';
      if (inv.minimumStock > 0 && inv.currentStock === 0) stockStatus = 'Out of Stock';

      return {
        _id: inv._id,
        siteName: site ? site.name : '',
        siteCode: site ? site.code : '',
        location: site && site.address ? locationStr(site.address) : '',
        itemName: inv.itemName,
        unit: inv.unit,
        category: inv.category,
        currentStock: inv.currentStock,
        minimumStock: inv.minimumStock,
        maximumStock: inv.maximumStock,
        stockStatus,
        lastRestockedDate: lastRestock && lastRestock.restockedAt ? lastRestock.restockedAt : (inv.lastRestocked || ''),
        quantityAdded: lastRestock ? lastRestock.quantity : '',
        supplier: lastRestock && lastRestock.supplier ? lastRestock.supplier : (inv.supplier && inv.supplier.name ? inv.supplier.name : ''),
        vehicleNumber: lastRestock && lastRestock.vehicle && lastRestock.vehicle.vehicleNumber
          ? lastRestock.vehicle.vehicleNumber
          : (inv.broughtByVehicle && inv.broughtByVehicle.vehicleNumber ? inv.broughtByVehicle.vehicleNumber : ''),
        cost: lastRestock && lastRestock.cost != null ? lastRestock.cost : '',
        itemCreatedBy: '',
        lastUpdatedBy: '',
        lastRestockedBy: lastRestockUser ? (lastRestockUser.firstName + ' ' + lastRestockUser.lastName).trim() : '',
        userRole: lastRestockUser ? lastRestockUser.role : '',
        userContact: lastRestockUser ? (lastRestockUser.phone || lastRestockUser.email || '') : '',
      };
    });

    res.json({
      success: true,
      data: { report: rows },
    });
  } catch (error) {
    console.error('Storage site report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch storage site report',
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
    
    // Admin can access all; supervisor and others need assignment
    const assigned = (req.user.assignedStorageSites || []).map((id) => id?.toString?.() || id);
    if (req.user.role !== 'admin' && !assigned.includes(storageSite._id.toString())) {
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
    // Generate code if not provided or if provided code doesn't match format
    let code = req.body.code;
    
    if (!code || !/^[A-Z]{2,4}-\d{3}$/.test(code)) {
      // Generate a new code based on the first 2-4 characters of the name
      const namePrefix = req.body.name
        .replace(/[^A-Za-z]/g, '') // Remove non-alphabetic characters
        .substring(0, 4)
        .toUpperCase();
      
      // Find the next available number for this prefix
      const existingCodes = await StorageSite.find({
        code: { $regex: `^${namePrefix}-\\d{3}$` }
      }).select('code');
      
      let nextNumber = 1;
      if (existingCodes.length > 0) {
        const numbers = existingCodes
          .map(site => parseInt(site.code.split('-')[1]))
          .sort((a, b) => b - a);
        nextNumber = numbers[0] + 1;
      }
      
      code = `${namePrefix}-${nextNumber.toString().padStart(3, '0')}`;
    }
    
    // Create storage site with generated or validated code
    const storageSiteData = {
      ...req.body,
      code: code
    };
    
    const storageSite = new StorageSite(storageSiteData);
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
    
    // Admin can access all; supervisor and others need assignment
    const assigned = (req.user.assignedStorageSites || []).map((id) => id?.toString?.() || id);
    if (req.user.role !== 'admin' && !assigned.includes(storageSite._id.toString())) {
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
        message: 'User not found'
      });
    }
    
    // Admin can access all; supervisor and others need assignment
    const assigned = (req.user.assignedStorageSites || []).map((id) => id?.toString?.() || id);
    if (req.user.role !== 'admin' && !assigned.includes(storageSite._id.toString())) {
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
    
    // Admin can access all; supervisor and others need assignment
    const assigned = (req.user.assignedStorageSites || []).map((id) => id?.toString?.() || id);
    if (req.user.role !== 'admin' && !assigned.includes(storageSite._id.toString())) {
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

// Get available managers for assignment (inventory_manager, inventory_assistant only)
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

// Get all users for storage site assignment (all roles - selected users get access to the site)
router.get('/available/users', authenticateToken, requirePermission('storage_site.read'), async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .select('firstName lastName email role assignedStorageSites')
      .sort({ role: 1, firstName: 1, lastName: 1 });
    
    res.json({
      success: true,
      data: { users }
    });
    
  } catch (error) {
    console.error('Get available users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available users'
    });
  }
});

// Get storage site vehicle activity and trip statistics
router.get('/:id/vehicle-activity', authenticateToken, requirePermission('storage_site.read'), async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20, operationType } = req.query;
    
    // Check access permissions
    if (req.user.role !== 'admin') {
      const assignedSites = req.user.assignedStorageSites || [];
      if (!assignedSites.includes(id)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this storage site'
        });
      }
    }
    
    const storageSite = await StorageSite.findById(id)
      .populate('vehicleActivity.vehicle._id', 'vehicleNumber brand model type status')
      .populate('vehicleActivity.inventoryItem._id', 'itemName unit category')
      .populate('vehicleActivity.performedBy', 'firstName lastName email');
    
    if (!storageSite) {
      return res.status(404).json({
        success: false,
        message: 'Storage site not found'
      });
    }
    
    // Get recent vehicle activity
    let recentActivity = storageSite.getRecentVehicleActivity(parseInt(limit));
    
    // Filter by operation type if specified
    if (operationType) {
      recentActivity = recentActivity.filter(activity => 
        activity.operationType === operationType
      );
    }
    
    // Get vehicle usage statistics
    const vehicleStats = storageSite.getVehicleUsageStats();
    
    res.json({
      success: true,
      data: {
        storageSite: {
          _id: storageSite._id,
          name: storageSite.name,
          code: storageSite.code
        },
        recentActivity,
        vehicleStats,
        summary: {
          totalOperations: storageSite.vehicleActivity.length,
          totalTrips: vehicleStats.totalTrips,
          dailyTrips: vehicleStats.dailyTrips,
          vehiclesUsed: vehicleStats.vehiclesUsed.length
        }
      }
    });
    
  } catch (error) {
    console.error('Get storage site vehicle activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch storage site vehicle activity'
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
    
    // Admin can access all; supervisor and others need assignment
    const assigned = (req.user.assignedStorageSites || []).map((id) => id?.toString?.() || id);
    if (req.user.role !== 'admin' && !assigned.includes(storageSite._id.toString())) {
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

// Get managers assigned to a storage site
router.get('/:id/managers', authenticateToken, requirePermission('storage_site.read'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Admin can access all; supervisor and others need assignment
    const assigned = (req.user.assignedStorageSites || []).map((s) => s?.toString?.() || s);
    if (req.user.role !== 'admin' && !assigned.includes(id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this storage site'
      });
    }
    
    const storageSite = await StorageSite.findById(id)
      .populate('assignedManagers.manager', 'firstName lastName email role isActive')
      .select('assignedManagers');
    
    if (!storageSite) {
      return res.status(404).json({
        success: false,
        message: 'Storage site not found'
      });
    }
    
    // Extract managers from assignments
    const managers = storageSite.assignedManagers
      .filter(assignment => assignment.manager && assignment.manager.isActive)
      .map(assignment => ({
        _id: assignment.manager._id,
        firstName: assignment.manager.firstName,
        lastName: assignment.manager.lastName,
        email: assignment.manager.email,
        role: assignment.manager.role,
        assignedDate: assignment.assignedDate
      }));
    
    res.json({
      success: true,
      data: {
        storageSite: {
          id: storageSite._id,
          name: storageSite.name
        },
        managers
      }
    });
    
  } catch (error) {
    console.error('Get storage site managers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch storage site managers'
    });
  }
});

module.exports = router;
