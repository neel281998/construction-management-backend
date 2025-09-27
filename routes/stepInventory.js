const express = require('express');
const router = express.Router();
const { authenticateToken, requirePermission } = require('../middleware/auth');
const StepInventoryReceipt = require('../models/StepInventoryReceipt');
const StepInventoryConsumption = require('../models/StepInventoryConsumption');
const Step = require('../models/Step');
const Site = require('../models/Site');

// Get all inventory receipts for a step
router.get('/receipts/step/:stepId', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const receipts = await StepInventoryReceipt.find({ 
      stepId: req.params.stepId,
      status: { $ne: 'rejected' }
    })
    .populate('verifiedBy', 'firstName lastName')
    .sort({ deliveryDate: -1 });
    
    res.json({
      success: true,
      data: { receipts }
    });
  } catch (error) {
    console.error('Get step inventory receipts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory receipts'
    });
  }
});

// Get all inventory consumption for a step
router.get('/consumption/step/:stepId', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const consumption = await StepInventoryConsumption.find({ 
      stepId: req.params.stepId,
      status: { $ne: 'rejected' }
    })
    .populate('recordedBy', 'firstName lastName')
    .populate('verifiedBy', 'firstName lastName')
    .sort({ consumptionDate: -1 });
    
    res.json({
      success: true,
      data: { consumption }
    });
  } catch (error) {
    console.error('Get step inventory consumption error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory consumption'
    });
  }
});

// Get inventory summary for a step
router.get('/summary/step/:stepId', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const stepId = req.params.stepId;
    
    // Get all receipts for this step
    const receipts = await StepInventoryReceipt.find({ 
      stepId: stepId,
      status: { $ne: 'rejected' }
    });
    
    // Get all consumption for this step
    const consumption = await StepInventoryConsumption.find({ 
      stepId: stepId,
      status: { $ne: 'rejected' }
    });
    
    // Calculate summary
    const totalReceived = receipts.reduce((sum, receipt) => sum + receipt.quantity, 0);
    const totalConsumed = consumption.reduce((sum, cons) => sum + cons.consumedQuantity, 0);
    const totalRemaining = totalReceived - totalConsumed;
    
    // Group by material
    const materialSummary = {};
    receipts.forEach(receipt => {
      const key = `${receipt.materialName}_${receipt.materialCategory}`;
      if (!materialSummary[key]) {
        materialSummary[key] = {
          materialName: receipt.materialName,
          materialCategory: receipt.materialCategory,
          materialType: receipt.materialType,
          unit: receipt.unit,
          totalReceived: 0,
          totalConsumed: 0,
          totalRemaining: 0
        };
      }
      materialSummary[key].totalReceived += receipt.quantity;
      materialSummary[key].totalRemaining += receipt.remainingQuantity;
    });
    
    consumption.forEach(cons => {
      const key = `${cons.materialName}_${cons.materialCategory}`;
      if (materialSummary[key]) {
        materialSummary[key].totalConsumed += cons.consumedQuantity;
      }
    });
    
    res.json({
      success: true,
      data: {
        summary: {
          totalReceived,
          totalConsumed,
          totalRemaining,
          consumptionPercentage: totalReceived > 0 ? (totalConsumed / totalReceived) * 100 : 0
        },
        materialSummary: Object.values(materialSummary)
      }
    });
  } catch (error) {
    console.error('Get step inventory summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory summary'
    });
  }
});

// Create inventory receipt
router.post('/receipts', authenticateToken, requirePermission('site.update'), async (req, res) => {
  try {
    const {
      stepId,
      siteId,
      sourceType,
      sourceId,
      sourceName,
      materialName,
      materialCategory,
      materialType,
      quantity,
      unit,
      qualityGrade,
      specifications,
      deliveryDate,
      deliveryImages,
      deliveryNotes,
      verificationNotes
    } = req.body;
    
    // Validate required fields
    if (!stepId || !siteId || !sourceType || !sourceId || !sourceName || 
        !materialName || !materialCategory || !materialType || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    // Verify step exists
    const step = await Step.findById(stepId);
    if (!step) {
      return res.status(404).json({
        success: false,
        message: 'Step not found'
      });
    }
    
    // Create receipt
    const receipt = new StepInventoryReceipt({
      stepId,
      siteId,
      sourceType,
      sourceId,
      sourceName,
      materialName,
      materialCategory,
      materialType,
      quantity,
      unit: unit || 'm³',
      qualityGrade,
      specifications: specifications || new Map(),
      deliveryDate: deliveryDate || new Date(),
      deliveryImages: deliveryImages || [],
      deliveryNotes,
      verifiedBy: req.user._id,
      verificationNotes,
      status: 'received'
    });
    
    await receipt.save();
    
    res.json({
      success: true,
      message: 'Inventory receipt created successfully',
      data: { receipt }
    });
  } catch (error) {
    console.error('Create inventory receipt error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create inventory receipt'
    });
  }
});

// Create inventory consumption
router.post('/consumption', authenticateToken, requirePermission('site.update'), async (req, res) => {
  try {
    const {
      stepId,
      siteId,
      receiptId,
      materialName,
      materialCategory,
      materialType,
      consumedQuantity,
      unit,
      workDescription,
      workLocation,
      workPhase,
      qualityCheck,
      consumptionImages,
      notes
    } = req.body;
    
    // Validate required fields
    if (!stepId || !siteId || !receiptId || !materialName || !materialCategory || 
        !materialType || !consumedQuantity || !workDescription) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    // Verify receipt exists and has sufficient quantity
    const receipt = await StepInventoryReceipt.findById(receiptId);
    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Inventory receipt not found'
      });
    }
    
    if (consumedQuantity > receipt.remainingQuantity) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient inventory remaining'
      });
    }
    
    // Create consumption record
    const consumption = new StepInventoryConsumption({
      stepId,
      siteId,
      receiptId,
      materialName,
      materialCategory,
      materialType,
      consumedQuantity,
      unit: unit || 'm³',
      workDescription,
      workLocation,
      workPhase,
      qualityCheck: qualityCheck || { performed: false, passed: false, testResults: [] },
      consumptionImages: consumptionImages || [],
      notes,
      recordedBy: req.user._id,
      status: 'recorded'
    });
    
    await consumption.save();
    
    // Update receipt consumption
    receipt.consumeInventory(consumedQuantity, notes);
    await receipt.save();
    
    res.json({
      success: true,
      message: 'Inventory consumption recorded successfully',
      data: { consumption }
    });
  } catch (error) {
    console.error('Create inventory consumption error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record inventory consumption'
    });
  }
});

// Verify inventory receipt
router.patch('/receipts/:id/verify', authenticateToken, requirePermission('site.update'), async (req, res) => {
  try {
    const { status, verificationNotes } = req.body;
    
    const receipt = await StepInventoryReceipt.findById(req.params.id);
    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Inventory receipt not found'
      });
    }
    
    receipt.status = status || 'verified';
    receipt.verifiedBy = req.user._id;
    receipt.verificationDate = new Date();
    if (verificationNotes) {
      receipt.verificationNotes = verificationNotes;
    }
    
    await receipt.save();
    
    res.json({
      success: true,
      message: 'Inventory receipt verified successfully',
      data: { receipt }
    });
  } catch (error) {
    console.error('Verify inventory receipt error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify inventory receipt'
    });
  }
});

// Verify inventory consumption
router.patch('/consumption/:id/verify', authenticateToken, requirePermission('site.update'), async (req, res) => {
  try {
    const { status, verificationNotes } = req.body;
    
    const consumption = await StepInventoryConsumption.findById(req.params.id);
    if (!consumption) {
      return res.status(404).json({
        success: false,
        message: 'Inventory consumption not found'
      });
    }
    
    if (status === 'verified') {
      consumption.verifyConsumption(req.user._id, verificationNotes);
    } else if (status === 'rejected') {
      consumption.rejectConsumption(verificationNotes);
    }
    
    await consumption.save();
    
    res.json({
      success: true,
      message: 'Inventory consumption verified successfully',
      data: { consumption }
    });
  } catch (error) {
    console.error('Verify inventory consumption error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify inventory consumption'
    });
  }
});

module.exports = router;




