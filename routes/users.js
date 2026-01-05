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

// Check current user permissions (debug endpoint)
router.get('/my-permissions', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: {
          email: req.user.email,
          role: req.user.role,
          permissions: req.user.permissions || []
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get user permissions',
      error: error.message
    });
  }
});

// Fix all user permissions (temporary endpoint)
router.post('/fix-all-permissions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('Fixing all user permissions...');
    
    // Define role permissions (same as in User.js)
    const rolePermissions = {
      admin: [
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
      ],
      site_manager: [
        'site.read', 'site.update',
        'attendance.read', 'attendance.approve',
        'report.generate'
      ],
      supervisor: [
        'user.create', 'user.read',
        'site.create', 'site.read',
        'vehicle.create', 'vehicle.read',
        'inventory.create', 'inventory.read',
        'attendance.read', 'attendance.approve',
        'report.generate'
      ],
      worker: [
        'site.read',
        'attendance.create', 'attendance.read'
      ],
      inventory_manager: [
        'inventory.create', 'inventory.read', 'inventory.update', 'inventory.delete',
        'storage_site.read', 'storage_site.update',
        'report.generate'
      ],
      inventory_assistant: [
        'inventory.read', 'inventory.update',
        'storage_site.read'
      ],
      step_manager: [
        'step.create', 'step.read', 'step.update', 'step.delete',
        'site.read',
        'user.read',
        'report.generate'
      ],
      plant_manager: [
        'plant.read', 'plant.update',
        'plant_inventory.create', 'plant_inventory.read', 'plant_inventory.update',
        'plant_output.create', 'plant_output.read', 'plant_output.update',
        'inventory.read', 'inventory.update',
        'fuel.read', 'fuel.refuel',
        'report.generate'
      ],
      plant_operator: [
        'plant.read',
        'plant_inventory.read', 'plant_inventory.update',
        'plant_output.create', 'plant_output.read', 'plant_output.update',
        'site.read',
        'report.generate'
      ],
      fuel_main_manager: [
        'fuel.create', 'fuel.read', 'fuel.update', 'fuel.delete', 'fuel.restock', 'fuel.reading', 'fuel.refuel',
        'vehicle.read',
        'report.generate'
      ],
      fuel_sub_manager: [
        'fuel.read', 'fuel.update', 'fuel.restock', 'fuel.reading', 'fuel.refuel',
        'vehicle.read',
        'report.generate'
      ]
    };

    // Get all users
    const allUsers = await User.find({});
    console.log(`Found ${allUsers.length} total users`);

    let updatedCount = 0;
    const results = [];

    // Update each user based on their role
    for (const user of allUsers) {
      const expectedPermissions = rolePermissions[user.role] || [];
      
      // Check if permissions need updating
      const currentPermissions = user.permissions || [];
      const needsUpdate = JSON.stringify(currentPermissions.sort()) !== JSON.stringify(expectedPermissions.sort());
      
      if (needsUpdate) {
        console.log(`Updating ${user.role} user: ${user.email}`);
        
        // Update permissions
        user.permissions = expectedPermissions;
        
        // Save the user
        await user.save();
        
        results.push({
          email: user.email,
          role: user.role,
          updated: true,
          permissionsCount: expectedPermissions.length
        });
        updatedCount++;
      } else {
        results.push({
          email: user.email,
          role: user.role,
          updated: false,
          permissionsCount: currentPermissions.length
        });
      }
    }

    console.log(`Updated ${updatedCount} users successfully!`);
    
    res.json({
      success: true,
      message: `Updated ${updatedCount} out of ${allUsers.length} users`,
      updatedCount,
      totalUsers: allUsers.length,
      results
    });

  } catch (error) {
    console.error('Error fixing all user permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fix all user permissions',
      error: error.message
    });
  }
});

// Get all available permissions (admin only)
router.get('/permissions/available', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Define all available permissions grouped by category
    const allPermissions = {
      users: [
        { value: 'user.create', label: 'Create Users', description: 'Create new user accounts' },
        { value: 'user.read', label: 'Read Users', description: 'View user information' },
        { value: 'user.update', label: 'Update Users', description: 'Modify user details' },
        { value: 'user.delete', label: 'Delete Users', description: 'Remove user accounts' }
      ],
      sites: [
        { value: 'site.create', label: 'Create Sites', description: 'Create new construction sites' },
        { value: 'site.read', label: 'Read Sites', description: 'View site information' },
        { value: 'site.update', label: 'Update Sites', description: 'Modify site details and progress' },
        { value: 'site.delete', label: 'Delete Sites', description: 'Remove sites' }
      ],
      vehicles: [
        { value: 'vehicle.create', label: 'Create Vehicles', description: 'Add new vehicles' },
        { value: 'vehicle.read', label: 'Read Vehicles', description: 'View vehicle information' },
        { value: 'vehicle.update', label: 'Update Vehicles', description: 'Modify vehicle details' },
        { value: 'vehicle.delete', label: 'Delete Vehicles', description: 'Remove vehicles' }
      ],
      inventory: [
        { value: 'inventory.create', label: 'Create Inventory', description: 'Add new inventory items' },
        { value: 'inventory.read', label: 'Read Inventory', description: 'View inventory items' },
        { value: 'inventory.update', label: 'Update Inventory', description: 'Modify inventory items' },
        { value: 'inventory.delete', label: 'Delete Inventory', description: 'Remove inventory items' }
      ],
      storage_sites: [
        { value: 'storage_site.create', label: 'Create Storage Sites', description: 'Add new storage sites' },
        { value: 'storage_site.read', label: 'Read Storage Sites', description: 'View storage site information' },
        { value: 'storage_site.update', label: 'Update Storage Sites', description: 'Modify storage site details' },
        { value: 'storage_site.delete', label: 'Delete Storage Sites', description: 'Remove storage sites' }
      ],
      plants: [
        { value: 'plant.create', label: 'Create Plants', description: 'Add new plants' },
        { value: 'plant.read', label: 'Read Plants', description: 'View plant information' },
        { value: 'plant.update', label: 'Update Plants', description: 'Modify plant details' },
        { value: 'plant.delete', label: 'Delete Plants', description: 'Remove plants' }
      ],
      plant_inventory: [
        { value: 'plant_inventory.create', label: 'Create Plant Inventory', description: 'Add plant inventory items' },
        { value: 'plant_inventory.read', label: 'Read Plant Inventory', description: 'View plant inventory' },
        { value: 'plant_inventory.update', label: 'Update Plant Inventory', description: 'Modify plant inventory' },
        { value: 'plant_inventory.delete', label: 'Delete Plant Inventory', description: 'Remove plant inventory' },
        { value: 'plant_inventory.transfer', label: 'Transfer Plant Inventory', description: 'Transfer inventory between plants' }
      ],
      plant_output: [
        { value: 'plant_output.create', label: 'Create Plant Output', description: 'Record plant production output' },
        { value: 'plant_output.read', label: 'Read Plant Output', description: 'View plant output records' },
        { value: 'plant_output.update', label: 'Update Plant Output', description: 'Modify plant output records' },
        { value: 'plant_output.delete', label: 'Delete Plant Output', description: 'Remove plant output records' }
      ],
      fuel: [
        { value: 'fuel.create', label: 'Create Fuel Storage', description: 'Create fuel storage facilities' },
        { value: 'fuel.read', label: 'Read Fuel Data', description: 'View fuel storage and refueling data' },
        { value: 'fuel.update', label: 'Update Fuel Data', description: 'Modify fuel storage information' },
        { value: 'fuel.delete', label: 'Delete Fuel Storage', description: 'Remove fuel storage facilities' },
        { value: 'fuel.restock', label: 'Restock Fuel', description: 'Add fuel to storage' },
        { value: 'fuel.reading', label: 'Record Fuel Readings', description: 'Record daily fuel level readings' },
        { value: 'fuel.refuel', label: 'Refuel Vehicles', description: 'Record vehicle refueling' }
      ],
      steps: [
        { value: 'step.create', label: 'Create Steps', description: 'Create construction steps' },
        { value: 'step.read', label: 'Read Steps', description: 'View step information' },
        { value: 'step.update', label: 'Update Steps', description: 'Modify step details' },
        { value: 'step.delete', label: 'Delete Steps', description: 'Remove steps' }
      ],
      attendance: [
        { value: 'attendance.create', label: 'Create Attendance', description: 'Record attendance' },
        { value: 'attendance.read', label: 'Read Attendance', description: 'View attendance records' },
        { value: 'attendance.approve', label: 'Approve Attendance', description: 'Approve attendance records' }
      ],
      reports: [
        { value: 'report.generate', label: 'Generate Reports', description: 'Create and view reports' },
        { value: 'report.export', label: 'Export Reports', description: 'Export reports to files' }
      ]
    };

    res.json({
      success: true,
      data: {
        permissions: allPermissions,
        flatList: Object.values(allPermissions).flat().map(p => p.value)
      }
    });
  } catch (error) {
    console.error('Error getting available permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get available permissions',
      error: error.message
    });
  }
});

// Update user permissions (admin only)
router.put('/:id/permissions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { permissions } = req.body;
    
    if (!Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        message: 'Permissions must be an array'
      });
    }

    // Get all valid permissions
    const allValidPermissions = [
      'user.create', 'user.read', 'user.update', 'user.delete',
      'site.create', 'site.read', 'site.update', 'site.delete',
      'vehicle.create', 'vehicle.read', 'vehicle.update', 'vehicle.delete',
      'inventory.create', 'inventory.read', 'inventory.update', 'inventory.delete',
      'storage_site.create', 'storage_site.read', 'storage_site.update', 'storage_site.delete',
      'plant.create', 'plant.read', 'plant.update', 'plant.delete',
      'plant_inventory.create', 'plant_inventory.read', 'plant_inventory.update', 'plant_inventory.delete', 'plant_inventory.transfer',
      'plant_output.create', 'plant_output.read', 'plant_output.update', 'plant_output.delete',
      'fuel.create', 'fuel.read', 'fuel.update', 'fuel.delete', 'fuel.restock', 'fuel.reading', 'fuel.refuel',
      'step.create', 'step.read', 'step.update', 'step.delete',
      'attendance.create', 'attendance.read', 'attendance.approve',
      'report.generate', 'report.export'
    ];

    // Validate all permissions are valid
    const invalidPermissions = permissions.filter(p => !allValidPermissions.includes(p));
    if (invalidPermissions.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid permissions provided',
        invalidPermissions
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 
        permissions: permissions,
        hasCustomPermissions: true
      },
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
      message: 'User permissions updated successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Update user permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user permissions',
      error: error.message
    });
  }
});

// Reset user permissions to role defaults (admin only)
router.post('/:id/permissions/reset', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Reset to role-based permissions
    user.hasCustomPermissions = false;
    await user.save(); // This will trigger the pre-save hook to set role-based permissions

    const updatedUser = await User.findById(req.params.id).select('-password');

    res.json({
      success: true,
      message: 'User permissions reset to role defaults',
      data: { user: updatedUser }
    });

  } catch (error) {
    console.error('Reset user permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset user permissions',
      error: error.message
    });
  }
});

// Refresh current user's permissions based on their role
router.post('/refresh-my-permissions', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    // Define role permissions (same as in User.js)
    const rolePermissions = {
      admin: [
        'user.create', 'user.read', 'user.update', 'user.delete',
        'site.create', 'site.read', 'site.update', 'site.delete',
        'vehicle.create', 'vehicle.read', 'vehicle.update', 'vehicle.delete',
        'inventory.create', 'inventory.read', 'inventory.update', 'inventory.delete',
        'storage_site.create', 'storage_site.read', 'storage_site.update', 'storage_site.delete',
        'plant.create', 'plant.read', 'plant.update', 'plant.delete',
        'plant_inventory.create', 'plant_inventory.read', 'plant_inventory.update', 'plant_inventory.delete',
        'plant_output.create', 'plant_output.read', 'plant_output.update', 'plant_output.delete',
        'fuel.create', 'fuel.read', 'fuel.update', 'fuel.delete', 'fuel.restock', 'fuel.reading', 'fuel.refuel',
        'attendance.read', 'attendance.approve',
        'report.generate', 'report.export'
      ],
      site_manager: [
        'site.read', 'site.update',
        'attendance.read', 'attendance.approve',
        'report.generate'
      ],
      supervisor: [
        'user.create', 'user.read',
        'site.create', 'site.read',
        'vehicle.create', 'vehicle.read',
        'inventory.create', 'inventory.read',
        'attendance.read', 'attendance.approve',
        'report.generate'
      ],
      worker: [
        'site.read',
        'attendance.create', 'attendance.read'
      ],
      inventory_manager: [
        'inventory.create', 'inventory.read', 'inventory.update', 'inventory.delete',
        'storage_site.read', 'storage_site.update',
        'report.generate'
      ],
      inventory_assistant: [
        'inventory.read', 'inventory.update',
        'storage_site.read'
      ],
      step_manager: [
        'step.create', 'step.read', 'step.update', 'step.delete',
        'site.read',
        'user.read',
        'report.generate'
      ],
      plant_manager: [
        'plant.read', 'plant.update',
        'plant_inventory.create', 'plant_inventory.read', 'plant_inventory.update',
        'plant_output.create', 'plant_output.read', 'plant_output.update',
        'inventory.read', 'inventory.update',
        'fuel.read', 'fuel.refuel',
        'report.generate'
      ],
      plant_operator: [
        'plant.read',
        'plant_inventory.read', 'plant_inventory.update',
        'plant_output.create', 'plant_output.read', 'plant_output.update',
        'site.read',
        'report.generate'
      ],
      fuel_main_manager: [
        'fuel.create', 'fuel.read', 'fuel.update', 'fuel.delete', 'fuel.restock', 'fuel.reading', 'fuel.refuel',
        'vehicle.read',
        'report.generate'
      ],
      fuel_sub_manager: [
        'fuel.read', 'fuel.update', 'fuel.restock', 'fuel.reading', 'fuel.refuel',
        'vehicle.read',
        'report.generate'
      ]
    };

    const expectedPermissions = rolePermissions[user.role] || [];
    
    // Update permissions
    user.permissions = expectedPermissions;
    await user.save();
    
    res.json({
      success: true,
      message: 'Permissions refreshed successfully',
      data: {
        user: {
          _id: user._id,
          email: user.email,
          role: user.role,
          permissions: user.permissions,
          permissionsCount: user.permissions.length
        }
      }
    });

  } catch (error) {
    console.error('Error refreshing user permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh permissions',
      error: error.message
    });
  }
});

module.exports = router;