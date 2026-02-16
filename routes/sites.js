const express = require('express');
const Site = require('../models/Site');
const Step = require('../models/Step');
const { syncStepAssignmentsToSite } = require('../utils/siteAssignmentSync');
const SiteInventory = require('../models/SiteInventory');
const { authenticateToken, requirePermission, canAccessSite } = require('../middleware/auth');
const { logActivity, getActivityStyle } = require('../utils/activityLogger');
const { cacheMiddleware } = require('../middleware/cache');

const router = express.Router();

// Get all sites (with pagination and filtering)
// Cache for 30 seconds since this endpoint is called frequently but data changes moderately
router.get('/', authenticateToken, requirePermission('site.read'), cacheMiddleware(30000, (req) => {
  // Include query params in cache key for different filters
  return `/api/sites?${new URLSearchParams(req.query).toString()}`;
}), async (req, res) => {
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
    
    // Role-based filtering: admin sees all; supervisor sees assigned sites only; others filtered by siteManager/assignedStaff/assignedSites
    const role = (req.user.role || '').toLowerCase();
    if (role === 'admin') {
      // Admin sees all sites
    } else if (role === 'supervisor') {
      // Supervisor sees only assigned sites (or sites where they are siteManager/assignedStaff)
      const filterConditions = [
        { siteManager: req.user._id },
        { 'assignedStaff.user': req.user._id }
      ];
      if (req.user.assignedSites?.length) {
        filterConditions.push({ _id: { $in: req.user.assignedSites } });
      }
      query.$or = filterConditions;
    } else {
      const filterConditions = [
        { siteManager: req.user._id },
        { 'assignedStaff.user': req.user._id }
      ];
      if (req.user.assignedSites?.length) {
        filterConditions.push({ _id: { $in: req.user.assignedSites } });
      }
      query.$or = filterConditions;
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

    // OPTIMIZATION: Fetch all steps for all sites in a single query instead of N+1 queries
    const siteIds = sites.map(site => site._id);
    const allSteps = await Step.find({ 
      siteId: { $in: siteIds }, 
      isActive: true 
    }).select('siteId estimatedVolumeM3 progressM3 status').lean();

    // Group steps by siteId for O(1) lookup
    const stepsBySiteId = {};
    allSteps.forEach(step => {
      if (!stepsBySiteId[step.siteId]) {
        stepsBySiteId[step.siteId] = [];
      }
      stepsBySiteId[step.siteId].push(step);
    });

    // Calculate real-time progress for each site using the pre-fetched steps
    const sitesWithProgress = sites.map((site) => {
      try {
        const steps = stepsBySiteId[site._id.toString()] || [];
        
        if (steps.length === 0) {
          return {
            ...site.toObject(),
            progress: 0,
            totalProgressM3: 0,
            estimatedVolumeM3: site.estimatedVolumeM3 || 0,
            currentStep: 1
          };
        }

        // Calculate progress from step data (same logic as progress endpoint)
        const totalEstimatedM3 = steps.reduce((sum, step) => sum + (step.estimatedVolumeM3 || 0), 0);
        const totalProgressM3 = steps.reduce((sum, step) => sum + (step.progressM3 || 0), 0);
        const overallProgressPercentage = totalEstimatedM3 > 0 
          ? Math.round((totalProgressM3 / totalEstimatedM3) * 100) 
          : 0;
        
        // Find current step (first incomplete step)
        const currentStep = steps.findIndex(step => step.status !== 'completed') + 1;

        return {
          ...site.toObject(),
          progress: overallProgressPercentage,
          totalProgressM3,
          estimatedVolumeM3: totalEstimatedM3 || site.estimatedVolumeM3 || 0,
          currentStep: currentStep > 0 ? currentStep : steps.length
        };
      } catch (error) {
        console.error(`Error calculating progress for site ${site._id}:`, error);
        return {
          ...site.toObject(),
          progress: site.progress || 0,
          totalProgressM3: site.totalProgressM3 || 0,
          estimatedVolumeM3: site.estimatedVolumeM3 || 0,
          currentStep: site.currentStep || 1
        };
      }
    });
    
    res.json({
      success: true,
      data: {
        sites: sitesWithProgress,
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
    
    // Check access permissions: admin/supervisor full access; others need siteManager or assignedStaff
    const role = (req.user.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'supervisor' &&
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

// Get site with detailed progress and steps
router.get('/:id/progress', authenticateToken, requirePermission('site.read'), async (req, res) => {
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
    
    // Check access permissions: admin/supervisor full access; others need siteManager or assignedStaff
    const role = (req.user.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'supervisor' &&
        site.siteManager.toString() !== req.user._id.toString() &&
        !site.assignedStaff.some(staff => staff.user._id.toString() === req.user._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    // Get steps for the site
    const Step = require('../models/Step');
    const steps = await Step.find({ siteId: site._id, isActive: true })
      .sort({ stepNumber: 1 });
    
    // Calculate step-wise progress
    const stepProgress = steps.map(step => ({
      ...step.toObject(),
      progressPercentage: step.estimatedVolumeM3 > 0 
        ? Math.round((step.progressM3 / step.estimatedVolumeM3) * 100) 
        : 0,
      remainingVolumeM3: Math.max(0, step.estimatedVolumeM3 - step.progressM3)
    }));
    
    // Calculate overall progress
    const totalEstimatedM3 = steps.reduce((sum, step) => sum + step.estimatedVolumeM3, 0);
    const totalProgressM3 = steps.reduce((sum, step) => sum + step.progressM3, 0);
    const overallProgressPercentage = totalEstimatedM3 > 0 
      ? Math.round((totalProgressM3 / totalEstimatedM3) * 100) 
      : 0;
    
    // Find current step (first incomplete step)
    const currentStep = steps.findIndex(step => step.status !== 'completed') + 1;
    
    res.json({
      success: true,
      data: { 
        site,
        steps: stepProgress,
        progress: {
          totalEstimatedM3,
          totalProgressM3,
          overallProgressPercentage,
          currentStep: currentStep > 0 ? currentStep : steps.length
        }
      }
    });
    
  } catch (error) {
    console.error('Get site progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch site progress'
    });
  }
});

// Create new site
router.post('/', authenticateToken, requirePermission('site.create'), async (req, res) => {
  try {
        const {
      name, 
      siteType, 
      description, 
      address, 
      startDate, 
      expectedEndDate, 
      estimatedVolumeM3,
      siteManagerId,
      siteSupervisorIds,
      inventoryManagerId,
      assignedVehicleIds,
      projectDimensions,
      stepData
    } = req.body;
    
    // Validate site types (support both single and multiple)
    const validSiteTypes = ['BT_ROAD', 'CC_ROAD', 'BRIDGE', 'DRAINAGE'];
    let siteTypesArray = [];
    
    if (Array.isArray(siteType)) {
      // Multiple site types
      siteTypesArray = siteType;
    } else {
      // Single site type (backward compatibility)
      siteTypesArray = [siteType];
    }
    
    // Validate all site types
    const invalidTypes = siteTypesArray.filter(type => !validSiteTypes.includes(type));
    if (invalidTypes.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid site types: ${invalidTypes.join(', ')}`
      });
    }
    
    if (siteTypesArray.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one site type is required'
      });
    }
    
    // Managers now optional per request. Keep if provided; allow null.
    
    // Project dimensions are optional - use defaults if not provided
    const defaultDimensions = {
      length: 100,
      breadth: 50,
      height: 10,
      unit: 'm'
    };
    
    const finalProjectDimensions = projectDimensions && 
      projectDimensions.length && 
      projectDimensions.breadth && 
      projectDimensions.height ? {
        length: projectDimensions.length,
        breadth: projectDimensions.breadth,
        height: projectDimensions.height,
        unit: projectDimensions.unit || 'm'
      } : defaultDimensions;
    
    // Validate dimensions if provided
    if (projectDimensions && (projectDimensions.length <= 0 || projectDimensions.breadth <= 0 || projectDimensions.height <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'Project dimensions must be greater than 0'
      });
    }
    
    const supervisorIds = Array.isArray(siteSupervisorIds) ? siteSupervisorIds : (siteManagerId ? [siteManagerId] : []);
    const siteManagerPrimary = supervisorIds[0] || siteManagerId || null;
    const assignedStaffSupervisors = supervisorIds.map(id => ({
      user: id,
      assignedDate: new Date(),
      role: 'supervisor'
    }));

    const siteData = {
      name,
      siteTypes: siteTypesArray,
      siteType: siteTypesArray[0], // Keep first type for backward compatibility
      description,
      address,
      startDate,
      expectedEndDate,
      estimatedVolumeM3,
      siteManager: siteManagerPrimary,
      inventoryManager: inventoryManagerId || null,
      projectDimensions: finalProjectDimensions,
      assignedStaff: assignedStaffSupervisors,
      assignedVehicles: assignedVehicleIds ? assignedVehicleIds.map(vehicleId => ({
        vehicle: vehicleId,
        assignedDate: new Date()
      })) : []
    };

    const site = new Site(siteData);
    
    // Calculate project volume from dimensions
    const projectVolume = site.calculateProjectVolume();
    
    // Use calculated volume if estimatedVolumeM3 is not provided or is 0
    if (!estimatedVolumeM3 || estimatedVolumeM3 === 0) {
      site.estimatedVolumeM3 = projectVolume;
    }
    
    await site.save();

    // Sync supervisors to User.assignedSites so they can access the site
    const User = require('../models/User');
    for (const id of supervisorIds) {
      if (id) await User.findByIdAndUpdate(id, { $addToSet: { assignedSites: site._id } });
    }

    let steps = [];
    let postCreateWarning = null;

    try {
      // Update vehicle statuses to 'in_use' if vehicles are assigned
      if (assignedVehicleIds && assignedVehicleIds.length > 0) {
        const Vehicle = require('../models/Vehicle');
        await Vehicle.updateMany(
          { _id: { $in: assignedVehicleIds } },
          { status: 'in_use' }
        );
      }
      
      // Create steps for the site
      const { createStepsForSite } = require('../config/stepConfigurations');
      
      if (stepData && stepData.length > 0) {
        steps = await createStepsWithData(site._id, siteTypesArray, stepData, site.estimatedVolumeM3);
        // Extract user IDs from stepData: support assignedUsers (objects with .user or ._id) and assignedUserIds (raw ids)
        const allAssignedUserIds = [
          ...stepData.flatMap(s => (s.assignedUsers || []).map(u => {
            if (typeof u === 'object' && u != null) {
              if (u.user) return u.user; // step format { user: id }
              if (u._id) return u._id;     // frontend format { _id: string, ... }
            }
            return u; // already a string/id
          })),
          ...stepData.flatMap(s => (s.assignedUserIds || []))
        ].filter(Boolean).map(id => id && id.toString ? id.toString() : id);
        const uniqueIds = [...new Set(allAssignedUserIds)];
        if (uniqueIds.length) {
          await syncStepAssignmentsToSite(site._id, uniqueIds);
        }
        const totalStepVolume = stepData.reduce((sum, step) => sum + (step.estimatedVolumeM3 || 0), 0);
        if (totalStepVolume > 0) {
          site.estimatedVolumeM3 = totalStepVolume;
          await site.save();
        }
      } else {
        for (const siteType of siteTypesArray) {
          const typeSteps = await createStepsForSite(site._id, siteType);
          steps = steps.concat(typeSteps);
        }
      }
      
      await createSiteInventory(site._id, steps, req.user._id);
      const progressResult = await site.calculateOverallProgress();
      await site.save();
    } catch (postError) {
      console.error('Post-create setup error (site was saved):', postError);
      postCreateWarning = 'Site created. Some setup steps may need attention.';
    }
    
    // Populate the response
    await site.populate([
      { path: 'siteManager', select: 'firstName lastName email' },
      { path: 'inventoryManager', select: 'firstName lastName email' },
      { path: 'assignedVehicles.vehicle', select: 'vehicleNumber type brand model' }
    ]);
    
    // Log activity
    await logActivity({
      user: req.user,
      action: 'site_created',
      category: 'site',
      title: 'New Site Created',
      message: `${site.name} has been created`,
      entityType: 'site',
      entityId: site._id,
      entityName: site.name,
      metadata: {
        siteTypes: site.siteTypes,
        totalSteps: steps.length,
        estimatedVolume: site.estimatedVolumeM3
      },
      ...getActivityStyle('site_created'),
      req
    });
    
    res.status(201).json({
      success: true,
      message: postCreateWarning || 'Site created successfully with steps',
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

// Helper function to create steps for a site (legacy - now using stepConfigurations.js)
async function createStepsForSiteLegacy(siteId, siteType, totalVolumeM3) {
  try {
    const { getStepsForSiteType } = require('../config/siteTypes');
    const steps = getStepsForSiteType(siteType);
    
    const stepPromises = steps.map(stepConfig => {
      // Calculate proportional volume for each step
      const totalDefaultVolume = steps.reduce((sum, step) => sum + step.defaultVolumeM3, 0);
      const proportionalVolume = (stepConfig.defaultVolumeM3 / totalDefaultVolume) * totalVolumeM3;
      
      const newStep = new Step({
        siteId,
        stepNumber: stepConfig.stepNumber,
        stepName: stepConfig.stepName,
        primaryStock: stepConfig.primaryStock,
        secondaryStock: stepConfig.secondaryStock,
        estimatedVolumeM3: Math.round(proportionalVolume * 100) / 100, // Round to 2 decimal places
        status: 'pending'
      });
      
      return newStep.save();
    });
    
    const createdSteps = await Promise.all(stepPromises);
    return createdSteps;
  } catch (error) {
    console.error('Error creating steps for site:', error);
    throw error;
  }
}

// Helper function to create steps with provided data
async function createStepsWithData(siteId, siteTypes, stepDataArray, siteEstimatedVolume = 0) {
  try {
    const stepPromises = stepDataArray.map(stepData => {
      const newStep = new Step({
        siteId,
        stepNumber: stepData.stepNumber,
        stepName: stepData.stepName,
        stepType: stepData.stepType,
        primaryStock: stepData.primaryStock,
        secondaryStock: stepData.secondaryStock,
        estimatedVolumeM3: stepData.estimatedVolumeM3 || 0,
        estimatedDimensions: {
          length: stepData.estimatedDimensions?.length || 0,
          breadth: stepData.estimatedDimensions?.breadth || 0,
          height: stepData.estimatedDimensions?.height || 0,
          thickness: stepData.estimatedDimensions?.thickness || 0,
          count: stepData.estimatedDimensions?.count || 1,
          unit: stepData.estimatedDimensions?.unit || 'm',
          additionalFields: new Map()
        },
        completedDimensions: {
          length: 0,
          breadth: 0,
          height: 0,
          thickness: 0,
          count: 0,
          unit: stepData.estimatedDimensions?.unit || 'm',
          additionalFields: new Map()
        },
        volumeCalculations: {
          estimatedVolume: stepData.estimatedVolumeM3 || 0,
          completedVolume: 0,
          volumeUnit: 'm³'
        },
        // Assign users if provided (support both IDs and { _id } objects)
        assignedUsers: (stepData.assignedUserIds || stepData.assignedUsers || []).map(u => {
          const userId = typeof u === 'object' && u?._id ? u._id : u;
          return userId ? { user: userId, assignedDate: new Date(), role: 'worker', isActive: true } : null;
        }).filter(Boolean),
        // Store the site type this step belongs to
        siteType: stepData.siteType || siteTypes[0],
        status: 'pending'
      });
      
      return newStep.save();
    });
    
    const createdSteps = await Promise.all(stepPromises);
    return createdSteps;
  } catch (error) {
    console.error('Error creating steps with data:', error);
    throw error;
  }
}

// Helper function to create inventory items for a site
async function createSiteInventory(siteId, steps, userId) {
  try {
    const inventoryPromises = [];
    
    steps.forEach(step => {
      // Create primary stock inventory item
      if (step.primaryStock) {
        const primaryInventory = new SiteInventory({
          siteId,
          stepId: step._id,
          materialName: step.primaryStock,
          materialCategory: 'aggregates', // Default category for primary materials
          materialType: 'primary',
          quantity: step.estimatedVolumeM3,
          unit: 'm³',
          notes: `Primary material for ${step.stepName}`,
          addedBy: userId
        });
        inventoryPromises.push(primaryInventory.save());
      }
      
      // Create secondary stock inventory item
      if (step.secondaryStock) {
        const secondaryInventory = new SiteInventory({
          siteId,
          stepId: step._id,
          materialName: step.secondaryStock,
          materialCategory: 'cement_concrete', // Default category for secondary materials
          materialType: 'secondary',
          quantity: step.estimatedVolumeM3 * 0.3, // Secondary materials usually 30% of primary
          unit: 'm³',
          notes: `Secondary material for ${step.stepName}`,
          addedBy: userId
        });
        inventoryPromises.push(secondaryInventory.save());
      }
    });
    
    await Promise.all(inventoryPromises);
  } catch (error) {
    console.error('Error creating site inventory:', error);
    throw error;
  }
}

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
    
    // Check permissions: admin/supervisor full access; others need siteManager
    const role = (req.user.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'supervisor' && site.siteManager.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    const oldStatus = site.status;
    site.status = status;
    
    // Auto-set completion date if status is completed
    if (status === 'completed' && !site.actualEndDate) {
      site.actualEndDate = new Date();
    }
    
    await site.save();
    
    // Log activity
    await logActivity({
      user: req.user,
      action: 'site_status_changed',
      category: 'site',
      title: 'Site Status Changed',
      message: `${site.name} status changed from ${oldStatus} to ${status}`,
      entityType: 'site',
      entityId: site._id,
      entityName: site.name,
      metadata: {
        oldStatus,
        newStatus: status,
        completionDate: site.actualEndDate
      },
      ...getActivityStyle('site_status_changed'),
      req
    });
    
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
    
    // Check permissions: admin/supervisor or current site manager can change
    const role = (req.user.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'supervisor' && site.siteManager.toString() !== req.user._id.toString()) {
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
    
    // Check permissions: admin/supervisor or site manager or assigned staff
    const role = (req.user.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'supervisor') {
      const isManager = site.siteManager && site.siteManager.toString() === req.user._id.toString();
      const inStaff = site.assignedStaff && site.assignedStaff.some(s => s.user && (s.user._id || s.user).toString() === req.user._id.toString());
      if (!isManager && !inStaff) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    const { siteSupervisorIds, ...restBody } = req.body;
    Object.assign(site, restBody);

    if (siteSupervisorIds !== undefined) {
      const ids = Array.isArray(siteSupervisorIds) ? siteSupervisorIds : [];
      const existingNonSupervisors = (site.assignedStaff || []).filter(s => s.role !== 'supervisor');
      site.assignedStaff = [...existingNonSupervisors, ...ids.map(id => ({ user: id, assignedDate: new Date(), role: 'supervisor' }))];
      site.siteManager = ids[0] || null;
      const User = require('../models/User');
      for (const id of ids) {
        if (id) await User.findByIdAndUpdate(id, { $addToSet: { assignedSites: site._id } });
      }
    }

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
    
    const siteName = site.name;
    site.isActive = false;
    await site.save();
    
    // Log activity
    await logActivity({
      user: req.user,
      action: 'site_deleted',
      category: 'site',
      title: 'Site Deleted',
      message: `${siteName} has been deleted`,
      entityType: 'site',
      entityId: site._id,
      entityName: siteName,
      metadata: {
        siteType: site.siteType,
        status: site.status
      },
      ...getActivityStyle('site_deleted'),
      req
    });
    
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

// Get site progress with step details
router.get('/:id/progress', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const site = await Site.findById(req.params.id);
    if (!site) {
      return res.status(404).json({
        success: false,
        message: 'Site not found'
      });
    }
    
    // Check access permissions: admin/supervisor full access; others need siteManager or assignedStaff
    const role = (req.user.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'supervisor' &&
        site.siteManager.toString() !== req.user._id.toString() &&
        !site.assignedStaff.some(staff => staff.user && (staff.user._id || staff.user).toString() === req.user._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    // Get all steps for this site with detailed information
    const steps = await Step.find({ siteId: site._id, isActive: true })
      .populate('assignedUsers.user', 'firstName lastName email role')
      .sort({ stepNumber: 1 });
    
    // Calculate overall progress
    const totalEstimatedM3 = steps.reduce((sum, step) => sum + step.estimatedVolumeM3, 0);
    const totalProgressM3 = steps.reduce((sum, step) => sum + step.progressM3, 0);
    const overallProgressPercentage = totalEstimatedM3 > 0 
      ? Math.round((totalProgressM3 / totalEstimatedM3) * 100) 
      : 0;
    
    // Format step data for frontend
    const formattedSteps = steps.map(step => ({
      _id: step._id,
      stepNumber: step.stepNumber,
      stepName: step.stepName,
      stepType: step.stepType,
      siteType: step.siteType,
      primaryStock: step.primaryStock,
      secondaryStock: step.secondaryStock,
      status: step.status,
      estimatedVolumeM3: step.estimatedVolumeM3,
      progressM3: step.progressM3,
      progressPercentage: step.progressPercentage || 0,
      estimatedDimensions: step.estimatedDimensions,
      completedDimensions: step.completedDimensions,
      volumeCalculations: step.volumeCalculations,
      startDate: step.startDate,
      completedDate: step.completedDate,
      assignedUsers: step.assignedUsers,
      notes: step.notes
    }));
    
    res.json({
      success: true,
      data: {
        site: {
          _id: site._id,
          name: site.name,
          status: site.status,
          progress: site.progress,
          estimatedVolumeM3: site.estimatedVolumeM3,
          totalProgressM3: site.totalProgressM3
        },
        progress: {
          overallProgressPercentage,
          totalEstimatedM3,
          totalProgressM3,
          remainingM3: totalEstimatedM3 - totalProgressM3,
          completedSteps: steps.filter(s => s.status === 'completed').length,
          inProgressSteps: steps.filter(s => s.status === 'in_progress').length,
          pendingSteps: steps.filter(s => s.status === 'pending').length
        },
        steps: formattedSteps
      }
    });
    
  } catch (error) {
    console.error('Get site progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch site progress'
    });
  }
});

// Get progress analytics for a site
router.get('/:id/progress-analytics', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    const site = await Site.findById(req.params.id);
    if (!site) {
      return res.status(404).json({
        success: false,
        message: 'Site not found'
      });
    }
    
    // Check access permissions: admin/supervisor full access; others need siteManager or assignedStaff
    const role = (req.user.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'supervisor' &&
        site.siteManager.toString() !== req.user._id.toString() &&
        !site.assignedStaff.some(staff => staff.user && (staff.user._id || staff.user).toString() === req.user._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    const Step = require('../models/Step');
    const steps = await Step.find({ siteId: site._id, isActive: true })
      .sort({ stepNumber: 1 });
    
    // Calculate analytics data
    const totalSteps = steps.length;
    const completedSteps = steps.filter(step => step.status === 'completed').length;
    const inProgressSteps = steps.filter(step => step.status === 'in_progress').length;
    const pendingSteps = steps.filter(step => step.status === 'pending').length;
    
    const totalEstimatedM3 = steps.reduce((sum, step) => sum + step.estimatedVolumeM3, 0);
    const totalProgressM3 = steps.reduce((sum, step) => sum + step.progressM3, 0);
    const overallProgressPercentage = totalEstimatedM3 > 0 
      ? Math.round((totalProgressM3 / totalEstimatedM3) * 100) 
      : 0;
    
    // Calculate progress trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Get progress history (you might want to create a separate ProgressHistory model)
    const progressHistory = [
      { date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), progress: Math.max(0, overallProgressPercentage - 5) },
      { date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), progress: Math.max(0, overallProgressPercentage - 10) },
      { date: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000), progress: Math.max(0, overallProgressPercentage - 15) },
      { date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), progress: Math.max(0, overallProgressPercentage - 20) }
    ];
    
    // Calculate performance metrics
    const averageStepProgress = steps.length > 0 
      ? steps.reduce((sum, step) => sum + (step.progressPercentage || 0), 0) / steps.length 
      : 0;
    
    const fastestStep = steps.reduce((fastest, step) => 
      (step.progressPercentage || 0) > (fastest.progressPercentage || 0) ? step : fastest, 
      steps[0] || {}
    );
    
    const slowestStep = steps.reduce((slowest, step) => 
      (step.progressPercentage || 0) < (slowest.progressPercentage || 0) ? step : slowest, 
      steps[0] || {}
    );
    
    res.json({
      success: true,
      data: {
        overview: {
          totalSteps,
          completedSteps,
          inProgressSteps,
          pendingSteps,
          overallProgressPercentage,
          totalEstimatedM3,
          totalProgressM3,
          remainingM3: totalEstimatedM3 - totalProgressM3
        },
        performance: {
          averageStepProgress: Math.round(averageStepProgress),
          fastestStep: fastestStep ? {
            name: fastestStep.stepName,
            progress: fastestStep.progressPercentage || 0
          } : null,
          slowestStep: slowestStep ? {
            name: slowestStep.stepName,
            progress: slowestStep.progressPercentage || 0
          } : null
        },
        trends: {
          progressHistory,
          dailyProgressRate: overallProgressPercentage / 30, // Approximate daily rate
          estimatedCompletion: overallProgressPercentage > 0 
            ? new Date(Date.now() + ((100 - overallProgressPercentage) / (overallProgressPercentage / 30)) * 24 * 60 * 60 * 1000)
            : null
        }
      }
    });
    
  } catch (error) {
    console.error('Get progress analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch progress analytics'
    });
  }
});

// Get progress milestones for a site
router.get('/:id/milestones', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const site = await Site.findById(req.params.id);
    if (!site) {
      return res.status(404).json({
        success: false,
        message: 'Site not found'
      });
    }
    
    // Check access permissions: admin/supervisor full access; others need siteManager or assignedStaff
    const role = (req.user.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'supervisor' &&
        site.siteManager.toString() !== req.user._id.toString() &&
        !site.assignedStaff.some(staff => staff.user && (staff.user._id || staff.user).toString() === req.user._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    const Step = require('../models/Step');
    const steps = await Step.find({ siteId: site._id, isActive: true })
      .sort({ stepNumber: 1 });
    
    // Generate milestones based on steps
    const milestones = steps.map((step, index) => ({
      id: step._id,
      name: step.stepName,
      description: `Complete ${step.stepName}`,
      targetDate: new Date(site.startDate.getTime() + (index + 1) * (site.expectedEndDate.getTime() - site.startDate.getTime()) / steps.length),
      completedDate: step.completedDate || null,
      isCompleted: step.status === 'completed',
      progress: step.progressPercentage || 0,
      stepNumber: step.stepNumber
    }));
    
    res.json({
      success: true,
      data: {
        milestones,
        totalMilestones: milestones.length,
        completedMilestones: milestones.filter(m => m.isCompleted).length,
        upcomingMilestones: milestones.filter(m => !m.isCompleted && new Date(m.targetDate) > new Date()).slice(0, 3)
      }
    });
    
  } catch (error) {
    console.error('Get milestones error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch milestones'
    });
  }
});

// Get progress alerts for a site
router.get('/:id/progress-alerts', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const site = await Site.findById(req.params.id);
    if (!site) {
      return res.status(404).json({
        success: false,
        message: 'Site not found'
      });
    }
    
    // Check access permissions: admin/supervisor full access; others need siteManager or assignedStaff
    const role = (req.user.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'supervisor' &&
        site.siteManager.toString() !== req.user._id.toString() &&
        !site.assignedStaff.some(staff => staff.user && (staff.user._id || staff.user).toString() === req.user._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    const Step = require('../models/Step');
    const steps = await Step.find({ siteId: site._id, isActive: true })
      .sort({ stepNumber: 1 });
    
    const alerts = [];
    const currentDate = new Date();
    
    // Check for delayed progress
    const delayedSteps = steps.filter(step => {
      if (step.status === 'completed') return false;
      
      // Calculate expected progress based on time elapsed
      const daysElapsed = Math.floor((currentDate - site.startDate) / (1000 * 60 * 60 * 24));
      const totalDays = Math.floor((site.expectedEndDate - site.startDate) / (1000 * 60 * 60 * 24));
      const expectedProgress = Math.min(100, (daysElapsed / totalDays) * 100);
      
      return (step.progressPercentage || 0) < expectedProgress - 10; // 10% tolerance
    });
    
    delayedSteps.forEach(step => {
      alerts.push({
        id: `delayed_${step._id}`,
        type: 'delayed_progress',
        severity: 'warning',
        title: 'Delayed Progress',
        message: `Step "${step.stepName}" is behind schedule`,
        stepId: step._id,
        stepName: step.stepName,
        currentProgress: step.progressPercentage || 0,
        createdAt: new Date()
      });
    });
    
    // Check for completed milestones
    const completedSteps = steps.filter(step => step.status === 'completed');
    completedSteps.forEach(step => {
      alerts.push({
        id: `completed_${step._id}`,
        type: 'milestone_completed',
        severity: 'success',
        title: 'Milestone Completed',
        message: `Step "${step.stepName}" has been completed`,
        stepId: step._id,
        stepName: step.stepName,
        completedDate: step.completedDate,
        createdAt: step.completedDate || new Date()
      });
    });
    
    // Check for upcoming deadlines
    const upcomingDeadlines = steps.filter(step => {
      if (step.status === 'completed') return false;
      
      const daysUntilDeadline = Math.floor((site.expectedEndDate - currentDate) / (1000 * 60 * 60 * 24));
      return daysUntilDeadline <= 7 && daysUntilDeadline > 0;
    });
    
    upcomingDeadlines.forEach(step => {
      alerts.push({
        id: `deadline_${step._id}`,
        type: 'upcoming_deadline',
        severity: 'info',
        title: 'Upcoming Deadline',
        message: `Step "${step.stepName}" deadline is approaching`,
        stepId: step._id,
        stepName: step.stepName,
        daysUntilDeadline: Math.floor((site.expectedEndDate - currentDate) / (1000 * 60 * 60 * 24)),
        createdAt: new Date()
      });
    });
    
    // Check for low inventory
    const SiteInventory = require('../models/SiteInventory');
    const siteInventory = await SiteInventory.find({ siteId: site._id });
    
    const lowInventoryItems = siteInventory.filter(item => {
      const consumptionPercentage = item.quantity > 0 
        ? ((item.consumedQuantity || 0) / item.quantity) * 100 
        : 0;
      return consumptionPercentage > 80; // 80% consumed
    });
    
    lowInventoryItems.forEach(item => {
      alerts.push({
        id: `low_inventory_${item._id}`,
        type: 'low_inventory',
        severity: 'warning',
        title: 'Low Inventory',
        message: `Low stock for "${item.materialName}"`,
        itemId: item._id,
        itemName: item.materialName,
        remainingQuantity: item.quantity - (item.consumedQuantity || 0),
        consumptionPercentage: Math.round(((item.consumedQuantity || 0) / item.quantity) * 100),
        createdAt: new Date()
      });
    });
    
    // Sort alerts by severity and date
    const severityOrder = { error: 0, warning: 1, info: 2, success: 3 };
    alerts.sort((a, b) => {
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    res.json({
      success: true,
      data: {
        alerts,
        totalAlerts: alerts.length,
        criticalAlerts: alerts.filter(a => a.severity === 'error').length,
        warningAlerts: alerts.filter(a => a.severity === 'warning').length,
        infoAlerts: alerts.filter(a => a.severity === 'info').length,
        successAlerts: alerts.filter(a => a.severity === 'success').length
      }
    });
    
  } catch (error) {
    console.error('Get progress alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch progress alerts'
    });
  }
});

// Recalculate site progress based on step progress
router.post('/:id/recalculate-progress', authenticateToken, requirePermission('site.update'), async (req, res) => {
  try {
    const site = await Site.findById(req.params.id);
    
    if (!site) {
      return res.status(404).json({
        success: false,
        message: 'Site not found'
      });
    }
    
    // Check access permissions: admin/supervisor full access; others need siteManager or assignedStaff
    const role = (req.user.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'supervisor' &&
        site.siteManager.toString() !== req.user._id.toString() &&
        !site.assignedStaff.some(staff => staff.user && (staff.user._id || staff.user).toString() === req.user._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    // Get all steps for this site
    const Step = require('../models/Step');
    const steps = await Step.find({ siteId: site._id, isActive: true });
    
    // Check if steps have 0 volume and fix them
    const stepsWithZeroVolume = steps.filter(step => step.estimatedVolumeM3 === 0);
    if (stepsWithZeroVolume.length > 0 && site.estimatedVolumeM3 > 0) {
      const volumePerStep = site.estimatedVolumeM3 / steps.length;
      
      for (const step of stepsWithZeroVolume) {
        step.estimatedVolumeM3 = volumePerStep;
        step.volumeCalculations.estimatedVolume = volumePerStep;
        await step.save();
      }
    }
    
    // Calculate overall progress
    const progressResult = await site.calculateOverallProgress();
    await site.save();
    
    res.json({
      success: true,
      message: 'Site progress recalculated successfully',
      data: {
        site: {
          _id: site._id,
          name: site.name,
          progress: progressResult.progress,
          totalProgressM3: progressResult.totalProgressM3,
          estimatedVolumeM3: progressResult.estimatedVolumeM3
        },
        fixedSteps: stepsWithZeroVolume.length
      }
    });
    
  } catch (error) {
    console.error('Recalculate progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to recalculate site progress'
    });
  }
});

// Get site types
router.get('/site-types', authenticateToken, async (req, res) => {
  try {
    const { getSiteTypes } = require('../config/siteTypes');
    const siteTypes = getSiteTypes();
    
    res.json({
      success: true,
      data: { siteTypes }
    });
  } catch (error) {
    console.error('Error fetching site types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch site types'
    });
  }
});

// Get site type configuration
router.get('/site-types/:siteType', authenticateToken, async (req, res) => {
  try {
    const { siteType } = req.params;
    const { getSiteTypeConfig } = require('../config/siteTypes');
    const config = getSiteTypeConfig(siteType);
    
    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Site type not found'
      });
    }
    
    res.json({
      success: true,
      data: { config }
    });
  } catch (error) {
    console.error('Error fetching site type config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch site type configuration'
    });
  }
});

// Get step configurations for a site type (public endpoint - no auth required)
router.get('/step-configurations/:siteType', async (req, res) => {
  try {
    const { siteType } = req.params;
    const { stepConfigurations } = require('../config/stepConfigurations');
    const config = stepConfigurations[siteType];
    
    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Step configurations not found for this site type'
      });
    }
    
    res.json({
      success: true,
      data: { stepConfigurations: config }
    });
  } catch (error) {
    console.error('Error fetching step configurations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch step configurations'
    });
  }
});

module.exports = router;