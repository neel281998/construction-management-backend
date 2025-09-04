const express = require('express');
const Vehicle = require('../models/Vehicle');
const { authenticateToken, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get all vehicles
router.get('/', authenticateToken, requirePermission('vehicle.read'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      type,
      assignedSite,
      search
    } = req.query;
    
    // Build query
    let query = { isActive: true };
    
    // Apply filters
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (type && type !== 'all') {
      query.type = type;
    }
    
    if (assignedSite) {
      query.assignedSite = assignedSite;
    }
    
    if (search) {
      query.$or = [
        { vehicleNumber: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [vehicles, totalCount] = await Promise.all([
      Vehicle.find(query)
        .populate('assignedTo', 'firstName lastName')
        .populate('assignedSite', 'name status')
        .sort({ vehicleNumber: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Vehicle.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: {
        vehicles,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + vehicles.length < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });
    
  } catch (error) {
    console.error('Get vehicles error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicles'
    });
  }
});

// Get vehicles requiring maintenance (specific route before /:id)
router.get('/maintenance/due', authenticateToken, requirePermission('vehicle.read'), async (req, res) => {
  try {
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const vehicles = await Vehicle.find({
      isActive: true,
      'maintenanceSchedule.nextService': { $lte: nextWeek }
    })
    .populate('assignedTo', 'firstName lastName')
    .populate('assignedSite', 'name')
    .sort({ 'maintenanceSchedule.nextService': 1 });
    
    res.json({
      success: true,
      data: { vehicles }
    });
    
  } catch (error) {
    console.error('Get maintenance due vehicles error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicles due for maintenance'
    });
  }
});

// Get single vehicle
router.get('/:id', authenticateToken, requirePermission('vehicle.read'), async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id)
      .populate('assignedTo', 'firstName lastName email phone')
      .populate('assignedSite', 'name status address');
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }
    
    res.json({
      success: true,
      data: { vehicle }
    });
    
  } catch (error) {
    console.error('Get vehicle error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicle'
    });
  }
});

// Create new vehicle
router.post('/', authenticateToken, requirePermission('vehicle.create'), async (req, res) => {
  try {
    const vehicle = new Vehicle(req.body);
    await vehicle.save();
    
    res.status(201).json({
      success: true,
      message: 'Vehicle created successfully',
      data: { vehicle }
    });
    
  } catch (error) {
    console.error('Create vehicle error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle number already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create vehicle'
    });
  }
});

// Update vehicle location (specific route before general /:id)
router.put('/:id/location', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude, address } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }
    
    const vehicle = await Vehicle.findById(req.params.id);
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }
    
    // Check if user can update this vehicle
    if (req.user.role !== 'admin' && 
        vehicle.assignedTo && 
        vehicle.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    vehicle.currentLocation = {
      latitude,
      longitude,
      address: address || vehicle.currentLocation.address,
      lastUpdated: new Date()
    };
    
    await vehicle.save();
    
    res.json({
      success: true,
      message: 'Vehicle location updated successfully',
      data: {
        vehicleId: vehicle._id,
        location: vehicle.currentLocation
      }
    });
    
  } catch (error) {
    console.error('Update vehicle location error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update vehicle location'
    });
  }
});

// Update vehicle fuel level (specific route before general /:id)
router.put('/:id/fuel', authenticateToken, async (req, res) => {
  try {
    const { fuelLevel } = req.body;
    
    if (fuelLevel < 0 || fuelLevel > 100) {
      return res.status(400).json({
        success: false,
        message: 'Fuel level must be between 0 and 100'
      });
    }
    
    const vehicle = await Vehicle.findById(req.params.id);
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }
    
    vehicle.fuelLevel = fuelLevel;
    await vehicle.save();
    
    res.json({
      success: true,
      message: 'Fuel level updated successfully',
      data: {
        vehicleId: vehicle._id,
        fuelLevel: vehicle.fuelLevel,
        fuelStatus: vehicle.fuelStatus
      }
    });
    
  } catch (error) {
    console.error('Update fuel level error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update fuel level'
    });
  }
});

// Assign vehicle to site (specific route before general /:id)
router.put('/:id/assign', authenticateToken, requirePermission('vehicle.update'), async (req, res) => {
  try {
    const { siteId, userId } = req.body;
    
    const vehicle = await Vehicle.findById(req.params.id);
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }
    
    if (vehicle.status === 'maintenance' || vehicle.status === 'out_of_service') {
      return res.status(400).json({
        success: false,
        message: 'Cannot assign vehicle that is in maintenance or out of service'
      });
    }
    
    vehicle.assignedSite = siteId || null;
    vehicle.assignedTo = userId || null;
    vehicle.status = siteId ? 'in_use' : 'available';
    
    await vehicle.save();
    await vehicle.populate(['assignedTo', 'assignedSite']);
    
    res.json({
      success: true,
      message: 'Vehicle assignment updated successfully',
      data: { vehicle }
    });
    
  } catch (error) {
    console.error('Assign vehicle error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign vehicle'
    });
  }
});

// Update vehicle status (specific route before general /:id)
router.put('/:id/status', authenticateToken, requirePermission('vehicle.update'), async (req, res) => {
  try {
    const { status } = req.body;
    
    const vehicle = await Vehicle.findById(req.params.id);
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }
    
    vehicle.status = status;
    
    // Clear assignments if vehicle is not available or in use
    if (status === 'maintenance' || status === 'out_of_service') {
      vehicle.assignedSite = null;
      vehicle.assignedTo = null;
    }
    
    await vehicle.save();
    
    res.json({
      success: true,
      message: 'Vehicle status updated successfully',
      data: {
        vehicleId: vehicle._id,
        status: vehicle.status
      }
    });
    
  } catch (error) {
    console.error('Update vehicle status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update vehicle status'
    });
  }
});

// Update vehicle (general route - must come after specific routes)
router.put('/:id', authenticateToken, requirePermission('vehicle.update'), async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }
    
    // Update vehicle fields
    Object.assign(vehicle, req.body);
    await vehicle.save();
    
    // Populate references
    await vehicle.populate(['assignedTo', 'assignedSite']);
    
    res.json({
      success: true,
      message: 'Vehicle updated successfully',
      data: { vehicle }
    });
    
  } catch (error) {
    console.error('Update vehicle error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle number already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update vehicle'
    });
  }
});

// Delete vehicle
router.delete('/:id', authenticateToken, requirePermission('vehicle.delete'), async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }
    
    // Soft delete - set isActive to false
    vehicle.isActive = false;
    await vehicle.save();
    
    res.json({
      success: true,
      message: 'Vehicle deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete vehicle error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete vehicle'
    });
  }
});

// Get available vehicles (not assigned to active sites)
router.get('/available', authenticateToken, requirePermission('vehicle.read'), async (req, res) => {
  try {
    const Site = require('../models/Site');
    
    // Find vehicles that are not assigned to active sites
    const assignedVehicles = await Site.find({
      status: { $in: ['planning', 'active', 'on_hold'] },
      assignedVehicles: { $exists: true, $ne: [] }
    }).distinct('assignedVehicles.vehicle');
    
    const availableVehicles = await Vehicle.find({
      isActive: true,
      status: 'available',
      _id: { $nin: assignedVehicles }
    }).select('_id vehicleNumber type brand model year status');
    
    res.json({
      success: true,
      data: {
        vehicles: availableVehicles
      }
    });
    
  } catch (error) {
    console.error('Get available vehicles error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available vehicles'
    });
  }
});

module.exports = router;