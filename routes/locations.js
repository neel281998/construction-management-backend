const express = require('express');
const router = express.Router();
const Location = require('../models/Location');
const User = require('../models/User');
const Inventory = require('../models/Inventory');
const auth = require('../middleware/auth');

// @route   GET /api/locations
// @desc    Get all locations with optional filtering
// @access  Private (Admin, Inventory Manager)
router.get('/', auth, async (req, res) => {
  try {
    const { 
      type, 
      status, 
      city, 
      state, 
      managerId,
      page = 1, 
      limit = 10,
      search 
    } = req.query;

    // Build filter object
    const filter = { isActive: true };
    
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (city) filter['address.city'] = new RegExp(city, 'i');
    if (state) filter['address.state'] = new RegExp(state, 'i');
    if (managerId) filter['assignedInventoryManagers.user'] = managerId;
    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { code: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }

    // Check user permissions
    if (req.user.role === 'inventory_manager') {
      // Only show locations assigned to this manager
      filter['assignedInventoryManagers.user'] = req.user._id;
    }

    const locations = await Location.find(filter)
      .populate('assignedInventoryManagers.user', 'firstName lastName email phone role')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Location.countDocuments(filter);

    res.json({
      locations,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/locations/:id
// @desc    Get single location by ID
// @access  Private (Admin, Inventory Manager)
router.get('/:id', auth, async (req, res) => {
  try {
    const location = await Location.findById(req.params.id)
      .populate('assignedInventoryManagers.user', 'firstName lastName email phone role')
      .populate({
        path: 'inventoryCount',
        match: { isActive: true }
      });

    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    // Check if user has access to this location
    if (req.user.role === 'inventory_manager') {
      const hasAccess = location.assignedInventoryManagers.some(
        manager => manager.user._id.toString() === req.user._id.toString()
      );
      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied to this location' });
      }
    }

    res.json(location);
  } catch (error) {
    console.error('Error fetching location:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/locations
// @desc    Create new location
// @access  Private (Admin only)
router.post('/', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin role required.' });
    }

    const location = new Location(req.body);
    await location.save();

    res.status(201).json(location);
  } catch (error) {
    console.error('Error creating location:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: Object.values(error.errors).map(err => err.message) 
      });
    }
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Location code already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/locations/:id
// @desc    Update location
// @access  Private (Admin, Inventory Manager with write permission)
router.put('/:id', auth, async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);
    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    // Check permissions
    if (req.user.role === 'inventory_manager') {
      const managerAssignment = location.assignedInventoryManagers.find(
        manager => manager.user.toString() === req.user._id.toString()
      );
      if (!managerAssignment || !managerAssignment.permissions.includes('write')) {
        return res.status(403).json({ message: 'Access denied. Write permission required.' });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update location
    Object.assign(location, req.body);
    await location.save();

    res.json(location);
  } catch (error) {
    console.error('Error updating location:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: Object.values(error.errors).map(err => err.message) 
      });
    }
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Location code already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/locations/:id
// @desc    Delete location (soft delete)
// @access  Private (Admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin role required.' });
    }

    const location = await Location.findById(req.params.id);
    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    // Check if location has active inventory
    const inventoryCount = await Inventory.countDocuments({ 
      locationId: req.params.id, 
      isActive: true 
    });
    
    if (inventoryCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete location. It has ${inventoryCount} active inventory items.` 
      });
    }

    // Soft delete
    location.isActive = false;
    await location.save();

    res.json({ message: 'Location deleted successfully' });
  } catch (error) {
    console.error('Error deleting location:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/locations/:id/assign-manager
// @desc    Assign inventory manager to location
// @access  Private (Admin only)
router.post('/:id/assign-manager', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin role required.' });
    }

    const { userId, isPrimary = false, permissions = ['read', 'write'] } = req.body;

    const location = await Location.findById(req.params.id);
    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is inventory manager
    if (!['inventory_manager', 'inventory_assistant'].includes(user.role)) {
      return res.status(400).json({ message: 'User must be an inventory manager or assistant' });
    }

    // Check if manager is already assigned
    const existingAssignment = location.assignedInventoryManagers.find(
      manager => manager.user.toString() === userId
    );

    if (existingAssignment) {
      return res.status(400).json({ message: 'Manager is already assigned to this location' });
    }

    // If setting as primary, remove primary from others
    if (isPrimary) {
      location.assignedInventoryManagers.forEach(manager => {
        manager.isPrimary = false;
      });
    }

    // Add manager assignment
    location.assignedInventoryManagers.push({
      user: userId,
      isPrimary,
      permissions
    });

    // Also add location to user's assigned locations
    user.assignedLocations.push({
      location: req.params.id,
      isPrimary,
      permissions
    });

    await Promise.all([location.save(), user.save()]);

    res.json({ message: 'Manager assigned successfully' });
  } catch (error) {
    console.error('Error assigning manager:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/locations/:id/remove-manager/:managerId
// @desc    Remove inventory manager from location
// @access  Private (Admin only)
router.delete('/:id/remove-manager/:managerId', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin role required.' });
    }

    const location = await Location.findById(req.params.id);
    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    // Remove manager from location
    location.assignedInventoryManagers = location.assignedInventoryManagers.filter(
      manager => manager.user.toString() !== req.params.managerId
    );

    // Remove location from user's assigned locations
    const user = await User.findById(req.params.managerId);
    if (user) {
      user.assignedLocations = user.assignedLocations.filter(
        assignment => assignment.location.toString() !== req.params.id
      );
      await user.save();
    }

    await location.save();

    res.json({ message: 'Manager removed successfully' });
  } catch (error) {
    console.error('Error removing manager:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/locations/:id/inventory
// @desc    Get inventory for a specific location
// @access  Private (Admin, Inventory Manager)
router.get('/:id/inventory', auth, async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);
    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    // Check if user has access to this location
    if (req.user.role === 'inventory_manager') {
      const hasAccess = location.assignedInventoryManagers.some(
        manager => manager.user.toString() === req.user._id.toString()
      );
      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied to this location' });
      }
    }

    const { 
      category, 
      lowStock, 
      page = 1, 
      limit = 10,
      search 
    } = req.query;

    const filter = { 
      locationId: req.params.id, 
      isActive: true 
    };

    if (category) filter.category = category;
    if (lowStock === 'true') {
      filter.$expr = { $lte: ['$currentStock', '$minimumStock'] };
    }
    if (search) {
      filter.$or = [
        { itemName: new RegExp(search, 'i') },
        { itemCode: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }

    const inventory = await Inventory.find(filter)
      .populate('locationId', 'name code')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Inventory.countDocuments(filter);

    res.json({
      inventory,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching location inventory:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/locations/:id/stats
// @desc    Get location statistics
// @access  Private (Admin, Inventory Manager)
router.get('/:id/stats', auth, async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);
    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    // Check if user has access to this location
    if (req.user.role === 'inventory_manager') {
      const hasAccess = location.assignedInventoryManagers.some(
        manager => manager.user.toString() === req.user._id.toString()
      );
      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied to this location' });
      }
    }

    // Get inventory statistics
    const totalItems = await Inventory.countDocuments({ 
      locationId: req.params.id, 
      isActive: true 
    });

    const lowStockItems = await Inventory.countDocuments({
      locationId: req.params.id,
      isActive: true,
      $expr: { $lte: ['$currentStock', '$minimumStock'] }
    });

    const outOfStockItems = await Inventory.countDocuments({
      locationId: req.params.id,
      isActive: true,
      currentStock: 0
    });

    // Get category breakdown
    const categoryStats = await Inventory.aggregate([
      { $match: { locationId: location._id, isActive: true } },
      { $group: { 
        _id: '$category', 
        count: { $sum: 1 },
        totalStock: { $sum: '$currentStock' }
      }},
      { $sort: { count: -1 } }
    ]);

    res.json({
      totalItems,
      lowStockItems,
      outOfStockItems,
      categoryStats,
      location: {
        name: location.name,
        code: location.code,
        type: location.type,
        status: location.status
      }
    });
  } catch (error) {
    console.error('Error fetching location stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
