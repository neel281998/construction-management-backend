const express = require('express');
const PlantOutput = require('../models/PlantOutput');
const PlantInventory = require('../models/PlantInventory');
const Plant = require('../models/Plant');
const { authenticateToken, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get all plant output records
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Check permissions - allow admin or users with plant_output.read permission
    if (req.user.role !== 'admin' && !req.user.permissions.includes('plant_output.read')) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to read plant output'
      });
    }

    const {
      page = 1,
      limit = 10,
      plantId,
      outputType,
      status,
      startDate,
      endDate
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
    
    if (outputType && outputType !== 'all') {
      query.outputType = outputType;
    }
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (startDate || endDate) {
      query.productionDate = {};
      if (startDate) query.productionDate.$gte = new Date(startDate);
      if (endDate) query.productionDate.$lte = new Date(endDate);
    }
    
    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [outputs, totalCount] = await Promise.all([
      PlantOutput.find(query)
        .populate('plant', 'name code plantType')
        .populate('createdBy', 'firstName lastName email')
        .sort({ productionDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      PlantOutput.countDocuments(query)
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
        }
      }
    });
    
  } catch (error) {
    console.error('Get plant output error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plant output records'
    });
  }
});

// Get single plant output record
router.get('/:id', authenticateToken, requirePermission('plant_output.read'), async (req, res) => {
  try {
    const output = await PlantOutput.findById(req.params.id)
      .populate('plant', 'name code plantType')
      .populate('createdBy', 'firstName lastName email')
      .populate('consumedMaterials.materialId', 'itemName unit')
      .populate('transferHistory.transferredBy', 'firstName lastName email')
      .populate('transferHistory.receivedBy', 'firstName lastName email');
    
    if (!output) {
      return res.status(404).json({
        success: false,
        message: 'Plant output record not found'
      });
    }
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedPlants.includes(output.plant._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this plant output record'
      });
    }
    
    res.json({
      success: true,
      data: { output }
    });
    
  } catch (error) {
    console.error('Get plant output record error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plant output record'
    });
  }
});

// Create new plant output record
router.post('/', authenticateToken, requirePermission('plant_output.create'), async (req, res) => {
  try {
    console.log('Create plant output request body:', req.body);
    const { plant, consumedMaterials } = req.body;
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedPlants.includes(plant)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this plant'
      });
    }
    
    // Verify plant exists
    const plantExists = await Plant.findById(plant);
    if (!plantExists) {
      return res.status(404).json({
        success: false,
        message: 'Plant not found'
      });
    }
    
    // Generate batch number if not provided
    if (!req.body.batchNumber) {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
      const count = await PlantOutput.countDocuments({
        plant: plant,
        productionDate: {
          $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
          $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
        }
      });
      req.body.batchNumber = `${plantExists.code || 'PLT'}-${dateStr}-${String(count + 1).padStart(3, '0')}`;
    }
    
    // Create the plant output record
    const outputData = {
      ...req.body,
      createdBy: req.user._id
    };
    
    const output = new PlantOutput(outputData);
    await output.save();
    
    // Consume materials if provided
    if (consumedMaterials && consumedMaterials.length > 0) {
      for (const material of consumedMaterials) {
        const inventoryItem = await PlantInventory.findById(material.materialId);
        if (inventoryItem) {
          await inventoryItem.consumeStock(
            material.quantity,
            req.user._id,
            output._id,
            null,
            `Consumed for production batch ${output.batchNumber}`
          );
        }
      }
    }
    
    // Calculate production efficiency
    await output.calculateEfficiency();
    
    // Populate for response
    await output.populate('plant', 'name code plantType');
    await output.populate('createdBy', 'firstName lastName email');
    await output.populate('consumedMaterials.materialId', 'itemName unit');
    
    res.status(201).json({
      success: true,
      message: 'Plant output record created successfully',
      data: { output }
    });
    
  } catch (error) {
    console.error('Create plant output error:', error);
    
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
      message: 'Failed to create plant output record'
    });
  }
});

// Add quality test result
router.post('/:id/quality-test', authenticateToken, requirePermission('plant_output.update'), async (req, res) => {
  try {
    const { testType, value, unit, passed, notes } = req.body;
    
    if (!testType || value === undefined || !unit) {
      return res.status(400).json({
        success: false,
        message: 'Test type, value, and unit are required'
      });
    }
    
    const output = await PlantOutput.findById(req.params.id);
    
    if (!output) {
      return res.status(404).json({
        success: false,
        message: 'Plant output record not found'
      });
    }
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedPlants.includes(output.plant)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this plant output record'
      });
    }
    
    // Add quality test result
    await output.addQualityTest(testType, value, unit, passed, notes, req.user._id);
    
    res.json({
      success: true,
      message: 'Quality test result added successfully',
      data: {
        outputId: output._id,
        testResult: {
          testType,
          value,
          unit,
          passed,
          notes,
          testedAt: new Date()
        }
      }
    });
    
  } catch (error) {
    console.error('Add quality test error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add quality test result'
    });
  }
});

// Transfer plant output
router.post('/:id/transfer', authenticateToken, requirePermission('plant_output.update'), async (req, res) => {
  try {
    const { 
      transferType, 
      destination, 
      quantity, 
      vehicle, 
      dispatchId, 
      transferId, 
      notes 
    } = req.body;
    
    if (!transferType || !destination || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Transfer type, destination, and quantity are required'
      });
    }
    
    const output = await PlantOutput.findById(req.params.id);
    
    if (!output) {
      return res.status(404).json({
        success: false,
        message: 'Plant output record not found'
      });
    }
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedPlants.includes(output.plant)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this plant output record'
      });
    }
    
    // Transfer output
    await output.transferOutput(
      transferType,
      destination,
      quantity,
      vehicle,
      req.user._id,
      dispatchId,
      transferId,
      notes
    );
    
    res.json({
      success: true,
      message: 'Plant output transferred successfully',
      data: {
        outputId: output._id,
        transferredQuantity: quantity,
        remainingQuantity: output.remainingQuantity,
        status: output.status
      }
    });
    
  } catch (error) {
    console.error('Transfer plant output error:', error);
    
    if (error.message === 'Insufficient quantity available for transfer') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to transfer plant output'
    });
  }
});

// Update plant output record
router.put('/:id', authenticateToken, requirePermission('plant_output.update'), async (req, res) => {
  try {
    const output = await PlantOutput.findById(req.params.id);
    
    if (!output) {
      return res.status(404).json({
        success: false,
        message: 'Plant output record not found'
      });
    }
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedPlants.includes(output.plant)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this plant output record'
      });
    }
    
    // Update output fields
    Object.assign(output, req.body);
    await output.save();
    
    // Recalculate efficiency if production data changed
    if (req.body.volumeM3 || req.body.consumedMaterials) {
      await output.calculateEfficiency();
    }
    
    // Populate for response
    await output.populate('plant', 'name code plantType');
    await output.populate('createdBy', 'firstName lastName email');
    await output.populate('consumedMaterials.materialId', 'itemName unit');
    
    res.json({
      success: true,
      message: 'Plant output record updated successfully',
      data: { output }
    });
    
  } catch (error) {
    console.error('Update plant output error:', error);
    
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
      message: 'Failed to update plant output record'
    });
  }
});

// Get production summary for a plant
router.get('/summary/:plantId', authenticateToken, requirePermission('plant_output.read'), async (req, res) => {
  try {
    const { plantId } = req.params;
    const { startDate, endDate } = req.query;
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedPlants.includes(plantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this plant'
      });
    }
    
    // Set default date range if not provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    
    // Get production summary
    const summary = await PlantOutput.getProductionSummary(plantId, start, end);
    
    // Get daily production breakdown
    const dailyBreakdown = await PlantOutput.aggregate([
      {
        $match: {
          plant: plantId,
          isActive: true,
          productionDate: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$productionDate' },
            month: { $month: '$productionDate' },
            day: { $dayOfMonth: '$productionDate' }
          },
          totalVolumeM3: { $sum: '$volumeM3' },
          batchCount: { $sum: 1 },
          averageEfficiency: { $avg: '$productionEfficiency.overallEfficiency' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);
    
    res.json({
      success: true,
      data: {
        plantId,
        summary: summary[0] || {
          totalVolumeM3: 0,
          totalBatches: 0,
          averageEfficiency: 0,
          totalMaterialCost: 0
        },
        dailyBreakdown,
        dateRange: { start, end }
      }
    });
    
  } catch (error) {
    console.error('Get production summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch production summary'
    });
  }
});

// Get output types
router.get('/meta/output-types', authenticateToken, requirePermission('plant_output.read'), async (req, res) => {
  try {
    const outputTypes = [
      { value: 'concrete', label: 'Concrete' },
      { value: 'asphalt', label: 'Asphalt' },
      { value: 'precast', label: 'Precast' }
    ];
    
    res.json({
      success: true,
      data: { outputTypes }
    });
    
  } catch (error) {
    console.error('Get output types error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch output types'
    });
  }
});

// Get quality test types
router.get('/meta/quality-test-types', authenticateToken, requirePermission('plant_output.read'), async (req, res) => {
  try {
    const testTypes = [
      { value: 'compressive_strength', label: 'Compressive Strength' },
      { value: 'slump_test', label: 'Slump Test' },
      { value: 'temperature', label: 'Temperature' },
      { value: 'air_content', label: 'Air Content' },
      { value: 'other', label: 'Other' }
    ];
    
    res.json({
      success: true,
      data: { testTypes }
    });
    
  } catch (error) {
    console.error('Get quality test types error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quality test types'
    });
  }
});

// Delete plant output record (soft delete)
router.delete('/:id', authenticateToken, requirePermission('plant_output.delete'), async (req, res) => {
  try {
    const output = await PlantOutput.findById(req.params.id);
    
    if (!output) {
      return res.status(404).json({
        success: false,
        message: 'Plant output record not found'
      });
    }
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedPlants.includes(output.plant)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this plant output record'
      });
    }
    
    output.isActive = false;
    await output.save();
    
    res.json({
      success: true,
      message: 'Plant output record deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete plant output error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete plant output record'
    });
  }
});

module.exports = router;
