const express = require('express');
const PlantOutput = require('../models/PlantOutput');
const ProductionBatch = require('../models/ProductionBatch');
const Plant = require('../models/Plant');
const { authenticateToken, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get all plant outputs
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Check permissions - allow admin or users with plant_inventory.read permission
    if (req.user.role !== 'admin' && !req.user.permissions.includes('plant_inventory.read')) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to read plant outputs'
      });
    }

    const {
      page = 1,
      limit = 10,
      status,
      materialType,
      plantId,
      lowStock,
      expiring,
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
    
    if (expiring === 'true') {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7); // Next 7 days
      query.expiryDate = { $lte: futureDate, $gte: new Date() };
    }
    
    if (search) {
      query.$or = [
        { outputId: { $regex: search, $options: 'i' } },
        { materialName: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [outputs, totalCount, lowStockCount] = await Promise.all([
      PlantOutput.find(query)
        .populate('plant', 'name code plantType')
        .populate('batch', 'batchId batchType startTime endTime')
        .populate('createdBy', 'name email')
        .sort({ productionDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      PlantOutput.countDocuments(query),
      PlantOutput.countDocuments({ 
        isActive: true,
        $expr: { $lte: ['$currentStock', '$minimumStock'] }
      })
    ]);
    
    res.json({
      success: true,
      data: {
        outputs,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + outputs.length < totalCount,
          hasPrev: parseInt(page) > 1
        },
        summary: {
          lowStockCount
        }
      }
    });
    
  } catch (error) {
    console.error('Get plant outputs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plant outputs'
    });
  }
});

// Get single plant output
router.get('/:id', authenticateToken, requirePermission('plant_inventory.read'), async (req, res) => {
  try {
    const output = await PlantOutput.findById(req.params.id)
      .populate('plant', 'name code plantType')
      .populate('batch', 'batchId batchType startTime endTime consumedMaterials outputMaterials')
      .populate('createdBy', 'name email')
      .populate('transferHistory.transferredBy', 'name email')
      .populate('transferHistory.transferredTo', 'name code');
    
    if (!output) {
      return res.status(404).json({
        success: false,
        message: 'Plant output not found'
      });
    }
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedPlants.includes(output.plant._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this plant output'
      });
    }
    
    res.json({
      success: true,
      data: { output }
    });
    
  } catch (error) {
    console.error('Get plant output error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plant output'
    });
  }
});

// Create plant output (with optional batch)
router.post('/', authenticateToken, requirePermission('plant_inventory.create'), async (req, res) => {
  try {
    const {
      plantId,
      batchId,
      materialType,
      materialName,
      quantity,
      unit,
      qualitySpecs,
      expiryDate,
      notes
    } = req.body;
    
    // Validate required fields
    if (!plantId || !materialType || !materialName || !quantity || !unit) {
      return res.status(400).json({
        success: false,
        message: 'Plant ID, material type, material name, quantity, and unit are required'
      });
    }
    
    // Check if plant exists
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
    
    // If batchId is provided, validate the batch
    let batch = null;
    if (batchId) {
      batch = await ProductionBatch.findById(batchId);
      
      if (!batch) {
        return res.status(404).json({
          success: false,
          message: 'Production batch not found'
        });
      }
      
      if (batch.status !== 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Only completed batches can create plant outputs'
        });
      }
      
      // Ensure batch belongs to the same plant
      if (batch.plant.toString() !== plantId) {
        return res.status(400).json({
          success: false,
          message: 'Production batch does not belong to the specified plant'
        });
      }
    }
    
    // Create plant output
    const output = new PlantOutput({
      plant: plantId,
      batch: batchId,
      materialType,
      materialName,
      currentStock: quantity,
      unit,
      qualitySpecs,
      productionDate: batch ? batch.endTime : new Date(),
      expiryDate,
      createdBy: req.user._id,
      notes
    });
    
    await output.save();
    
    // Populate the created output
    await output.populate([
      { path: 'plant', select: 'name code plantType' },
      { path: 'batch', select: 'batchId batchType startTime endTime' },
      { path: 'createdBy', select: 'name email' }
    ]);
    
    res.status(201).json({
      success: true,
      message: 'Plant output created successfully',
      data: { output }
    });
    
  } catch (error) {
    console.error('Create plant output error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create plant output'
    });
  }
});

// Update plant output
router.put('/:id', authenticateToken, requirePermission('plant_inventory.update'), async (req, res) => {
  try {
    const output = await PlantOutput.findById(req.params.id);
    
    if (!output) {
      return res.status(404).json({
        success: false,
        message: 'Plant output not found'
      });
    }
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedPlants.includes(output.plant)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this plant output'
      });
    }
    
    // Update allowed fields
    const allowedUpdates = ['materialName', 'minimumStock', 'maximumStock', 'qualitySpecs', 'notes'];
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        output[field] = req.body[field];
      }
    });
    
    await output.save();
    
    // Populate the updated output
    await output.populate([
      { path: 'plant', select: 'name code plantType' },
      { path: 'batch', select: 'batchId batchType startTime endTime' },
      { path: 'createdBy', select: 'name email' }
    ]);
    
    res.json({
      success: true,
      message: 'Plant output updated successfully',
      data: { output }
    });
    
  } catch (error) {
    console.error('Update plant output error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update plant output'
    });
  }
});

// Transfer plant output
router.post('/:id/transfer', authenticateToken, requirePermission('plant_inventory.transfer'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      quantity,
      destinationId,
      destinationType,
      transferId,
      notes
    } = req.body;
    
    // Validate required fields
    if (!quantity || !destinationId || !destinationType) {
      return res.status(400).json({
        success: false,
        message: 'Quantity, destination ID, and destination type are required'
      });
    }
    
    const output = await PlantOutput.findById(id);
    
    if (!output) {
      return res.status(404).json({
        success: false,
        message: 'Plant output not found'
      });
    }
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedPlants.includes(output.plant)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this plant output'
      });
    }
    
    // Check if output is transferable
    if (!output.isTransferable()) {
      return res.status(400).json({
        success: false,
        message: 'This output is not available for transfer'
      });
    }
    
    // Validate quantity
    if (quantity > output.currentStock) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${output.currentStock} ${output.unit}`
      });
    }
    
    // Transfer the stock
    await output.transferStock(
      quantity,
      destinationId,
      destinationType,
      req.user._id,
      transferId,
      notes
    );
    
    // Populate the updated output
    await output.populate([
      { path: 'plant', select: 'name code plantType' },
      { path: 'batch', select: 'batchId batchType startTime endTime' },
      { path: 'createdBy', select: 'name email' }
    ]);
    
    res.json({
      success: true,
      message: 'Plant output transferred successfully',
      data: { 
        output,
        transferredQuantity: quantity,
        remainingStock: output.currentStock
      }
    });
    
  } catch (error) {
    console.error('Transfer plant output error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to transfer plant output'
    });
  }
});

// Get transfer history for plant output
router.get('/:id/history', authenticateToken, requirePermission('plant_inventory.read'), async (req, res) => {
  try {
    const output = await PlantOutput.findById(req.params.id)
      .populate('transferHistory.transferredBy', 'name email')
      .populate('transferHistory.transferredTo', 'name code')
      .select('transferHistory');
    
    if (!output) {
      return res.status(404).json({
        success: false,
        message: 'Plant output not found'
      });
    }
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedPlants.includes(output.plant)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this plant output'
      });
    }
    
    res.json({
      success: true,
      data: { 
        transferHistory: output.transferHistory,
        totalTransferred: output.totalTransferred
      }
    });
    
  } catch (error) {
    console.error('Get plant output history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plant output history'
    });
  }
});

// Get low stock outputs
router.get('/plants/:plantId/low-stock', authenticateToken, requirePermission('plant_inventory.read'), async (req, res) => {
  try {
    const { plantId } = req.params;
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedPlants.includes(plantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this plant'
      });
    }
    
    const lowStockOutputs = await PlantOutput.getLowStockOutputs(plantId);
    
    res.json({
      success: true,
      data: { lowStockOutputs }
    });
    
  } catch (error) {
    console.error('Get low stock outputs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch low stock outputs'
    });
  }
});

// Get expiring outputs
router.get('/plants/:plantId/expiring', authenticateToken, requirePermission('plant_inventory.read'), async (req, res) => {
  try {
    const { plantId } = req.params;
    const { daysAhead = 7 } = req.query;
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedPlants.includes(plantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this plant'
      });
    }
    
    const expiringOutputs = await PlantOutput.getExpiringOutputs(plantId, parseInt(daysAhead));
    
    res.json({
      success: true,
      data: { expiringOutputs }
    });
    
  } catch (error) {
    console.error('Get expiring outputs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expiring outputs'
    });
  }
});

module.exports = router;
