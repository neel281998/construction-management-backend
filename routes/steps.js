const express = require('express');
const router = express.Router();
const { authenticateToken, requirePermission } = require('../middleware/auth');
const Step = require('../models/Step');

// Get all steps for a site
router.get('/site/:siteId', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const steps = await Step.find({ siteId: req.params.siteId, isActive: true })
      .populate('assignedUsers.user', 'firstName lastName email role')
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

// Get available step managers (must be before /:id route)
router.get('/available-step-managers', authenticateToken, requirePermission('user.read'), async (req, res) => {
  try {
    const User = require('../models/User');
    const stepManagers = await User.find({ 
      isActive: true,
      role: 'step_manager'
    }).select('firstName lastName email role');
    
    res.json({
      success: true,
      data: { stepManagers }
    });
    
  } catch (error) {
    console.error('Get available step managers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available step managers'
    });
  }
});

// Get a single step
router.get('/:id', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const step = await Step.findById(req.params.id)
      .populate('assignedUsers.user', 'firstName lastName email role');
    
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

// Update step estimated dimensions
router.patch('/:id/estimated-dimensions', authenticateToken, requirePermission('site.update'), async (req, res) => {
  try {
    const { 
      length, breadth, height, thickness, count, unit, 
      additionalFields, notes 
    } = req.body;
    
    const step = await Step.findById(req.params.id);
    if (!step) {
      return res.status(404).json({
        success: false,
        message: 'Step not found'
      });
    }
    
    // Update estimated dimensions
    step.estimatedDimensions = {
      length: length !== undefined ? length : step.estimatedDimensions.length,
      breadth: breadth !== undefined ? breadth : step.estimatedDimensions.breadth,
      height: height !== undefined ? height : step.estimatedDimensions.height,
      thickness: thickness !== undefined ? thickness : step.estimatedDimensions.thickness,
      count: count !== undefined ? count : step.estimatedDimensions.count,
      unit: unit || step.estimatedDimensions.unit,
      additionalFields: additionalFields || step.estimatedDimensions.additionalFields
    };
    
    if (notes) step.notes = notes;
    
    // Calculate progress from dimensions
    const progressResult = step.calculateProgressFromDimensions();
    
    await step.save();
    
    // Recalculate site progress
    const Site = require('../models/Site');
    const site = await Site.findById(step.siteId);
    if (site) {
      await site.calculateOverallProgress();
      await site.save();
    }
    
    res.json({
      success: true,
      message: 'Step estimated dimensions updated successfully',
      data: { 
        step,
        progress: progressResult
      }
    });
    
  } catch (error) {
    console.error('Update step estimated dimensions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update step estimated dimensions'
    });
  }
});

// Update step completed dimensions
router.patch('/:id/completed-dimensions', authenticateToken, requirePermission('site.update'), async (req, res) => {
  try {
    const { 
      length, breadth, height, thickness, count, unit, 
      additionalFields, notes 
    } = req.body;
    
    const step = await Step.findById(req.params.id);
    if (!step) {
      return res.status(404).json({
        success: false,
        message: 'Step not found'
      });
    }
    
    // Update completed dimensions
    step.completedDimensions = {
      length: length !== undefined ? length : step.completedDimensions.length,
      breadth: breadth !== undefined ? breadth : step.completedDimensions.breadth,
      height: height !== undefined ? height : step.completedDimensions.height,
      thickness: thickness !== undefined ? thickness : step.completedDimensions.thickness,
      count: count !== undefined ? count : step.completedDimensions.count,
      unit: unit || step.completedDimensions.unit,
      additionalFields: additionalFields || step.completedDimensions.additionalFields
    };
    
    if (notes) step.notes = notes;
    
    // Calculate progress from dimensions
    const progressResult = step.calculateProgressFromDimensions();
    
    await step.save();
    
    // Recalculate site progress
    const Site = require('../models/Site');
    const site = await Site.findById(step.siteId);
    if (site) {
      await site.calculateOverallProgress();
      await site.save();
    }
    
    res.json({
      success: true,
      message: 'Step completed dimensions updated successfully',
      data: { 
        step,
        progress: progressResult
      }
    });
    
  } catch (error) {
    console.error('Update step completed dimensions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update step completed dimensions'
    });
  }
});

// Get step type configuration
router.get('/config/:stepType', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const { getStepTypeConfig } = require('../config/stepConfigurations');
    const config = getStepTypeConfig(req.params.stepType);
    
    res.json({
      success: true,
      data: { config }
    });
    
  } catch (error) {
    console.error('Get step type config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get step type configuration'
    });
  }
});

// Calculate volume for given dimensions
router.post('/calculate-volume', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const { stepType, dimensions } = req.body;
    
    if (!stepType || !dimensions) {
      return res.status(400).json({
        success: false,
        message: 'Step type and dimensions are required'
      });
    }
    
    // Validate dimensions
    if (!dimensions.length || !dimensions.breadth || !dimensions.height) {
      return res.status(400).json({
        success: false,
        message: 'Length, breadth, and height are required'
      });
    }
    
    // Create a temporary step instance for calculation
    const tempStep = new Step({
      stepType,
      estimatedDimensions: dimensions
    });
    
    const volumeResult = tempStep.calculateVolume(dimensions);
    
    res.json({
      success: true,
      data: { 
        volume: volumeResult.volume,
        unit: volumeResult.unit,
        displayUnit: volumeResult.displayUnit
      }
    });
    
  } catch (error) {
    console.error('Calculate volume error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate volume',
      error: error.message
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

// Assign users to a step
router.post('/:id/assign-users', authenticateToken, requirePermission('step.update'), async (req, res) => {
  try {
    const { userIds, role = 'worker' } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'User IDs array is required'
      });
    }
    
    const step = await Step.findById(req.params.id);
    if (!step) {
      return res.status(404).json({
        success: false,
        message: 'Step not found'
      });
    }
    
    // Add new user assignments
    const newAssignments = userIds.map(userId => ({
      user: userId,
      assignedDate: new Date(),
      role: role,
      isActive: true
    }));
    
    step.assignedUsers = step.assignedUsers.concat(newAssignments);
    await step.save();
    
    await step.populate('assignedUsers.user', 'firstName lastName email role');
    
    res.json({
      success: true,
      message: 'Users assigned to step successfully',
      data: { step }
    });
    
  } catch (error) {
    console.error('Assign users to step error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign users to step'
    });
  }
});

// Remove user from step
router.delete('/:id/assign-users/:userId', authenticateToken, requirePermission('step.update'), async (req, res) => {
  try {
    const { id, userId } = req.params;
    
    const step = await Step.findById(id);
    if (!step) {
      return res.status(404).json({
        success: false,
        message: 'Step not found'
      });
    }
    
    // Remove user assignment
    step.assignedUsers = step.assignedUsers.filter(
      assignment => assignment.user.toString() !== userId
    );
    
    await step.save();
    await step.populate('assignedUsers.user', 'firstName lastName email role');
    
    res.json({
      success: true,
      message: 'User removed from step successfully',
      data: { step }
    });
    
  } catch (error) {
    console.error('Remove user from step error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove user from step'
    });
  }
});

// Update user role in step
router.patch('/:id/assign-users/:userId/role', authenticateToken, requirePermission('step.update'), async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { role } = req.body;
    
    if (!['primary', 'secondary', 'supervisor', 'worker'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }
    
    const step = await Step.findById(id);
    if (!step) {
      return res.status(404).json({
        success: false,
        message: 'Step not found'
      });
    }
    
    // Update user role
    const assignment = step.assignedUsers.find(
      assignment => assignment.user.toString() === userId
    );
    
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'User not assigned to this step'
      });
    }
    
    assignment.role = role;
    await step.save();
    await step.populate('assignedUsers.user', 'firstName lastName email role');
    
    res.json({
      success: true,
      message: 'User role updated successfully',
      data: { step }
    });
    
  } catch (error) {
    console.error('Update user role in step error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user role in step'
    });
  }
});

// Get available users for step assignment
router.get('/available-users', authenticateToken, requirePermission('user.read'), async (req, res) => {
  try {
    const User = require('../models/User');
    const users = await User.find({ 
      isActive: true,
      role: { $in: ['worker', 'supervisor', 'step_manager'] }
    }).select('firstName lastName email role');
    
    res.json({
      success: true,
      data: { users }
    });
    
  } catch (error) {
    console.error('Get available users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available users'
    });
  }
});

// Assign step manager to a step
router.patch('/:id/assign-step-manager', authenticateToken, requirePermission('step.update'), async (req, res) => {
  try {
    const { stepManagerId } = req.body;
    
    if (!stepManagerId) {
      return res.status(400).json({
        success: false,
        message: 'Step manager ID is required'
      });
    }
    
    const step = await Step.findById(req.params.id);
    if (!step) {
      return res.status(404).json({
        success: false,
        message: 'Step not found'
      });
    }
    
    // Verify the user is a step manager
    const User = require('../models/User');
    const stepManager = await User.findById(stepManagerId);
    if (!stepManager || stepManager.role !== 'step_manager') {
      return res.status(400).json({
        success: false,
        message: 'Invalid step manager'
      });
    }
    
    step.stepManager = stepManagerId;
    await step.save();
    
    await step.populate('stepManager', 'firstName lastName email role');
    
    res.json({
      success: true,
      message: 'Step manager assigned successfully',
      data: { step }
    });
    
  } catch (error) {
    console.error('Assign step manager error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign step manager'
    });
  }
});

// Remove step manager from a step
router.delete('/:id/step-manager', authenticateToken, requirePermission('step.update'), async (req, res) => {
  try {
    const step = await Step.findById(req.params.id);
    if (!step) {
      return res.status(404).json({
        success: false,
        message: 'Step not found'
      });
    }
    
    step.stepManager = null;
    await step.save();
    
    res.json({
      success: true,
      message: 'Step manager removed successfully',
      data: { step }
    });
    
  } catch (error) {
    console.error('Remove step manager error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove step manager'
    });
  }
});

module.exports = router;
