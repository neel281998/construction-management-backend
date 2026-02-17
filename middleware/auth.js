const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token - user not found'
      });
    }
    
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }
    
    // Ensure permissions array exists and is populated
    // Only auto-populate if user doesn't have custom permissions
    if ((!user.permissions || user.permissions.length === 0) && !user.hasCustomPermissions) {
      // If no permissions and not custom, trigger save to populate from role (this will set permissions via pre-save hook)
      await user.save();
      // Reload to get fresh permissions
      const refreshedUser = await User.findById(decoded.userId).select('-password');
      req.user = refreshedUser;
    } else {
      // Ensure permissions is an array (defensive check)
      if (!Array.isArray(user.permissions)) {
        user.permissions = [];
      }
      req.user = user;
    }
    // Logging removed for performance - only log errors
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired'
      });
    }
    
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

// Check if user has required permission
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Admin bypasses all permission checks; supervisor bypasses except delete
    const role = (req.user.role || '').toLowerCase();
    if (role === 'admin') {
      return next();
    }
    if (role === 'supervisor' && !permission.endsWith('.delete')) {
      return next();
    }
    
    // Ensure permissions is an array
    const userPermissions = Array.isArray(req.user.permissions) ? req.user.permissions : [];
    
    if (!userPermissions.includes(permission)) {
      console.error(`Permission check failed for user ${req.user._id} (${req.user.email}):`, {
        role: req.user.role,
        requiredPermission: permission,
        userPermissions: userPermissions,
        hasCustomPermissions: req.user.hasCustomPermissions
      });
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }
    
    next();
  };
};

// Check if user has any of the required roles
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const userRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!userRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - insufficient role'
      });
    }
    
    next();
  };
};

// Check if user is admin
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

// Check if user is admin or supervisor (for user management etc.; delete stays admin-only)
const requireAdminOrSupervisor = (req, res, next) => {
  if (!req.user || !['admin', 'supervisor'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Admin or supervisor access required'
    });
  }
  next();
};

// Check if user can access site
const canAccessSite = async (req, res, next) => {
  try {
    const siteId = req.params.siteId || req.body.siteId;
    
    if (!siteId) {
      return res.status(400).json({
        success: false,
        message: 'Site ID is required'
      });
    }
    
    // Admin and supervisor can access all sites
    if (['admin', 'supervisor'].includes(req.user.role)) {
      return next();
    }
    
    // Check if user is assigned to this site
    const isAssigned = req.user.assignedSites.some(site => 
      site.toString() === siteId.toString()
    );
    
    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - not assigned to this site'
      });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking site access'
    });
  }
};

// Check if user can access storage site
const canAccessStorageSite = async (req, res, next) => {
  try {
    const storageSiteId = req.params.storageSiteId || req.body.storageSiteId;
    
    if (!storageSiteId) {
      return res.status(400).json({
        success: false,
        message: 'Storage site ID is required'
      });
    }
    
    // Admin and supervisor can access all storage sites
    if (['admin', 'supervisor'].includes(req.user.role)) {
      return next();
    }
    
    // Check if user is assigned to this storage site
    const isAssigned = req.user.assignedStorageSites && req.user.assignedStorageSites.some(site => 
      site.toString() === storageSiteId.toString()
    );
    
    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - not assigned to this storage site'
      });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking storage site access'
    });
  }
};

// Check if user can update a step (has site.update permission OR is assigned to step/site)
const canUpdateStep = (step, user) => {
  const role = (user.role || '').toLowerCase();
  if (role === 'admin' || role === 'supervisor') return true;
  const perms = Array.isArray(user.permissions) ? user.permissions : [];
  if (perms.includes('site.update')) return true;
  const siteId = step.siteId && step.siteId.toString();
  const assignedSites = Array.isArray(user.assignedSites) ? user.assignedSites : [];
  if (siteId && assignedSites.some(s => s.toString() === siteId)) return true;
  const userId = user._id && user._id.toString();
  if (userId && step.assignedUser && step.assignedUser.toString() === userId) return true;
  const assigned = step.assignedUsers || [];
  if (userId && assigned.some(a => a.user && a.user.toString() === userId)) return true;
  return false;
};

// Allow step update if user has site.update OR is assigned to step/site
const requireStepUpdateAccess = async (req, res, next) => {
  try {
    const Step = require('../models/Step');
    const step = await Step.findById(req.params.id);
    if (!step) {
      return res.status(404).json({ success: false, message: 'Step not found' });
    }
    if (!canUpdateStep(step, req.user)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    req.step = step;
    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error checking step access' });
  }
};

// Same check when stepId comes from body (e.g. POST /receipts, POST /consumption)
const requireStepUpdateAccessFromBody = async (req, res, next) => {
  try {
    const stepId = req.body && req.body.stepId;
    if (!stepId) {
      return res.status(400).json({ success: false, message: 'Step ID is required' });
    }
    const Step = require('../models/Step');
    const step = await Step.findById(stepId);
    if (!step) {
      return res.status(404).json({ success: false, message: 'Step not found' });
    }
    if (!canUpdateStep(step, req.user)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    req.step = step;
    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error checking step access' });
  }
};

// Load step from receipt param (receiptId) and allow if user can update that step
const requireStepUpdateAccessFromReceipt = async (req, res, next) => {
  try {
    const receiptId = req.params.receiptId || req.params.id;
    if (!receiptId) {
      return res.status(400).json({ success: false, message: 'Receipt ID is required' });
    }
    const StepInventoryReceipt = require('../models/StepInventoryReceipt');
    const Step = require('../models/Step');
    const receipt = await StepInventoryReceipt.findById(receiptId).select('stepId');
    if (!receipt || !receipt.stepId) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }
    const step = await Step.findById(receipt.stepId);
    if (!step) {
      return res.status(404).json({ success: false, message: 'Step not found' });
    }
    if (!canUpdateStep(step, req.user)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    req.step = step;
    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error checking step access' });
  }
};

// Load step from consumption param (id) and allow if user can update that step
const requireStepUpdateAccessFromConsumption = async (req, res, next) => {
  try {
    const consumptionId = req.params.id;
    if (!consumptionId) {
      return res.status(400).json({ success: false, message: 'Consumption ID is required' });
    }
    const StepInventoryConsumption = require('../models/StepInventoryConsumption');
    const Step = require('../models/Step');
    const consumption = await StepInventoryConsumption.findById(consumptionId).select('stepId');
    if (!consumption || !consumption.stepId) {
      return res.status(404).json({ success: false, message: 'Consumption not found' });
    }
    const step = await Step.findById(consumption.stepId);
    if (!step) {
      return res.status(404).json({ success: false, message: 'Step not found' });
    }
    if (!canUpdateStep(step, req.user)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    req.step = step;
    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error checking step access' });
  }
};

// Allow plant inventory read: admin, supervisor, plant_inventory.read, or assigned to plants
const requirePlantInventoryRead = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  const role = (req.user.role || '').toLowerCase();
  const perms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
  const assignedPlants = req.user.assignedPlants || [];
  const ok = role === 'admin' || role === 'supervisor' || perms.includes('plant_inventory.read') || assignedPlants.length > 0;
  if (!ok) {
    return res.status(403).json({ success: false, message: 'Insufficient permissions to read plant inventory' });
  }
  next();
};

// Allow plant output read: admin, supervisor, plant_output.read, or assigned to plants
const requirePlantOutputRead = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  const role = (req.user.role || '').toLowerCase();
  const perms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
  const assignedPlants = req.user.assignedPlants || [];
  const ok = role === 'admin' || role === 'supervisor' || perms.includes('plant_output.read') || assignedPlants.length > 0;
  if (!ok) {
    return res.status(403).json({ success: false, message: 'Insufficient permissions to read plant output' });
  }
  next();
};

module.exports = {
  authenticateToken,
  requirePermission,
  requireRole,
  requireAdmin,
  requireAdminOrSupervisor,
  canAccessSite,
  canAccessStorageSite,
  requireStepUpdateAccess,
  requireStepUpdateAccessFromBody,
  requireStepUpdateAccessFromReceipt,
  requireStepUpdateAccessFromConsumption,
  requirePlantInventoryRead,
  requirePlantOutputRead
};