const express = require('express');
const Site = require('../models/Site');
const { authenticateToken, requirePermission, canAccessSite } = require('../middleware/auth');

const router = express.Router();

// Get all sites (with pagination and filtering)
router.get('/', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      siteManager
    } = req.query;
    
    // Build query
    let query = { isActive: true };
    
    // Role-based filtering
    if (req.user.role !== 'admin') {
      query.$or = [
        { siteManager: req.user._id },
        { 'assignedStaff.user': req.user._id }
      ];
    }
    
    // Apply filters
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (siteManager) {
      query.siteManager = siteManager;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } },
        { 'address.state': { $regex: search, $options: 'i' } }
      ];
    }
    
    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [sites, totalCount] = await Promise.all([
      Site.find(query)
        .populate('siteManager', 'firstName lastName email')
        .populate('assignedStaff.user', 'firstName lastName role')
        .populate('assignedVehicles.vehicle', 'vehicleNumber type status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Site.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: {
        sites,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + sites.length < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });
    
  } catch (error) {
    console.error('Get sites error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sites'
    });
  }
});

// Get single site
router.get('/:id', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const site = await Site.findById(req.params.id)
      .populate('siteManager', 'firstName lastName email phone')
      .populate('assignedStaff.user', 'firstName lastName role email phone')
      .populate('assignedVehicles.vehicle', 'vehicleNumber type brand model status');
    
    if (!site) {
      return res.status(404).json({
        success: false,
        message: 'Site not found'
      });
    }
    
    // Check access permissions
    if (req.user.role !== 'admin' && 
        site.siteManager.toString() !== req.user._id.toString() &&
        !site.assignedStaff.some(staff => staff.user._id.toString() === req.user._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      data: { site }
    });
    
  } catch (error) {
    console.error('Get site error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch site'
    });
  }
});

// Create new site
router.post('/', authenticateToken, requirePermission('site.create'), async (req, res) => {
  try {
    const siteData = {
      ...req.body,
      siteManager: req.body.siteManagerId || req.user._id
    };
    
    const site = new Site(siteData);
    await site.save();
    
    // Populate the response
    await site.populate('siteManager', 'firstName lastName email');
    
    res.status(201).json({
      success: true,
      message: 'Site created successfully',
      data: { site }
    });
    
  } catch (error) {
    console.error('Create site error:', error);
    
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
      message: 'Failed to create site'
    });
  }
});

// Update site status (specific route before general /:id)
router.put('/:id/status', authenticateToken, requirePermission('site.update'), async (req, res) => {
  try {
    const { status } = req.body;
    
    const site = await Site.findById(req.params.id);
    
    if (!site) {
      return res.status(404).json({
        success: false,
        message: 'Site not found'
      });
    }
    
    // Check permissions
    if (req.user.role !== 'admin' && site.siteManager.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    site.status = status;
    
    // Auto-set completion date if status is completed
    if (status === 'completed' && !site.actualEndDate) {
      site.actualEndDate = new Date();
    }
    
    await site.save();
    
    res.json({
      success: true,
      message: 'Site status updated successfully',
      data: {
        siteId: site._id,
        status: site.status,
        actualEndDate: site.actualEndDate
      }
    });
    
  } catch (error) {
    console.error('Update site status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update site status'
    });
  }
});

// Update site manager (specific route before general /:id)
router.put('/:id/manager', authenticateToken, requirePermission('site.update'), async (req, res) => {
  try {
    const { managerId } = req.body;
    
    if (!managerId) {
      return res.status(400).json({
        success: false,
        message: 'Manager ID is required'
      });
    }
    
    const site = await Site.findById(req.params.id);
    
    if (!site) {
      return res.status(404).json({
        success: false,
        message: 'Site not found'
      });
    }
    
    // Check permissions - only admin or current site manager can change
    if (req.user.role !== 'admin' && site.siteManager.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    site.siteManager = managerId;
    await site.save();
    await site.populate('siteManager', 'firstName lastName email');
    
    res.json({
      success: true,
      message: 'Site manager updated successfully',
      data: { site }
    });
    
  } catch (error) {
    console.error('Update site manager error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update site manager'
    });
  }
});

// Update site budget (specific route before general /:id)
router.put('/:id/budget', authenticateToken, requirePermission('site.update'), async (req, res) => {
  try {
    const { budget, actualCost } = req.body;
    
    const site = await Site.findById(req.params.id);
    
    if (!site) {
      return res.status(404).json({
        success: false,
        message: 'Site not found'
      });
    }
    
    // Check permissions
    if (req.user.role !== 'admin' && site.siteManager.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    if (budget !== undefined) {
      site.budget = budget;
    }
    
    if (actualCost !== undefined) {
      site.actualCost = actualCost;
    }
    
    await site.save();
    
    res.json({
      success: true,
      message: 'Site budget updated successfully',
      data: {
        siteId: site._id,
        budget: site.budget,
        actualCost: site.actualCost,
        costVariance: site.budget - site.actualCost
      }
    });
    
  } catch (error) {
    console.error('Update site budget error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update site budget'
    });
  }
});

// Update site (general route - must come after specific routes)
router.put('/:id', authenticateToken, requirePermission('site.update'), async (req, res) => {
  try {
    const site = await Site.findById(req.params.id);
    
    if (!site) {
      return res.status(404).json({
        success: false,
        message: 'Site not found'
      });
    }
    
    // Check permissions
    if (req.user.role !== 'admin' && site.siteManager.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    // Update site fields
    Object.assign(site, req.body);
    await site.save();
    
    // Populate references
    await site.populate(['siteManager', 'assignedStaff.user', 'assignedVehicles.vehicle']);
    
    res.json({
      success: true,
      message: 'Site updated successfully',
      data: { site }
    });
    
  } catch (error) {
    console.error('Update site error:', error);
    
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
      message: 'Failed to update site'
    });
  }
});

// Update site progress
router.put('/:id/progress', authenticateToken, requirePermission('site.update'), async (req, res) => {
  try {
    const { progress } = req.body;
    
    if (progress < 0 || progress > 100) {
      return res.status(400).json({
        success: false,
        message: 'Progress must be between 0 and 100'
      });
    }
    
    const site = await Site.findById(req.params.id);
    
    if (!site) {
      return res.status(404).json({
        success: false,
        message: 'Site not found'
      });
    }
    
    site.progress = progress;
    
    // Auto-complete site if progress reaches 100%
    if (progress === 100 && site.status !== 'completed') {
      site.status = 'completed';
      site.actualEndDate = new Date();
    }
    
    await site.save();
    
    res.json({
      success: true,
      message: 'Site progress updated successfully',
      data: {
        siteId: site._id,
        progress: site.progress,
        status: site.status
      }
    });
    
  } catch (error) {
    console.error('Update site progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update site progress'
    });
  }
});

// Assign staff to site
router.post('/:id/assign-staff', authenticateToken, requirePermission('site.update'), async (req, res) => {
  try {
    const { userId, role } = req.body;
    
    const site = await Site.findById(req.params.id);
    
    if (!site) {
      return res.status(404).json({
        success: false,
        message: 'Site not found'
      });
    }
    
    // Check if user is already assigned
    const isAlreadyAssigned = site.assignedStaff.some(
      staff => staff.user.toString() === userId
    );
    
    if (isAlreadyAssigned) {
      return res.status(400).json({
        success: false,
        message: 'User is already assigned to this site'
      });
    }
    
    site.assignedStaff.push({
      user: userId,
      role: role || 'worker',
      assignedDate: new Date()
    });
    
    await site.save();
    await site.populate('assignedStaff.user', 'firstName lastName email');
    
    res.json({
      success: true,
      message: 'Staff assigned successfully',
      data: { site }
    });
    
  } catch (error) {
    console.error('Assign staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign staff'
    });
  }
});

// Delete site (soft delete)
router.delete('/:id', authenticateToken, requirePermission('site.delete'), async (req, res) => {
  try {
    const site = await Site.findById(req.params.id);
    
    if (!site) {
      return res.status(404).json({
        success: false,
        message: 'Site not found'
      });
    }
    
    site.isActive = false;
    await site.save();
    
    res.json({
      success: true,
      message: 'Site deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete site error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete site'
    });
  }
});

module.exports = router;