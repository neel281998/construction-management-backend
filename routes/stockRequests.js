const express = require('express');
const router = express.Router();
const StockRequest = require('../models/StockRequest');
const Site = require('../models/Site');
const Step = require('../models/Step');
const { authenticateToken, requirePermission, requireAdmin } = require('../middleware/auth');

// @route   GET /api/stock-requests
// @desc    Get all stock requests with optional filtering
// @access  Private (Admin, Inventory Manager, Step Manager)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      siteId,
      stepId,
      status,
      requestedBy,
      page = 1, 
      limit = 10,
      search
    } = req.query;

    // Build filter object
    const filter = { isActive: true };
    
    if (siteId) filter.siteId = siteId;
    if (stepId) filter.stepId = stepId;
    if (status) filter.status = status;
    if (requestedBy) filter.requestedBy = requestedBy;
    if (search) {
      filter.$or = [
        { requestNumber: new RegExp(search, 'i') },
        { notes: new RegExp(search, 'i') }
      ];
    }

    // Check user permissions
    if (req.user.role === 'step_manager') {
      // Step managers can only see their own requests
      filter.requestedBy = req.user._id;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [requests, totalCount] = await Promise.all([
      StockRequest.find(filter)
        .populate('siteId', 'name siteType status')
        .populate('stepId', 'stepNumber stepName stepType')
        .populate('requestedBy', 'firstName lastName email role')
        .populate('approvedBy', 'firstName lastName email')
        .populate('fulfilledBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      StockRequest.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + requests.length < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching stock requests:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// @route   GET /api/stock-requests/:id
// @desc    Get single stock request
// @access  Private (Admin, Inventory Manager, Step Manager)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const request = await StockRequest.findById(req.params.id)
      .populate('siteId', 'name siteType status address')
      .populate('stepId', 'stepNumber stepName stepType')
      .populate('requestedBy', 'firstName lastName email role')
      .populate('approvedBy', 'firstName lastName email')
      .populate('fulfilledBy', 'firstName lastName email')
      .populate('preferredStorageYard', 'name code type address');
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Stock request not found'
      });
    }

    // Check permissions
    if (req.user.role === 'step_manager' && request.requestedBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this request'
      });
    }
    
    res.json({
      success: true,
      data: { request }
    });
  } catch (error) {
    console.error('Error fetching stock request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/stock-requests
// @desc    Create new stock request
// @access  Private (Step Manager)
router.post('/', authenticateToken, async (req, res) => {
  try {
    // Check if user is step manager
    if (req.user.role !== 'step_manager') {
      return res.status(403).json({
        success: false,
        message: 'Only step managers can create stock requests'
      });
    }

    const { siteId, stepId, requestedItems, preferredStorageYard, notes, expectedDeliveryDate } = req.body;

    // Validate required fields
    if (!siteId || !stepId || !requestedItems || requestedItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Site, step, and requested items are required'
      });
    }

    // Verify site and step exist and user has access
    const site = await Site.findById(siteId);
    const step = await Step.findById(stepId);
    
    if (!site || !step) {
      return res.status(404).json({
        success: false,
        message: 'Site or step not found'
      });
    }

    if (step.siteId.toString() !== siteId) {
      return res.status(400).json({
        success: false,
        message: 'Step does not belong to the specified site'
      });
    }

    const request = new StockRequest({
      siteId,
      stepId,
      requestedBy: req.user._id,
      requestedItems,
      preferredStorageYard,
      notes,
      expectedDeliveryDate
    });

    await request.save();
    
    // Populate the response
    await request.populate([
      { path: 'siteId', select: 'name siteType status' },
      { path: 'stepId', select: 'stepNumber stepName stepType' },
      { path: 'requestedBy', select: 'firstName lastName email role' },
      { path: 'preferredStorageYard', select: 'name code type address' }
    ]);
    
    res.status(201).json({
      success: true,
      message: 'Stock request created successfully',
      data: { request }
    });
  } catch (error) {
    console.error('Error creating stock request:', error);
    
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
      message: 'Server error'
    });
  }
});

// @route   PUT /api/stock-requests/:id/approve
// @desc    Approve stock request
// @access  Private (Admin, Inventory Manager)
router.put('/:id/approve', authenticateToken, async (req, res) => {
  try {
    // Check if user can approve requests
    if (!['admin', 'inventory_manager'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin or inventory manager role required.'
      });
    }

    const { notes } = req.body;
    const request = await StockRequest.findById(req.params.id);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Stock request not found'
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending requests can be approved'
      });
    }

    await request.approve(req.user._id, notes);
    
    res.json({
      success: true,
      message: 'Stock request approved successfully',
      data: { request }
    });
  } catch (error) {
    console.error('Error approving stock request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/stock-requests/:id/reject
// @desc    Reject stock request
// @access  Private (Admin, Inventory Manager)
router.put('/:id/reject', authenticateToken, async (req, res) => {
  try {
    // Check if user can reject requests
    if (!['admin', 'inventory_manager'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin or inventory manager role required.'
      });
    }

    const { reason } = req.body;
    const request = await StockRequest.findById(req.params.id);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Stock request not found'
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending requests can be rejected'
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    await request.reject(req.user._id, reason);
    
    res.json({
      success: true,
      message: 'Stock request rejected successfully',
      data: { request }
    });
  } catch (error) {
    console.error('Error rejecting stock request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/stock-requests/:id/fulfill
// @desc    Fulfill stock request
// @access  Private (Admin, Inventory Manager)
router.put('/:id/fulfill', authenticateToken, async (req, res) => {
  try {
    // Check if user can fulfill requests
    if (!['admin', 'inventory_manager'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin or inventory manager role required.'
      });
    }

    const { fulfillmentDetails } = req.body;
    const request = await StockRequest.findById(req.params.id);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Stock request not found'
      });
    }

    if (request.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Only approved requests can be fulfilled'
      });
    }

    if (!fulfillmentDetails || fulfillmentDetails.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Fulfillment details are required'
      });
    }

    await request.fulfill(req.user._id, fulfillmentDetails);
    
    res.json({
      success: true,
      message: 'Stock request fulfilled successfully',
      data: { request }
    });
  } catch (error) {
    console.error('Error fulfilling stock request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/stock-requests/:id/cancel
// @desc    Cancel stock request
// @access  Private (Step Manager - own requests only)
router.put('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const request = await StockRequest.findById(req.params.id);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Stock request not found'
      });
    }

    // Check if user can cancel this request
    if (req.user.role === 'step_manager' && request.requestedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only cancel your own requests.'
      });
    }

    if (!['pending', 'approved'].includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only pending or approved requests can be cancelled'
      });
    }

    request.status = 'cancelled';
    await request.save();
    
    res.json({
      success: true,
      message: 'Stock request cancelled successfully',
      data: { request }
    });
  } catch (error) {
    console.error('Error cancelling stock request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/stock-requests/stats/overview
// @desc    Get stock request statistics
// @access  Private (Admin, Inventory Manager)
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    // Check if user can view stats
    if (!['admin', 'inventory_manager'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin or inventory manager role required.'
      });
    }

    const [
      totalRequests,
      pendingRequests,
      approvedRequests,
      fulfilledRequests,
      rejectedRequests
    ] = await Promise.all([
      StockRequest.countDocuments({ isActive: true }),
      StockRequest.countDocuments({ isActive: true, status: 'pending' }),
      StockRequest.countDocuments({ isActive: true, status: 'approved' }),
      StockRequest.countDocuments({ isActive: true, status: 'fulfilled' }),
      StockRequest.countDocuments({ isActive: true, status: 'rejected' })
    ]);

    res.json({
      success: true,
      data: {
        totalRequests,
        pendingRequests,
        approvedRequests,
        fulfilledRequests,
        rejectedRequests
      }
    });
  } catch (error) {
    console.error('Error fetching stock request stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
