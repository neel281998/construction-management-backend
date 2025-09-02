const express = require('express');
const router = express.Router();
const { authenticateToken, requirePermission } = require('../middleware/auth');
const SiteInventory = require('../models/SiteInventory');
const Step = require('../models/Step');
const { getMaterialTemplate, getAllMaterialTemplates, getMaterialCategories, getUnits } = require('../config/materialTemplates');

// Get all inventory for a specific site
router.get('/site/:siteId', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const inventory = await SiteInventory.find({ 
      siteId: req.params.siteId, 
      isActive: true 
    }).populate('stepId', 'stepNumber stepName')
      .populate('addedBy', 'firstName lastName')
      .populate('lastUpdatedBy', 'firstName lastName')
      .sort({ materialCategory: 1, materialName: 1 });
    
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
    }).populate('addedBy', 'firstName lastName')
      .sort({ materialCategory: 1, materialName: 1 });
    
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

// Get material templates
router.get('/templates', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const templates = getAllMaterialTemplates();
    res.json({
      success: true,
      data: { templates }
    });
  } catch (error) {
    console.error('Get material templates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch material templates'
    });
  }
});

// Get material template for specific project type
router.get('/templates/:projectType', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const template = getMaterialTemplate(req.params.projectType);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Material template not found'
      });
    }
    
    res.json({
      success: true,
      data: { template }
    });
  } catch (error) {
    console.error('Get material template error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch material template'
    });
  }
});

// Get material categories
router.get('/categories', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const categories = getMaterialCategories();
    res.json({
      success: true,
      data: { categories }
    });
  } catch (error) {
    console.error('Get material categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch material categories'
    });
  }
});

// Get units
router.get('/units', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const units = getUnits();
    res.json({
      success: true,
      data: { units }
    });
  } catch (error) {
    console.error('Get units error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch units'
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
      materialCategory,
      materialType,
      quantity,
      unit,
      supplier,
      specifications,
      reorderLevel,
      notes
    } = req.body;
    
    const inventoryItem = new SiteInventory({
      siteId,
      stepId,
      materialName,
      materialCategory,
      materialType,
      quantity,
      unit,
      supplier,
      specifications,
      reorderLevel,
      notes,
      addedBy: req.user._id
    });
    
    await inventoryItem.save();
    
    // Populate references
    await inventoryItem.populate(['stepId', 'addedBy']);
    
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

// Bulk add inventory items from template
router.post('/bulk-from-template', authenticateToken, requirePermission('site.update'), async (req, res) => {
  try {
    const { siteId, stepId, projectType, customQuantities } = req.body;
    
    const template = getMaterialTemplate(projectType);
    if (!template) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project type'
      });
    }
    
    const inventoryPromises = template.materials.map(material => {
      const quantity = customQuantities?.[material.name] || material.typicalQuantity;
      
      return new SiteInventory({
        siteId,
        stepId,
        materialName: material.name,
        materialCategory: material.category,
        materialType: material.materialType,
        quantity,
        unit: material.unit,

        specifications: material.specifications,
        notes: `Added from ${template.name} template`,
        addedBy: req.user._id
      }).save();
    });
    
    const createdItems = await Promise.all(inventoryPromises);
    
    res.status(201).json({
      success: true,
      message: `Added ${createdItems.length} inventory items from template`,
      data: { inventoryItems: createdItems }
    });
  } catch (error) {
    console.error('Bulk add inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add inventory items from template'
    });
  }
});

// Update inventory item
router.put('/:id', authenticateToken, requirePermission('site.update'), async (req, res) => {
  try {
    const inventoryItem = await SiteInventory.findById(req.params.id);
    if (!inventoryItem) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    // Update fields
    Object.assign(inventoryItem, req.body);
    inventoryItem.lastUpdatedBy = req.user._id;
    
    await inventoryItem.save();
    
    // Populate references
    await inventoryItem.populate(['stepId', 'addedBy', 'lastUpdatedBy']);
    
    res.json({
      success: true,
      message: 'Inventory item updated successfully',
      data: { inventoryItem }
    });
  } catch (error) {
    console.error('Update inventory item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update inventory item'
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
    inventoryItem.lastUpdatedBy = req.user._id;
    
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

// Update inventory status
router.patch('/:id/status', authenticateToken, requirePermission('site.update'), async (req, res) => {
  try {
    const { status, notes } = req.body;
    
    const inventoryItem = await SiteInventory.findById(req.params.id);
    if (!inventoryItem) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    inventoryItem.status = status;
    if (notes) inventoryItem.notes = notes;
    inventoryItem.lastUpdatedBy = req.user._id;
    
    await inventoryItem.save();
    
    res.json({
      success: true,
      message: 'Inventory status updated successfully',
      data: { inventoryItem }
    });
  } catch (error) {
    console.error('Update inventory status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update inventory status'
    });
  }
});

// Delete inventory item (soft delete)
router.delete('/:id', authenticateToken, requirePermission('site.update'), async (req, res) => {
  try {
    const inventoryItem = await SiteInventory.findById(req.params.id);
    if (!inventoryItem) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    inventoryItem.isActive = false;
    inventoryItem.lastUpdatedBy = req.user._id;
    await inventoryItem.save();
    
    res.json({
      success: true,
      message: 'Inventory item deleted successfully'
    });
  } catch (error) {
    console.error('Delete inventory item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete inventory item'
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
    
    // Group by material category
    const summaryByCategory = {};
    const summaryByType = {};
    
    inventory.forEach(item => {
      // By category
      if (!summaryByCategory[item.materialCategory]) {
        summaryByCategory[item.materialCategory] = {
          category: item.materialCategory,
          totalItems: 0,
          totalQuantity: 0,
          materials: []
        };
      }
      summaryByCategory[item.materialCategory].totalItems++;
      summaryByCategory[item.materialCategory].totalQuantity += item.quantity;
      summaryByCategory[item.materialCategory].materials.push({
        name: item.materialName,
        quantity: item.quantity,
        unit: item.unit
      });
      
      // By type
      if (!summaryByType[item.materialType]) {
        summaryByType[item.materialType] = {
          type: item.materialType,
          totalItems: 0,
          totalQuantity: 0
        };
      }
      summaryByType[item.materialType].totalItems++;
      summaryByType[item.materialType].totalQuantity += item.quantity;
    });
    
    res.json({
      success: true,
      data: { 
        summaryByCategory: Object.values(summaryByCategory),
        summaryByType: Object.values(summaryByType),
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

// Get low stock alerts
router.get('/site/:siteId/alerts', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const lowStockItems = await SiteInventory.find({
      siteId: req.params.siteId,
      isActive: true,
      $expr: {
        $lte: ['$quantity', '$reorderLevel']
      }
    }).populate('stepId', 'stepNumber stepName');
    
    res.json({
      success: true,
      data: { 
        lowStockItems,
        count: lowStockItems.length
      }
    });
  } catch (error) {
    console.error('Get low stock alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch low stock alerts'
    });
  }
});

module.exports = router;
