const express = require('express');
const ProductionBatch = require('../models/ProductionBatch');
const PlantInventory = require('../models/PlantInventory');
const Plant = require('../models/Plant');
const { authenticateToken, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get all production batches
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Check permissions - allow admin or users with plant_inventory.read permission
    if (req.user.role !== 'admin' && !req.user.permissions.includes('plant_inventory.read')) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to read production batches'
      });
    }

    const {
      page = 1,
      limit = 10,
      status,
      batchType,
      plantId,
      search
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
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (batchType && batchType !== 'all') {
      query.batchType = batchType;
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
    
    if (search) {
      query.$or = [
        { batchId: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [batches, totalCount] = await Promise.all([
      ProductionBatch.find(query)
        .populate('plant', 'name plantType')
        .populate('createdBy', 'name email')
        .populate('consumedMaterials.inventoryItem', 'itemName category unit')
        .sort({ startTime: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      ProductionBatch.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: {
        batches,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + batches.length < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });
    
  } catch (error) {
    console.error('Get production batches error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch production batches'
    });
  }
});

// Get single production batch
router.get('/:id', authenticateToken, requirePermission('plant_inventory.read'), async (req, res) => {
  try {
    const batch = await ProductionBatch.findById(req.params.id)
      .populate('plant', 'name plantType')
      .populate('createdBy', 'name email')
      .populate('consumedMaterials.inventoryItem', 'itemName category unit currentStock')
      .populate('outputMaterials');
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Production batch not found'
      });
    }
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedPlants.includes(batch.plant._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this production batch'
      });
    }
    
    res.json({
      success: true,
      data: { batch }
    });
    
  } catch (error) {
    console.error('Get production batch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch production batch'
    });
  }
});

// Create new production batch
router.post('/', authenticateToken, requirePermission('plant_inventory.create'), async (req, res) => {
  try {
    const {
      plantId,
      batchType,
      notes,
      consumedMaterials = [],
      outputMaterials = []
    } = req.body;
    
    // Validate required fields
    if (!plantId || !batchType) {
      return res.status(400).json({
        success: false,
        message: 'Plant ID and batch type are required'
      });
    }
    
    // Check if plant exists and user has access
    const plant = await Plant.findById(plantId);
    if (!plant) {
      return res.status(404).json({
        success: false,
        message: 'Plant not found'
      });
    }
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedPlants.includes(plantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this plant'
      });
    }
    
    // Validate consumed materials
    for (const material of consumedMaterials) {
      const inventoryItem = await PlantInventory.findById(material.inventoryItem);
      if (!inventoryItem) {
        return res.status(400).json({
          success: false,
          message: `Inventory item ${material.inventoryItem} not found`
        });
      }
      
      if (material.quantity > inventoryItem.currentStock) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${inventoryItem.itemName}. Available: ${inventoryItem.currentStock} ${inventoryItem.unit}`
        });
      }
    }
    
    // Create production batch
    const batch = new ProductionBatch({
      plant: plantId,
      batchType,
      consumedMaterials,
      outputMaterials,
      createdBy: req.user._id,
      notes
    });
    
    await batch.save();
    
    // Populate the created batch
    await batch.populate([
      { path: 'plant', select: 'name plantType' },
      { path: 'createdBy', select: 'name email' },
      { path: 'consumedMaterials.inventoryItem', select: 'itemName category unit' }
    ]);
    
    res.status(201).json({
      success: true,
      message: 'Production batch created successfully',
      data: { batch }
    });
    
  } catch (error) {
    console.error('Create production batch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create production batch'
    });
  }
});

// Update production batch
router.put('/:id', authenticateToken, requirePermission('plant_inventory.update'), async (req, res) => {
  try {
    const batch = await ProductionBatch.findById(req.params.id);
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Production batch not found'
      });
    }
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedPlants.includes(batch.plant)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this production batch'
      });
    }
    
    // Don't allow updates to completed or cancelled batches
    if (batch.status === 'completed' || batch.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update completed or cancelled batches'
      });
    }
    
    // Update allowed fields
    const allowedUpdates = ['batchType', 'notes', 'consumedMaterials', 'outputMaterials'];
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        batch[field] = req.body[field];
      }
    });
    
    await batch.save();
    
    // Populate the updated batch
    await batch.populate([
      { path: 'plant', select: 'name plantType' },
      { path: 'createdBy', select: 'name email' },
      { path: 'consumedMaterials.inventoryItem', select: 'itemName category unit' }
    ]);
    
    res.json({
      success: true,
      message: 'Production batch updated successfully',
      data: { batch }
    });
    
  } catch (error) {
    console.error('Update production batch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update production batch'
    });
  }
});

// Complete production batch
router.post('/:id/complete', authenticateToken, requirePermission('plant_inventory.update'), async (req, res) => {
  try {
    const batch = await ProductionBatch.findById(req.params.id);
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Production batch not found'
      });
    }
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedPlants.includes(batch.plant)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this production batch'
      });
    }
    
    if (batch.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        message: 'Only in-progress batches can be completed'
      });
    }
    
    // Complete the batch
    await batch.completeBatch();
    
    // Populate the completed batch
    await batch.populate([
      { path: 'plant', select: 'name plantType' },
      { path: 'createdBy', select: 'name email' },
      { path: 'consumedMaterials.inventoryItem', select: 'itemName category unit' }
    ]);
    
    res.json({
      success: true,
      message: 'Production batch completed successfully',
      data: { batch }
    });
    
  } catch (error) {
    console.error('Complete production batch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete production batch'
    });
  }
});

// Cancel production batch
router.post('/:id/cancel', authenticateToken, requirePermission('plant_inventory.update'), async (req, res) => {
  try {
    const batch = await ProductionBatch.findById(req.params.id);
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Production batch not found'
      });
    }
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedPlants.includes(batch.plant)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this production batch'
      });
    }
    
    if (batch.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        message: 'Only in-progress batches can be cancelled'
      });
    }
    
    // Cancel the batch
    await batch.cancelBatch();
    
    // Populate the cancelled batch
    await batch.populate([
      { path: 'plant', select: 'name plantType' },
      { path: 'createdBy', select: 'name email' },
      { path: 'consumedMaterials.inventoryItem', select: 'itemName category unit' }
    ]);
    
    res.json({
      success: true,
      message: 'Production batch cancelled successfully',
      data: { batch }
    });
    
  } catch (error) {
    console.error('Cancel production batch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel production batch'
    });
  }
});

// Get consumed materials for batch selection
router.get('/plants/:plantId/consumed-materials', authenticateToken, requirePermission('plant_inventory.read'), async (req, res) => {
  try {
    const { plantId } = req.params;
    const { days = 7 } = req.query;
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedPlants.includes(plantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this plant'
      });
    }
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    // Get plant inventory items with recent consumption
    const inventoryItems = await PlantInventory.find({
      plant: plantId,
      isActive: true,
      'consumptionHistory.consumedAt': {
        $gte: startDate,
        $lte: endDate
      }
    })
    .populate('plant', 'name plantType')
    .select('itemName category unit currentStock consumptionHistory');
    
    // Filter and format consumption history
    const consumedMaterials = [];
    inventoryItems.forEach(item => {
      const recentConsumption = item.consumptionHistory.filter(consumption => {
        const consumedAt = new Date(consumption.consumedAt);
        return consumedAt >= startDate && consumedAt <= endDate;
      });
      
      if (recentConsumption.length > 0) {
        consumedMaterials.push({
          inventoryItem: item._id,
          itemName: item.itemName,
          category: item.category,
          unit: item.unit,
          currentStock: item.currentStock,
          recentConsumption: recentConsumption.map(consumption => ({
            quantity: consumption.quantity,
            consumedAt: consumption.consumedAt,
            notes: consumption.notes
          }))
        });
      }
    });
    
    res.json({
      success: true,
      data: { consumedMaterials }
    });
    
  } catch (error) {
    console.error('Get consumed materials error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch consumed materials'
    });
  }
});

module.exports = router;
