const express = require('express');
const router = express.Router();
const { authenticateToken, requirePermission } = require('../middleware/auth');
const SiteInventory = require('../models/SiteInventory');
const Step = require('../models/Step');

// Get all inventory for a specific site
router.get('/site/:siteId', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const inventory = await SiteInventory.find({ 
      siteId: req.params.siteId, 
      isActive: true 
    }).populate('stepId', 'stepNumber stepName');
    
    res.json({
      success: true,
      data: { inventory }
    });
  } catch (error) {
    console.error('Get site inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch site inventory'
    });
  }
});

// Get inventory for a specific step
router.get('/step/:stepId', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const inventory = await SiteInventory.find({ 
      stepId: req.params.stepId, 
      isActive: true 
    });
    
    res.json({
      success: true,
      data: { inventory }
    });
  } catch (error) {
    console.error('Get step inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch step inventory'
    });
  }
});

// Add new inventory item
router.post('/', authenticateToken, requirePermission('site.update'), async (req, res) => {
  try {
    const {
      siteId,
      stepId,
      materialName,
      materialType,
      quantity,
      unit,
      estimatedCost,
      supplier,
      notes
    } = req.body;
    
    const inventoryItem = new SiteInventory({
      siteId,
      stepId,
      materialName,
      materialType,
      quantity,
      unit,
      estimatedCost,
      supplier,
      notes
    });
    
    await inventoryItem.save();
    
    res.status(201).json({
      success: true,
      message: 'Inventory item added successfully',
      data: { inventoryItem }
    });
  } catch (error) {
    console.error('Add inventory item error:', error);
    
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
      message: 'Failed to add inventory item'
    });
  }
});

// Update inventory quantity
router.patch('/:id/quantity', authenticateToken, requirePermission('site.update'), async (req, res) => {
  try {
    const { quantity, notes } = req.body;
    
    const inventoryItem = await SiteInventory.findById(req.params.id);
    if (!inventoryItem) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    inventoryItem.quantity = quantity;
    if (notes) inventoryItem.notes = notes;
    
    await inventoryItem.save();
    
    res.json({
      success: true,
      message: 'Inventory quantity updated successfully',
      data: { inventoryItem }
    });
  } catch (error) {
    console.error('Update inventory quantity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update inventory quantity'
    });
  }
});

// Get inventory summary for a site
router.get('/site/:siteId/summary', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const inventory = await SiteInventory.find({ 
      siteId: req.params.siteId, 
      isActive: true 
    });
    
    // Group by material name and type
    const summary = {};
    inventory.forEach(item => {
      const key = `${item.materialName}_${item.materialType}`;
      if (!summary[key]) {
        summary[key] = {
          materialName: item.materialName,
          materialType: item.materialType,
          totalQuantity: 0,
          totalCost: 0,
          steps: []
        };
      }
      
      summary[key].totalQuantity += item.quantity;
      summary[key].totalCost += item.estimatedCost;
      summary[key].steps.push({
        stepId: item.stepId,
        quantity: item.quantity,
        unit: item.unit
      });
    });
    
    res.json({
      success: true,
      data: { 
        summary: Object.values(summary),
        totalItems: inventory.length
      }
    });
  } catch (error) {
    console.error('Get inventory summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory summary'
    });
  }
});

module.exports = router;
