const express = require('express');
const User = require('../models/User');
const { authenticateToken, requirePermission, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all users (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      role,
      search,
      isActive = 'true'
    } = req.query;
    
    // Build query
    let query = {};
    
    if (isActive !== 'all') {
      query.isActive = isActive === 'true';
    }
    
    if (role && role !== 'all') {
      query.role = role;
    }
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [users, totalCount] = await Promise.all([
      User.find(query)
        .select('-password')
        .populate('assignedSites', 'name status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + users.length < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });
    
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
});

// Get single user
router.get('/:id', authenticateToken, requirePermission('user.read'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('assignedSites', 'name status progress');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Users can only view their own profile unless they have admin/manager permissions
    if (req.user._id.toString() !== user._id.toString() && 
        !['admin', 'site_manager'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      data: { user }
    });
    
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user'
    });
  }
});

// Create new user (admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email, phone, password, firstName, lastName, role, assignedSites } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }]
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or phone already exists'
      });
    }
    
    const user = new User({
      email,
      phone,
      password,
      firstName,
      lastName,
      role,
      assignedSites: assignedSites || [],
      isVerified: true // Admin-created users are auto-verified
    });
    
    await user.save();
    
    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { user: userResponse }
    });
    
  } catch (error) {
    console.error('Create user error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create user'
    });
  }
});

// Update user
router.put('/:id', authenticateToken, requirePermission('user.update'), async (req, res) => {
  try {
    const userId = req.params.id;
    const updateData = req.body;
    
    // Users can only update their own profile unless they have admin permissions
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    // Remove sensitive fields that shouldn't be updated via this endpoint
    delete updateData.password;
    delete updateData.role; // Role changes should go through separate endpoint
    delete updateData.permissions;
    delete updateData.isVerified;
    
    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user }
    });
    
  } catch (error) {
    console.error('Update user error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update user'
    });
  }
});

// Update user role (admin only)
router.put('/:id/role', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'Role is required'
      });
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'User role updated successfully',
      data: { user }
    });
    
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user role'
    });
  }
});

// Assign user to sites
router.put('/:id/assign-sites', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { siteIds } = req.body;
    
    if (!Array.isArray(siteIds)) {
      return res.status(400).json({
        success: false,
        message: 'Site IDs must be an array'
      });
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { assignedSites: siteIds },
      { new: true }
    ).select('-password').populate('assignedSites', 'name status');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Sites assigned successfully',
      data: { user }
    });
    
  } catch (error) {
    console.error('Assign sites error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign sites'
    });
  }
});

// Deactivate user (admin only)
router.put('/:id/deactivate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'User deactivated successfully',
      data: { user }
    });
    
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate user'
    });
  }
});

// Activate user (admin only)
router.put('/:id/activate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'User activated successfully',
      data: { user }
    });
    
  } catch (error) {
    console.error('Activate user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate user'
    });
  }
});

// Get user statistics
router.get('/stats/overview', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          active: {
            $sum: {
              $cond: [{ $eq: ['$isActive', true] }, 1, 0]
            }
          },
          verified: {
            $sum: {
              $cond: [{ $eq: ['$isVerified', true] }, 1, 0]
            }
          }
        }
      }
    ]);
    
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const verifiedUsers = await User.countDocuments({ isVerified: true });
    
    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          activeUsers,
          verifiedUsers,
          inactiveUsers: totalUsers - activeUsers
        },
        roleBreakdown: stats
      }
    });
    
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user statistics'
    });
  }
});

// Get available site managers (not assigned to active sites)
router.get('/available/site-managers', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const Site = require('../models/Site');
    
    // Find site managers who are not assigned to active sites
    const assignedManagers = await Site.find({
      status: { $in: ['planning', 'active', 'on_hold'] },
      siteManager: { $exists: true }
    }).distinct('siteManager');
    
    const availableManagers = await User.find({
      role: 'site_manager',
      isActive: true,
      _id: { $nin: assignedManagers }
    }).select('_id firstName lastName email');
    
    res.json({
      success: true,
      data: {
        managers: availableManagers
      }
    });
    
  } catch (error) {
    console.error('Get available site managers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available site managers'
    });
  }
});

// Get available inventory managers (not assigned to active sites)
router.get('/available/inventory-managers', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const Site = require('../models/Site');
    
    // Find inventory managers who are not assigned to active sites
    const assignedManagers = await Site.find({
      status: { $in: ['planning', 'active', 'on_hold'] },
      inventoryManager: { $exists: true }
    }).distinct('inventoryManager');
    
    const availableManagers = await User.find({
      role: 'inventory_manager',
      isActive: true,
      _id: { $nin: assignedManagers }
    }).select('_id firstName lastName email');
    
    res.json({
      success: true,
      data: {
        managers: availableManagers
      }
    });
    
  } catch (error) {
    console.error('Get available inventory managers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available inventory managers'
    });
  }
});

// Fix admin permissions (temporary endpoint)
router.post('/fix-admin-permissions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('Fixing admin permissions...');
    
    // Define the complete admin permissions including plant permissions
    const adminPermissions = [
      'user.create', 'user.read', 'user.update', 'user.delete',
      'site.create', 'site.read', 'site.update', 'site.delete',
      'vehicle.create', 'vehicle.read', 'vehicle.update', 'vehicle.delete',
      'inventory.create', 'inventory.read', 'inventory.update', 'inventory.delete',
      'storage_site.create', 'storage_site.read', 'storage_site.update', 'storage_site.delete',
      'plant.create', 'plant.read', 'plant.update', 'plant.delete',
      'plant_inventory.create', 'plant_inventory.read', 'plant_inventory.update', 'plant_inventory.delete',
      'plant_output.create', 'plant_output.read', 'plant_output.update', 'plant_output.delete',
      'attendance.read', 'attendance.approve',
      'report.generate', 'report.export'
    ];

    // Update all admin users
    const result = await User.updateMany(
      { role: 'admin' },
      { $set: { permissions: adminPermissions } }
    );

    console.log(`Updated ${result.modifiedCount} admin users`);

    res.json({
      success: true,
      message: `Updated permissions for ${result.modifiedCount} admin users`,
      data: {
        modifiedCount: result.modifiedCount,
        permissions: adminPermissions
      }
    });

  } catch (error) {
    console.error('Error fixing admin permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fix admin permissions',
      error: error.message
    });
  }
});

module.exports = router;