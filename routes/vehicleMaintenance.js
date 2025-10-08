const express = require('express');
const VehicleMaintenance = require('../models/VehicleMaintenance');
const Vehicle = require('../models/Vehicle');
const { authenticateToken, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get maintenance records for a vehicle
router.get('/vehicle/:vehicleId', authenticateToken, requirePermission('vehicle.read'), async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { 
      status, 
      maintenanceType, 
      page = 1, 
      limit = 20,
      includeDocuments = false 
    } = req.query;

    // Build query
    let query = { vehicleId };
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (maintenanceType && maintenanceType !== 'all') {
      query.maintenanceType = maintenanceType;
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [maintenance, totalCount] = await Promise.all([
      VehicleMaintenance.find(query)
        .populate('assignedTo', 'firstName lastName')
        .populate('qualityCheck.checkedBy', 'firstName lastName')
        .sort({ scheduledDate: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select(includeDocuments === 'true' ? '' : '-documents -images'),
      VehicleMaintenance.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        maintenance,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + maintenance.length < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Get vehicle maintenance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicle maintenance records'
    });
  }
});

// Get upcoming maintenance
router.get('/upcoming/:vehicleId', authenticateToken, requirePermission('vehicle.read'), async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { days = 30 } = req.query;

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + parseInt(days));

    const upcoming = await VehicleMaintenance.find({
      vehicleId,
      status: { $in: ['scheduled', 'in_progress'] },
      scheduledDate: { $lte: endDate }
    })
    .populate('assignedTo', 'firstName lastName')
    .sort({ scheduledDate: 1 });

    res.json({
      success: true,
      data: { upcoming }
    });

  } catch (error) {
    console.error('Get upcoming maintenance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch upcoming maintenance'
    });
  }
});

// Get maintenance history
router.get('/history/:vehicleId', authenticateToken, requirePermission('vehicle.read'), async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [history, totalCount] = await Promise.all([
      VehicleMaintenance.find({
        vehicleId,
        status: 'completed'
      })
      .populate('assignedTo', 'firstName lastName')
      .populate('qualityCheck.checkedBy', 'firstName lastName')
      .sort({ completedDate: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
      VehicleMaintenance.countDocuments({
        vehicleId,
        status: 'completed'
      })
    ]);

    res.json({
      success: true,
      data: {
        history,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + history.length < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Get maintenance history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch maintenance history'
    });
  }
});

// Create maintenance record
router.post('/', authenticateToken, requirePermission('vehicle.create'), async (req, res) => {
  try {
    const {
      vehicleId,
      maintenanceType,
      title,
      description,
      scheduledDate,
      odometerReading,
      serviceProvider,
      cost,
      partsReplaced,
      workPerformed,
      nextMaintenance,
      nextMaintenanceDate,
      nextMaintenanceOdometer,
      priority,
      assignedTo,
      notes
    } = req.body;

    // Validate required fields
    if (!vehicleId || !maintenanceType || !title || !scheduledDate) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle ID, maintenance type, title, and scheduled date are required'
      });
    }

    // Check if vehicle exists
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    // Create maintenance record
    const maintenance = new VehicleMaintenance({
      vehicleId,
      maintenanceType,
      title,
      description,
      scheduledDate,
      odometerReading,
      serviceProvider,
      cost,
      partsReplaced,
      workPerformed,
      nextMaintenance,
      nextMaintenanceDate,
      nextMaintenanceOdometer,
      priority,
      assignedTo,
      notes
    });

    await maintenance.save();

    res.status(201).json({
      success: true,
      message: 'Maintenance record created successfully',
      data: { maintenance }
    });

  } catch (error) {
    console.error('Create maintenance record error:', error);
    
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
      message: 'Failed to create maintenance record'
    });
  }
});

// Update maintenance record
router.put('/:id', authenticateToken, requirePermission('vehicle.update'), async (req, res) => {
  try {
    const maintenance = await VehicleMaintenance.findById(req.params.id);
    
    if (!maintenance) {
      return res.status(404).json({
        success: false,
        message: 'Maintenance record not found'
      });
    }

    // Update fields
    Object.assign(maintenance, req.body);
    
    // If marking as completed, set completed date
    if (req.body.status === 'completed' && !maintenance.completedDate) {
      maintenance.completedDate = new Date();
    }

    await maintenance.save();

    res.json({
      success: true,
      message: 'Maintenance record updated successfully',
      data: { maintenance }
    });

  } catch (error) {
    console.error('Update maintenance record error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update maintenance record'
    });
  }
});

// Complete maintenance
router.put('/:id/complete', authenticateToken, requirePermission('vehicle.update'), async (req, res) => {
  try {
    const { cost, partsReplaced, workPerformed, notes, qualityCheck } = req.body;

    const maintenance = await VehicleMaintenance.findById(req.params.id);
    
    if (!maintenance) {
      return res.status(404).json({
        success: false,
        message: 'Maintenance record not found'
      });
    }

    // Update maintenance record
    maintenance.status = 'completed';
    maintenance.completedDate = new Date();
    maintenance.cost = cost || maintenance.cost;
    maintenance.partsReplaced = partsReplaced || maintenance.partsReplaced;
    maintenance.workPerformed = workPerformed || maintenance.workPerformed;
    maintenance.notes = notes || maintenance.notes;
    maintenance.qualityCheck = qualityCheck || maintenance.qualityCheck;

    await maintenance.save();

    // Update vehicle's maintenance schedule
    const vehicle = await Vehicle.findById(maintenance.vehicleId);
    if (vehicle && maintenance.nextMaintenanceDate) {
      vehicle.maintenanceSchedule.nextService = maintenance.nextMaintenanceDate;
      vehicle.maintenanceSchedule.lastService = maintenance.completedDate;
      if (maintenance.nextMaintenanceOdometer) {
        vehicle.maintenanceSchedule.mileage = maintenance.nextMaintenanceOdometer;
      }
      await vehicle.save();
    }

    res.json({
      success: true,
      message: 'Maintenance completed successfully',
      data: { maintenance }
    });

  } catch (error) {
    console.error('Complete maintenance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete maintenance'
    });
  }
});

// Delete maintenance record
router.delete('/:id', authenticateToken, requirePermission('vehicle.delete'), async (req, res) => {
  try {
    const maintenance = await VehicleMaintenance.findById(req.params.id);
    
    if (!maintenance) {
      return res.status(404).json({
        success: false,
        message: 'Maintenance record not found'
      });
    }

    await VehicleMaintenance.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Maintenance record deleted successfully'
    });

  } catch (error) {
    console.error('Delete maintenance record error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete maintenance record'
    });
  }
});

// Get maintenance summary
router.get('/summary/:vehicleId', authenticateToken, requirePermission('vehicle.read'), async (req, res) => {
  try {
    const { vehicleId } = req.params;

    const summary = await VehicleMaintenance.aggregate([
      { $match: { vehicleId: mongoose.Types.ObjectId(vehicleId) } },
      {
        $group: {
          _id: null,
          totalMaintenance: { $sum: 1 },
          completedMaintenance: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          totalCost: { $sum: '$cost.total' },
          avgCost: { $avg: '$cost.total' },
          lastMaintenance: { $max: '$completedDate' },
          nextMaintenance: { $min: '$scheduledDate' }
        }
      }
    ]);

    // Get maintenance by type
    const byType = await VehicleMaintenance.aggregate([
      { $match: { vehicleId: mongoose.Types.ObjectId(vehicleId) } },
      {
        $group: {
          _id: '$maintenanceType',
          count: { $sum: 1 },
          totalCost: { $sum: '$cost.total' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        summary: summary[0] || {
          totalMaintenance: 0,
          completedMaintenance: 0,
          totalCost: 0,
          avgCost: 0,
          lastMaintenance: null,
          nextMaintenance: null
        },
        byType
      }
    });

  } catch (error) {
    console.error('Get maintenance summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch maintenance summary'
    });
  }
});

module.exports = router;
