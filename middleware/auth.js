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
    
    req.user = user;
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
    
    if (!req.user.permissions.includes(permission)) {
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
    
    // Admin can access all sites
    if (req.user.role === 'admin') {
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
    const storageSiteId = req.params.storageSiteId || req.params.id || req.body.storageSiteId || req.body.storageSite;
    
    if (!storageSiteId) {
      return res.status(400).json({
        success: false,
        message: 'Storage site ID is required'
      });
    }
    
    // Admin can access all storage sites
    if (req.user.role === 'admin') {
      return next();
    }
    
    // Check if user is assigned to this storage site
    const isAssigned = req.user.assignedStorageSites.some(site => 
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

// Check if user can access inventory item (based on storage site)
const canAccessInventoryItem = async (req, res, next) => {
  try {
    const itemId = req.params.id || req.params.itemId;
    
    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: 'Inventory item ID is required'
      });
    }
    
    // Admin can access all inventory items
    if (req.user.role === 'admin') {
      return next();
    }
    
    // For inventory managers and assistants, check if they have access to the storage site
    if (['inventory_manager', 'inventory_assistant'].includes(req.user.role)) {
      const Inventory = require('../models/Inventory');
      const item = await Inventory.findById(itemId).select('storageSite');
      
      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Inventory item not found'
        });
      }
      
      const isAssigned = req.user.assignedStorageSites.some(site => 
        site.toString() === item.storageSite.toString()
      );
      
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - not assigned to this storage site'
        });
      }
    }
    
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking inventory item access'
    });
  }
};

// Check if user can perform inventory operations on storage site
const canManageStorageSiteInventory = async (req, res, next) => {
  try {
    const storageSiteId = req.params.storageSiteId || req.body.storageSite || req.body.storageSiteId;
    
    if (!storageSiteId) {
      return res.status(400).json({
        success: false,
        message: 'Storage site ID is required'
      });
    }
    
    // Admin can manage all storage sites
    if (req.user.role === 'admin') {
      return next();
    }
    
    // Only inventory managers and assistants can manage inventory
    if (!['inventory_manager', 'inventory_assistant'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - inventory management role required'
      });
    }
    
    // Check if user is assigned to this storage site
    const isAssigned = req.user.assignedStorageSites.some(site => 
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
      message: 'Error checking storage site inventory access'
    });
  }
};

module.exports = {
  authenticateToken,
  requirePermission,
  requireRole,
  requireAdmin,
  canAccessSite,
  canAccessStorageSite,
  canAccessInventoryItem,
  canManageStorageSiteInventory
};