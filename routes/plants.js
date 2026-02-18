const express = require('express');
const Plant = require('../models/Plant');
const PlantInventory = require('../models/PlantInventory');
const PlantOutput = require('../models/PlantOutput');
const User = require('../models/User');
const { authenticateToken, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get all plants
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Check permissions - admin and supervisor bypass; others need plant.read
    const role = (req.user.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'supervisor' && !req.user.permissions?.includes('plant.read')) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    const {
      page = 1,
      limit = 10,
      plantType,
      search,
      isActive,
      allForTransfer
    } = req.query;
    
    // Build query
    let query = {};
    
    // When loading destinations for inventory transfer, show all plants (user must have inventory.update)
    const forTransfer = allForTransfer === 'true' && (role === 'admin' || req.user.permissions?.includes('inventory.update'));
    
    // Admin sees all plants; supervisor and others see only assigned plants (unless forTransfer)
    if (!forTransfer && role !== 'admin') {
      const assignedPlants = req.user.assignedPlants || [];
      if (assignedPlants.length === 0) {
        return res.json({
          success: true,
          data: { plants: [], pagination: { currentPage: 1, totalPages: 0, totalCount: 0, hasNext: false, hasPrev: false } }
        });
      }
      query._id = { $in: assignedPlants };
    }
    
    // Apply filters
    if (plantType && plantType !== 'all') {
      query.plantType = plantType;
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [plants, totalCount] = await Promise.all([
      Plant.find(query)
        .populate('assignedManagers.manager', 'firstName lastName email role')
        .sort({ name: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Plant.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: {
        plants,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + plants.length < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });
    
  } catch (error) {
    console.error('Get plants error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plants'
    });
  }
});

// Get single plant
router.get('/:id', authenticateToken, requirePermission('plant.read'), async (req, res) => {
  try {
    const plant = await Plant.findById(req.params.id)
      .populate('assignedManagers.manager', 'firstName lastName email role')
      .populate('assignedManagers.assignedBy', 'firstName lastName email');
    
    if (!plant) {
      return res.status(404).json({
        success: false,
        message: 'Plant not found'
      });
    }
    
    // Check access control - admin can access all; supervisor and others need assignment
    const assignedPlants = (req.user.assignedPlants || []).map((id) => id?.toString?.() || id);
    if (req.user.role !== 'admin' && !assignedPlants.includes(plant._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this plant'
      });
    }
    
    // Get plant inventory summary
    const inventorySummary = await PlantInventory.aggregate([
      { $match: { plant: plant._id, isActive: true } },
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          lowStockItems: {
            $sum: {
              $cond: [{ $lte: ['$currentStock', '$minimumStock'] }, 1, 0]
            }
          },
          totalValue: { $sum: { $multiply: ['$currentStock', 100] } } // Placeholder calculation
        }
      }
    ]);
    
    // Get recent production output
    const recentOutput = await PlantOutput.find({
      plant: plant._id,
      isActive: true
    })
    .sort({ productionDate: -1 })
    .limit(5)
    .select('batchNumber outputType volumeM3 productionDate status');
    
    res.json({
      success: true,
      data: {
        plant,
        inventorySummary: inventorySummary[0] || { totalItems: 0, lowStockItems: 0, totalValue: 0 },
        recentOutput
      }
    });
    
  } catch (error) {
    console.error('Get plant error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plant'
    });
  }
});

// Create new plant
router.post('/', authenticateToken, async (req, res) => {
  try {
    // Check permissions - allow admin or users with plant.create permission
    if (req.user.role !== 'admin' && !req.user.permissions.includes('plant.create')) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to create plants'
      });
    }

    console.log('Create plant request body:', req.body);
    
    // Check if plant with same name already exists
    const existingPlant = await Plant.findOne({
      name: req.body.name,
      isActive: true
    });
    
    if (existingPlant) {
      return res.status(400).json({
        success: false,
        message: 'Plant with this name already exists'
      });
    }
    
    // Create and save the plant
    const plant = new Plant(req.body);
    await plant.save();

    // Sync plant to each assigned manager's User.assignedPlants (so they can see it in the list)
    const managerIds = (plant.assignedManagers || [])
      .filter((a) => a.manager && a.isActive !== false)
      .map((a) => (a.manager && a.manager._id ? a.manager._id : a.manager));
    for (const managerId of managerIds) {
      if (!managerId) continue;
      const manager = await User.findById(managerId);
      if (manager) {
        const plantIdStr = plant._id.toString();
        const hasPlant = (manager.assignedPlants || []).some((id) => (id && id.toString()) === plantIdStr);
        if (!hasPlant) {
          manager.assignedPlants = manager.assignedPlants || [];
          manager.assignedPlants.push(plant._id);
          await manager.save();
        }
      }
    }
    
    // Populate assigned managers for response
    await plant.populate('assignedManagers.manager', 'firstName lastName email role');
    
    res.status(201).json({
      success: true,
      message: 'Plant created successfully',
      data: { plant }
    });
    
  } catch (error) {
    console.error('Create plant error:', error);
    
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
      message: 'Failed to create plant'
    });
  }
});

// Update plant
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    // Check permissions - allow admin or users with plant.update permission
    if (req.user.role !== 'admin' && !req.user.permissions.includes('plant.update')) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to update plants'
      });
    }

    const plant = await Plant.findById(req.params.id);
    
    if (!plant) {
      return res.status(404).json({
        success: false,
        message: 'Plant not found'
      });
    }
    
    // Check access control - admin can access all; supervisor and others need assignment
    const assignedPlants = (req.user.assignedPlants || []).map((id) => id?.toString?.() || id);
    if (req.user.role !== 'admin' && !assignedPlants.includes(plant._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this plant'
      });
    }

    const oldManagerIds = new Set(
      (plant.assignedManagers || [])
        .filter((a) => a.manager && a.isActive !== false)
        .map((a) => (a.manager && a.manager._id ? a.manager._id : a.manager).toString())
    );

    // Update plant fields
    Object.assign(plant, req.body);
    await plant.save();

    const newManagerIds = new Set(
      (plant.assignedManagers || [])
        .filter((a) => a.manager && a.isActive !== false)
        .map((a) => (a.manager && a.manager._id ? a.manager._id : a.manager).toString())
    );

    const added = [...newManagerIds].filter((id) => !oldManagerIds.has(id));
    const removed = [...oldManagerIds].filter((id) => !newManagerIds.has(id));

    for (const managerId of added) {
      const manager = await User.findById(managerId);
      if (manager) {
        const plantIdStr = plant._id.toString();
        const hasPlant = (manager.assignedPlants || []).some((id) => (id && id.toString()) === plantIdStr);
        if (!hasPlant) {
          manager.assignedPlants = manager.assignedPlants || [];
          manager.assignedPlants.push(plant._id);
          await manager.save();
        }
      }
    }
    for (const managerId of removed) {
      const manager = await User.findById(managerId);
      if (manager) {
        manager.assignedPlants = (manager.assignedPlants || []).filter(
          (id) => id && id.toString() !== plant._id.toString()
        );
        await manager.save();
      }
    }

    // Populate assigned managers for response
    await plant.populate('assignedManagers.manager', 'firstName lastName email role');
    
    res.json({
      success: true,
      message: 'Plant updated successfully',
      data: { plant }
    });
    
  } catch (error) {
    console.error('Update plant error:', error);
    
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
      message: 'Failed to update plant'
    });
  }
});

// Delete plant (soft delete)
router.delete('/:id', authenticateToken, requirePermission('plant.delete'), async (req, res) => {
  try {
    const plant = await Plant.findById(req.params.id);
    
    if (!plant) {
      return res.status(404).json({
        success: false,
        message: 'Plant not found'
      });
    }
    
    // Check access control - admin can access all; supervisor and others need assignment
    const assignedPlants = (req.user.assignedPlants || []).map((id) => id?.toString?.() || id);
    if (req.user.role !== 'admin' && !assignedPlants.includes(plant._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this plant'
      });
    }
    
    plant.isActive = false;
    await plant.save();
    
    res.json({
      success: true,
      message: 'Plant deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete plant error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete plant'
    });
  }
});

// Assign manager to plant
router.post('/:id/managers', authenticateToken, requirePermission('plant.update'), async (req, res) => {
  try {
    const { managerId } = req.body;
    
    if (!managerId) {
      return res.status(400).json({
        success: false,
        message: 'Manager ID is required'
      });
    }
    
    const plant = await Plant.findById(req.params.id);
    
    if (!plant) {
      return res.status(404).json({
        success: false,
        message: 'Plant not found'
      });
    }
    
    // Check access control - admin can access all; supervisor and others need assignment
    const assignedPlants = (req.user.assignedPlants || []).map((id) => id?.toString?.() || id);
    if (req.user.role !== 'admin' && !assignedPlants.includes(plant._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this plant'
      });
    }
    
    // Check if manager exists and has plant_manager role
    const manager = await User.findById(managerId);
    if (!manager || manager.role !== 'plant_manager') {
      return res.status(400).json({
        success: false,
        message: 'Invalid manager or manager does not have plant_manager role'
      });
    }
    
    // Add manager to plant
    await plant.addManager(managerId, req.user._id);
    
    // Add plant to manager's assigned plants
    if (!manager.assignedPlants.includes(plant._id)) {
      manager.assignedPlants.push(plant._id);
      await manager.save();
    }
    
    // Populate assigned managers for response
    await plant.populate('assignedManagers.manager', 'firstName lastName email role');
    
    res.json({
      success: true,
      message: 'Manager assigned to plant successfully',
      data: { plant }
    });
    
  } catch (error) {
    console.error('Assign manager error:', error);
    
    if (error.message === 'Manager is already assigned to this plant') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to assign manager to plant'
    });
  }
});

// Remove manager from plant
router.delete('/:id/managers/:managerId', authenticateToken, requirePermission('plant.update'), async (req, res) => {
  try {
    const plant = await Plant.findById(req.params.id);
    
    if (!plant) {
      return res.status(404).json({
        success: false,
        message: 'Plant not found'
      });
    }
    
    // Check access control - admin can access all; supervisor and others need assignment
    const assignedPlants = (req.user.assignedPlants || []).map((id) => id?.toString?.() || id);
    if (req.user.role !== 'admin' && !assignedPlants.includes(plant._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this plant'
      });
    }
    
    // Remove manager from plant
    await plant.removeManager(req.params.managerId);
    
    // Remove plant from manager's assigned plants
    const manager = await User.findById(req.params.managerId);
    if (manager) {
      manager.assignedPlants = manager.assignedPlants.filter(
        plantId => plantId.toString() !== plant._id.toString()
      );
      await manager.save();
    }
    
    // Populate assigned managers for response
    await plant.populate('assignedManagers.manager', 'firstName lastName email role');
    
    res.json({
      success: true,
      message: 'Manager removed from plant successfully',
      data: { plant }
    });
    
  } catch (error) {
    console.error('Remove manager error:', error);
    
    if (error.message === 'Manager is not assigned to this plant') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to remove manager from plant'
    });
  }
});

// Get plant analytics
router.get('/:id/analytics', authenticateToken, requirePermission('plant.read'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const plant = await Plant.findById(req.params.id);
    
    if (!plant) {
      return res.status(404).json({
        success: false,
        message: 'Plant not found'
      });
    }
    
    // Check access control - admin can access all; supervisor and others need assignment
    const assignedPlants = (req.user.assignedPlants || []).map((id) => id?.toString?.() || id);
    if (req.user.role !== 'admin' && !assignedPlants.includes(plant._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this plant'
      });
    }
    
    // Set default date range if not provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    
    // Get production summary
    const productionSummary = await PlantOutput.getProductionSummary(plant._id, start, end);
    
    // Get inventory summary
    const inventorySummary = await PlantInventory.aggregate([
      { $match: { plant: plant._id, isActive: true } },
      {
        $group: {
          _id: '$category',
          totalItems: { $sum: 1 },
          totalStock: { $sum: '$currentStock' },
          lowStockItems: {
            $sum: {
              $cond: [{ $lte: ['$currentStock', '$minimumStock'] }, 1, 0]
            }
          }
        }
      }
    ]);
    
    // Get consumption summary
    const consumptionSummary = await PlantInventory.aggregate([
      { $match: { plant: plant._id, isActive: true } },
      {
        $group: {
          _id: null,
          totalDailyConsumption: { $sum: '$consumptionRate.daily' },
          totalWeeklyConsumption: { $sum: '$consumptionRate.weekly' },
          totalMonthlyConsumption: { $sum: '$consumptionRate.monthly' }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        plant: {
          _id: plant._id,
          name: plant.name,
          plantType: plant.plantType,
          capacity: plant.capacity,
          productionMetrics: plant.productionMetrics
        },
        productionSummary: productionSummary[0] || {
          totalVolumeM3: 0,
          totalBatches: 0,
          averageEfficiency: 0,
          totalMaterialCost: 0
        },
        inventorySummary,
        consumptionSummary: consumptionSummary[0] || {
          totalDailyConsumption: 0,
          totalWeeklyConsumption: 0,
          totalMonthlyConsumption: 0
        },
        dateRange: { start, end }
      }
    });
    
  } catch (error) {
    console.error('Get plant analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plant analytics'
    });
  }
});

// Get plant types
router.get('/meta/plant-types', authenticateToken, requirePermission('plant.read'), async (req, res) => {
  try {
    const plantTypes = [
      { value: 'concrete_batching', label: 'Concrete Batching Plant' },
      { value: 'asphalt_production', label: 'Asphalt Production Plant' },
      { value: 'precast_manufacturing', label: 'Precast Manufacturing Plant' }
    ];
    
    res.json({
      success: true,
      data: { plantTypes }
    });
    
  } catch (error) {
    console.error('Get plant types error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plant types'
    });
  }
});

module.exports = router;
