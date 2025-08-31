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
