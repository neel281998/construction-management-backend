const express = require('express');
const router = express.Router();
const { authenticateToken, requirePermission } = require('../middleware/auth');
const Stock = require('../models/Stock');

// Get stocks for a specific step (must come before /site/:siteId to avoid route conflicts)
router.get('/step/:stepId', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const stocks = await Stock.find({ stepId: req.params.stepId })
      .sort({ date: -1 });
    
    res.json({
      success: true,
      data: { stocks }
    });
  } catch (error) {
    console.error('Get step stocks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch step stocks'
    });
  }
});

// Get all stocks for a site
router.get('/site/:siteId', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const stocks = await Stock.find({ siteId: req.params.siteId })
      .sort({ date: -1 });
    
    res.json({
      success: true,
      data: { stocks }
    });
  } catch (error) {
    console.error('Get stocks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stocks'
    });
  }
});

// Add stock consumption
router.post('/', authenticateToken, requirePermission('site.update'), async (req, res) => {
  try {
    const {
      siteId,
      stepId,
      stockType,
      materialName,
      quantityM3,
      supplier,
      notes
    } = req.body;
    
    // Validate required fields
    if (!siteId || !stepId || !stockType || !materialName || !quantityM3) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    // Validate stock type
    if (!['primary', 'secondary'].includes(stockType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid stock type'
      });
    }
    
    const stock = new Stock({
      siteId,
      stepId,
      stockType,
      materialName,
      quantityM3,
      supplier,
      notes,
      date: new Date()
    });
    
    await stock.save();
    
    res.status(201).json({
      success: true,
      data: { stock }
    });
  } catch (error) {
    console.error('Add stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add stock consumption'
    });
  }
});

// Get stock summary for a site
router.get('/site/:siteId/summary', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const stocks = await Stock.find({ siteId: req.params.siteId });
    
    // Group by material
    const materialSummary = {};
    
    stocks.forEach(stock => {
      if (!materialSummary[stock.materialName]) {
        materialSummary[stock.materialName] = {
          materialName: stock.materialName,
          totalQuantityM3: 0,
          usageCount: 0
        };
      }
      
      materialSummary[stock.materialName].totalQuantityM3 += stock.quantityM3;
      materialSummary[stock.materialName].usageCount += 1;
    });
    
    const summary = {
      materialSummary: Object.values(materialSummary),
      totalMaterials: Object.keys(materialSummary).length
    };
    
    res.json({
      success: true,
      data: { summary }
    });
  } catch (error) {
    console.error('Get stock summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stock summary'
    });
  }
});

module.exports = router;
