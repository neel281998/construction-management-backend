const express = require('express');
const router = express.Router();
const { authenticateToken, requirePermission } = require('../middleware/auth');
const Step = require('../models/Step');

// Get all steps for a site
router.get('/site/:siteId', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const steps = await Step.find({ siteId: req.params.siteId, isActive: true })
      .sort({ stepNumber: 1 });
    
    res.json({
      success: true,
      data: { steps }
    });
  } catch (error) {
    console.error('Get steps error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch steps'
    });
  }
});

// Get a single step
router.get('/:id', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const step = await Step.findById(req.params.id);
    
    if (!step) {
      return res.status(404).json({
        success: false,
        message: 'Step not found'
      });
    }
    
    res.json({
      success: true,
      data: { step }
    });
  } catch (error) {
    console.error('Get step error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch step'
    });
  }
});

// Update step progress
router.patch('/:id/progress', authenticateToken, requirePermission('site.update'), async (req, res) => {
  try {
    const { progressM3, notes } = req.body;
    
    const step = await Step.findById(req.params.id);
    if (!step) {
      return res.status(404).json({
        success: false,
        message: 'Step not found'
      });
    }
    
    step.progressM3 = progressM3 || step.progressM3;
    if (notes) step.notes = notes;
    
    // Update status based on progress
    const progressPercentage = (step.progressM3 / step.estimatedVolumeM3) * 100;
    if (progressPercentage >= 100) {
      step.status = 'completed';
      step.completedDate = new Date();
    } else if (progressPercentage > 0) {
      step.status = 'in_progress';
      if (!step.startDate) step.startDate = new Date();
    }
    
    await step.save();
    
    res.json({
      success: true,
      data: { step }
    });
  } catch (error) {
    console.error('Update step progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update step progress'
    });
  }
});

// Update step dimensions and calculate progress
router.patch('/:id/dimensions', authenticateToken, requirePermission('site.update'), async (req, res) => {
  try {
    const { length, breadth, height, notes } = req.body;
    
    const step = await Step.findById(req.params.id);
    if (!step) {
      return res.status(404).json({
        success: false,
        message: 'Step not found'
      });
    }
    
    // Update dimensions
    if (length !== undefined) step.dimensions.length = length;
    if (breadth !== undefined) step.dimensions.breadth = breadth;
    if (height !== undefined) step.dimensions.height = height;
    if (notes) step.notes = notes;
    
    // Calculate progress from dimensions
    const progressData = step.calculateProgressFromDimensions();
    
    await step.save();
    
    res.json({
      success: true,
      message: 'Step dimensions updated successfully',
      data: { 
        step,
        calculatedProgress: progressData
      }
    });
  } catch (error) {
    console.error('Update step dimensions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update step dimensions'
    });
  }
});

// Update step status
router.patch('/:id/status', authenticateToken, requirePermission('site.update'), async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['pending', 'in_progress', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }
    
    const step = await Step.findById(req.params.id);
    if (!step) {
      return res.status(404).json({
        success: false,
        message: 'Step not found'
      });
    }
    
    step.status = status;
    if (status === 'in_progress' && !step.startDate) {
      step.startDate = new Date();
    } else if (status === 'completed') {
      step.completedDate = new Date();
    }
    
    await step.save();
    
    res.json({
      success: true,
      data: { step }
    });
  } catch (error) {
    console.error('Update step status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update step status'
    });
  }
});

module.exports = router;
