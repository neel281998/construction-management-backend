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
    .populate('verifiedBy', 'firstName lastName email')
    .sort({ deliveryDate: -1 });
    
    // Ensure all receipts have receivedBy field for mobile app compatibility
    const processedReceipts = receipts.map(receipt => {
      const receiptObj = receipt.toObject();
      
      // If receivedBy is missing, create it from verifiedBy or use defaults
      if (!receiptObj.receivedBy) {
        receiptObj.receivedBy = {
          _id: receiptObj.verifiedBy?._id || null,
          firstName: receiptObj.verifiedBy?.firstName || 'Unknown',
          lastName: receiptObj.verifiedBy?.lastName || 'User',
          email: receiptObj.verifiedBy?.email || 'unknown@example.com'
        };
      }
      
      return receiptObj;
    });
    
    res.json({
      success: true,
      data: { receipts: processedReceipts }
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

// Get receipt details by ID
router.get('/receipts/:receiptId', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const receipt = await StepInventoryReceipt.findById(req.params.receiptId)
      .populate('verifiedBy', 'firstName lastName email')
      .populate('stepId', 'name stepNumber')
      .populate('siteId', 'name code');
    
    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }
    
    // Ensure receivedBy field exists for mobile app compatibility
    const receiptObj = receipt.toObject();
    if (!receiptObj.receivedBy) {
      receiptObj.receivedBy = {
        _id: receiptObj.verifiedBy?._id || null,
        firstName: receiptObj.verifiedBy?.firstName || 'Unknown',
        lastName: receiptObj.verifiedBy?.lastName || 'User',
        email: receiptObj.verifiedBy?.email || 'unknown@example.com'
      };
    }
    
    res.json({
      success: true,
      data: { receipt: receiptObj }
    });
    
  } catch (error) {
    console.error('Get receipt details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch receipt details'
    });
  }
});

// Update received quantity by step manager
router.patch('/receipts/:receiptId/quantity', authenticateToken, requirePermission('site.update'), async (req, res) => {
  try {
    const { receivedQuantity, notes } = req.body;
    
    if (!receivedQuantity || receivedQuantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid received quantity is required'
      });
    }
    
    const receipt = await StepInventoryReceipt.findById(req.params.receiptId);
    
    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }
    
    // Update the received quantity
    const originalQuantity = receipt.quantity;
    receipt.quantity = receivedQuantity;
    receipt.remainingQuantity = receivedQuantity - receipt.consumedQuantity;
    
    // Add verification notes
    if (notes) {
      receipt.verificationNotes = notes;
    }
    
    // Update verification info
    receipt.verifiedBy = req.user._id;
    receipt.verificationDate = new Date();
    receipt.status = 'verified';
    
    await receipt.save();
    
    res.json({
      success: true,
      message: 'Received quantity updated successfully',
      data: {
        receipt: {
          id: receipt._id,
          originalQuantity,
          receivedQuantity,
          difference: receivedQuantity - originalQuantity,
          status: receipt.status,
          verifiedBy: {
            firstName: req.user.firstName,
            lastName: req.user.lastName
          },
          verifiedAt: receipt.verificationDate
        }
      }
    });
    
  } catch (error) {
    console.error('Update received quantity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update received quantity'
    });
  }
});

// Update received details by step manager (with images and detailed notes)
router.patch('/receipts/:receiptId/received-details', authenticateToken, requirePermission('site.update'), async (req, res) => {
  try {
    const { 
      receivedQuantity, 
      receivedImages, 
      receivedNotes, 
      qualityCheck,
      discrepancies,
      actualDeliveryDate
    } = req.body;
    
    if (!receivedQuantity || receivedQuantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid received quantity is required'
      });
    }
    
    const receipt = await StepInventoryReceipt.findById(req.params.receiptId);
    
    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }
    
    // Store original values for comparison
    const originalQuantity = receipt.quantity;
    const originalDeliveryDate = receipt.deliveryDate;
    
    // Update the received quantity
    receipt.quantity = receivedQuantity;
    receipt.remainingQuantity = receivedQuantity - receipt.consumedQuantity;
    
    // Update delivery images with received images
    if (receivedImages && receivedImages.length > 0) {
      receipt.deliveryImages = [...(receipt.deliveryImages || []), ...receivedImages];
    }
    
    // Update delivery notes with received notes
    if (receivedNotes) {
      receipt.deliveryNotes = receivedNotes;
    }
    
    // Update delivery date if different
    if (actualDeliveryDate) {
      receipt.deliveryDate = new Date(actualDeliveryDate);
    }
    
    // Add quality check information
    if (qualityCheck) {
      receipt.qualityCheck = {
        performed: qualityCheck.performed || false,
        passed: qualityCheck.passed || false,
        testResults: qualityCheck.testResults || [],
        checkedBy: req.user._id,
        checkedAt: new Date()
      };
    }
    
    // Add discrepancy information
    if (discrepancies) {
      receipt.discrepancies = {
        quantityDifference: receivedQuantity - originalQuantity,
        qualityIssues: discrepancies.qualityIssues || [],
        damageReport: discrepancies.damageReport || null,
        otherIssues: discrepancies.otherIssues || null,
        reportedBy: req.user._id,
        reportedAt: new Date()
      };
    }
    
    // Update verification info
    receipt.verifiedBy = req.user._id;
    receipt.verificationDate = new Date();
    receipt.status = 'verified';
    
    // Create comprehensive verification notes
    let verificationNotes = `Received quantity updated by step manager.\n`;
    verificationNotes += `Original: ${originalQuantity} ${receipt.unit}\n`;
    verificationNotes += `Received: ${receivedQuantity} ${receipt.unit}\n`;
    verificationNotes += `Difference: ${receivedQuantity - originalQuantity} ${receipt.unit}\n`;
    
    if (receivedNotes) {
      verificationNotes += `\nStep Manager Notes: ${receivedNotes}\n`;
    }
    
    if (discrepancies && discrepancies.quantityDifference !== 0) {
      verificationNotes += `\nDiscrepancy: ${discrepancies.quantityDifference} ${receipt.unit}\n`;
    }
    
    receipt.verificationNotes = verificationNotes;
    
    await receipt.save();
    
    res.json({
      success: true,
      message: 'Received details updated successfully',
      data: {
        receipt: {
          id: receipt._id,
          originalQuantity,
          receivedQuantity,
          difference: receivedQuantity - originalQuantity,
          status: receipt.status,
          verifiedBy: {
            firstName: req.user.firstName,
            lastName: req.user.lastName
          },
          verifiedAt: receipt.verificationDate,
          images: receipt.deliveryImages,
          notes: receipt.deliveryNotes,
          qualityCheck: receipt.qualityCheck,
          discrepancies: receipt.discrepancies
        }
      }
    });
    
  } catch (error) {
    console.error('Update received details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update received details'
    });
  }
});

// Verify receipt by step manager
router.patch('/receipts/:receiptId/verify', authenticateToken, requirePermission('site.update'), async (req, res) => {
  try {
    const { verified, notes } = req.body;
    
    const receipt = await StepInventoryReceipt.findById(req.params.receiptId);
    
    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }
    
    // Update verification status
    receipt.status = verified ? 'verified' : 'rejected';
    receipt.verifiedBy = req.user._id;
    receipt.verificationDate = new Date();
    
    if (notes) {
      receipt.verificationNotes = notes;
    }
    
    await receipt.save();
    
    res.json({
      success: true,
      message: `Receipt ${verified ? 'verified' : 'rejected'} successfully`,
      data: {
        receipt: {
          id: receipt._id,
          status: receipt.status,
          verifiedBy: {
            firstName: req.user.firstName,
            lastName: req.user.lastName
          },
          verifiedAt: receipt.verificationDate,
          notes: receipt.verificationNotes
        }
      }
    });
    
  } catch (error) {
    console.error('Verify receipt error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify receipt'
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
      verificationNotes,
      vehicle
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
      specifications: (specifications && typeof specifications === 'object') ? specifications : {},
      deliveryDate: deliveryDate || new Date(),
      deliveryImages: deliveryImages || [],
      deliveryNotes,
      vehicle: vehicle ? {
        _id: vehicle._id,
        vehicleNumber: vehicle.vehicleNumber,
        vehicleType: vehicle.vehicleType,
        driverName: vehicle.driverName,
        driverPhone: vehicle.driverPhone
      } : undefined,
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
    const errMsg = error?.message || 'Failed to create inventory receipt';
    const errName = error?.name || '';
    res.status(500).json({
      success: false,
      message: errMsg,
      ...(process.env.NODE_ENV === 'development' && { errorName: errName, stack: error?.stack })
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





