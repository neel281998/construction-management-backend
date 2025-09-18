const express = require('express');
const PlantInventory = require('../models/PlantInventory');
const Plant = require('../models/Plant');
const { authenticateToken, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get all plant inventory items
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Check permissions - allow admin or users with plant_inventory.read permission
    if (req.user.role !== 'admin' && !req.user.permissions.includes('plant_inventory.read')) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to read plant inventory'
      });
    }

    const {
      page = 1,
      limit = 10,
      category,
      materialType,
      lowStock,
      search,
      plantId
    } = req.query;
    
    // Build query
    let query = { isActive: true };
    
    // Apply plant access control for non-admin users
    if (req.user.role !== 'admin') {
      const assignedPlants = req.user.assignedPlants || [];
      if (assignedPlants.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'No plants assigned to user'
        });
      }
      query.plant = { $in: assignedPlants };
    }
    
    // Apply filters
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (materialType && materialType !== 'all') {
      query.materialType = materialType;
    }
    
    if (plantId && plantId !== 'all') {
      // For non-admin users, ensure they can only access assigned plants
      if (req.user.role !== 'admin') {
        const assignedPlants = req.user.assignedPlants || [];
        if (!assignedPlants.includes(plantId)) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to this plant'
          });
        }
      }
      query.plant = plantId;
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
      PlantInventory.find(query)
        .populate('plant', 'name code plantType')
        .sort({ itemName: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      PlantInventory.countDocuments(query),
      PlantInventory.countDocuments({ 
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
    console.error('Get plant inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plant inventory items'
    });
  }
});

// Get single plant inventory item
router.get('/:id', authenticateToken, requirePermission('plant_inventory.read'), async (req, res) => {
  try {
    const item = await PlantInventory.findById(req.params.id)
      .populate('plant', 'name code plantType');
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Plant inventory item not found'
      });
    }
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedPlants.includes(item.plant._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this plant inventory item'
      });
    }
    
    res.json({
      success: true,
      data: { item }
    });
    
  } catch (error) {
    console.error('Get plant inventory item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plant inventory item'
    });
  }
});

// Create new plant inventory item
router.post('/', authenticateToken, requirePermission('plant_inventory.create'), async (req, res) => {
  try {
    console.log('Create plant inventory request body:', req.body);
    const { plant } = req.body;
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedPlants.includes(plant)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this plant'
      });
    }
    
    // Check if item already exists in this plant
    const existingItem = await PlantInventory.findOne({
      itemName: req.body.itemName,
      plant: plant,
      isActive: true
    });
    
    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: 'Item already exists in this plant'
      });
    }
    
    // Clean up the request body - remove empty itemCode
    const inventoryData = { ...req.body };
    if (!inventoryData.itemCode || inventoryData.itemCode.trim() === '') {
      delete inventoryData.itemCode;
    }
    
    console.log('Creating plant inventory with data:', inventoryData);
    
    // Create and save the inventory item
    const item = new PlantInventory(inventoryData);
    await item.save();
    
    // Populate plant for response
    await item.populate('plant', 'name code plantType');
    
    res.status(201).json({
      success: true,
      message: 'Plant inventory item created successfully',
      data: { item }
    });
    
  } catch (error) {
    console.error('Create plant inventory item error:', error);
    
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
      message: 'Failed to create plant inventory item'
    });
  }
});

// Restock plant inventory item
router.post('/:id/restock', authenticateToken, requirePermission('plant_inventory.update'), async (req, res) => {
  try {
    const { quantity, supplier, notes } = req.body;
    
    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }
    
    const item = await PlantInventory.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Plant inventory item not found'
      });
    }
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedPlants.includes(item.plant)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this plant inventory item'
      });
    }
    
    const previousStock = item.currentStock;
    
    // Use the restock method
    await item.restock(quantity, supplier || item.supplier.name, req.user._id, notes);
    
    res.json({
      success: true,
      message: 'Plant inventory restocked successfully',
      data: {
        itemId: item._id,
        previousStock,
        newStock: item.currentStock,
        restockQuantity: quantity
      }
    });
    
  } catch (error) {
    console.error('Restock plant inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restock plant inventory item'
    });
  }
});

// Consume plant inventory (use stock)
router.post('/:id/consume', authenticateToken, requirePermission('plant_inventory.update'), async (req, res) => {
  try {
    const { quantity, notes, productionBatchId, dispatchId } = req.body;
    
    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }
    
    const item = await PlantInventory.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Plant inventory item not found'
      });
    }
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedPlants.includes(item.plant)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this plant inventory item'
      });
    }
    
    if (quantity > item.currentStock) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock available',
        data: {
          requested: quantity,
          available: item.currentStock
        }
      });
    }
    
    const previousStock = item.currentStock;
    
    // Use the consume method
    await item.consumeStock(quantity, req.user._id, productionBatchId, dispatchId, notes);
    
    res.json({
      success: true,
      message: 'Stock consumed successfully',
      data: {
        itemId: item._id,
        previousStock,
        newStock: item.currentStock,
        consumedQuantity: quantity,
        isLowStock: item.isLowStock
      }
    });
    
  } catch (error) {
    console.error('Consume plant inventory error:', error);
    
    if (error.message === 'Insufficient stock available') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to consume plant inventory'
    });
  }
});

// Update consumption rates
router.put('/:id/consumption-rates', authenticateToken, requirePermission('plant_inventory.update'), async (req, res) => {
  try {
    const item = await PlantInventory.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Plant inventory item not found'
      });
    }
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedPlants.includes(item.plant)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this plant inventory item'
      });
    }
    
    // Update consumption rates
    await item.updateConsumptionRates();
    
    res.json({
      success: true,
      message: 'Consumption rates updated successfully',
      data: {
        itemId: item._id,
        consumptionRate: item.consumptionRate
      }
    });
    
  } catch (error) {
    console.error('Update consumption rates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update consumption rates'
    });
  }
});

// Get low stock items
router.get('/alerts/low-stock', authenticateToken, requirePermission('plant_inventory.read'), async (req, res) => {
  try {
    let query = {
      isActive: true,
      $expr: { $lte: ['$currentStock', '$minimumStock'] }
    };
    
    // Apply plant access control for non-admin users
    if (req.user.role !== 'admin') {
      const assignedPlants = req.user.assignedPlants || [];
      if (assignedPlants.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'No plants assigned to user'
        });
      }
      query.plant = { $in: assignedPlants };
    }
    
    const lowStockItems = await PlantInventory.find(query)
      .populate('plant', 'name code plantType')
      .sort({ currentStock: 1 });
    
    res.json({
      success: true,
      data: {
        items: lowStockItems,
        count: lowStockItems.length
      }
    });
    
  } catch (error) {
    console.error('Get low stock items error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch low stock items'
    });
  }
});

// Get plant inventory categories
router.get('/meta/categories', authenticateToken, requirePermission('plant_inventory.read'), async (req, res) => {
  try {
    const validCategories = [
      'Cement',
      'Aggregates',
      'Water',
      'Admixtures',
      'Steel Reinforcement',
      'Concrete Mix',
      'Tools & Equipment',
      'Safety Equipment',
      'Other'
    ];
    
    res.json({
      success: true,
      data: { categories: validCategories }
    });
    
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories'
    });
  }
});

// Get material types
router.get('/meta/material-types', authenticateToken, requirePermission('plant_inventory.read'), async (req, res) => {
  try {
    const materialTypes = [
      { value: 'raw_material', label: 'Raw Material' },
      { value: 'finished_product', label: 'Finished Product' },
      { value: 'consumable', label: 'Consumable' }
    ];
    
    res.json({
      success: true,
      data: { materialTypes }
    });
    
  } catch (error) {
    console.error('Get material types error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch material types'
    });
  }
});

// Update plant inventory item (general route - must come after specific routes)
router.put('/:id', authenticateToken, requirePermission('plant_inventory.update'), async (req, res) => {
  try {
    const item = await PlantInventory.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Plant inventory item not found'
      });
    }
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedPlants.includes(item.plant)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this plant inventory item'
      });
    }
    
    // Update item fields
    Object.assign(item, req.body);
    await item.save();
    
    // Populate plant for response
    await item.populate('plant', 'name code plantType');
    
    res.json({
      success: true,
      message: 'Plant inventory item updated successfully',
      data: { item }
    });
    
  } catch (error) {
    console.error('Update plant inventory item error:', error);
    
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
      message: 'Failed to update plant inventory item'
    });
  }
});

// Delete plant inventory item (soft delete)
router.delete('/:id', authenticateToken, requirePermission('plant_inventory.delete'), async (req, res) => {
  try {
    const item = await PlantInventory.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Plant inventory item not found'
      });
    }
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedPlants.includes(item.plant)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this plant inventory item'
      });
    }
    
    item.isActive = false;
    await item.save();
    
    res.json({
      success: true,
      message: 'Plant inventory item deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete plant inventory item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete plant inventory item'
    });
  }
});

module.exports = router;
