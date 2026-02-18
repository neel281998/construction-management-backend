const express = require('express');
const PlantOutput = require('../models/PlantOutput');
const PlantOutputDispatch = require('../models/PlantOutputDispatch');
const PlantOutputReceipt = require('../models/PlantOutputReceipt');
const Plant = require('../models/Plant');
const Vehicle = require('../models/Vehicle');
const Site = require('../models/Site');
const StorageSite = require('../models/StorageSite');
const StepInventoryReceipt = require('../models/StepInventoryReceipt');
const { authenticateToken, requirePermission, requirePlantOutputRead } = require('../middleware/auth');

const router = express.Router();

// Get all plant output dispatch history
router.get('/', authenticateToken, requirePlantOutputRead, async (req, res) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    
    let query = {};
    
    // Apply access control for non-admin users
    if (req.user.role !== 'admin') {
      const assignedPlants = req.user.assignedPlants || [];
      if (assignedPlants.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'No plants assigned to user'
        });
      }
      query['fromPlant._id'] = { $in: assignedPlants };
    }
    
    // Filter by status if provided
    if (status) {
      query.status = status;
    }
    
    const dispatches = await PlantOutputDispatch.find(query)
      .sort({ dispatchedAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('dispatchedBy', 'firstName lastName email')
      .populate('receivedBy', 'firstName lastName email');
    
    const totalCount = await PlantOutputDispatch.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        dispatches,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: parseInt(page) * parseInt(limit) < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });
    
  } catch (error) {
    console.error('Get plant output dispatch history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plant output dispatch history'
    });
  }
});

// Dispatch plant output
router.post('/dispatch', authenticateToken, requirePermission('plant_output.update'), async (req, res) => {
  try {
    const { 
      outputId, 
      quantity, 
      destinationType, 
      destinationId, 
      vehicleId, 
      expectedDeliveryAt, 
      notes = '',
      deliveryImages = []
    } = req.body;
    
    if (!outputId || !quantity || !destinationType || !destinationId || !vehicleId) {
      return res.status(400).json({
        success: false,
        message: 'Output ID, quantity, destination type, destination ID, and vehicle ID are required'
      });
    }
    
    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Dispatch quantity must be positive'
      });
    }
    
    // Get the source plant output
    const sourceOutput = await PlantOutput.findById(outputId)
      .populate('plant', 'name plantType');
    
    if (!sourceOutput) {
      return res.status(404).json({
        success: false,
        message: 'Source plant output not found'
      });
    }
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedPlants.includes(sourceOutput.plant._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to source plant'
      });
    }
    
    // Check if sufficient stock is available
    if (quantity > sourceOutput.currentStock) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock available for dispatch',
        data: {
          requested: quantity,
          available: sourceOutput.currentStock
        }
      });
    }
    
    // Enforce destination type to construction site or construction step only
    if (!['construction_site', 'construction_step'].includes(destinationType)) {
      return res.status(400).json({
        success: false,
        message: 'Destination must be a construction site or construction step'
      });
    }

    // Get destination details
    let destinationName = '';
    let destinationDetails = {};
    
    if (destinationType === 'construction_site') {
      const site = await Site.findById(destinationId);
      if (!site) {
        return res.status(404).json({
          success: false,
          message: 'Construction site not found'
        });
      }
      destinationName = site.name;
      destinationDetails = { siteType: site.siteType };
    } else if (destinationType === 'construction_step') {
      const Step = require('../models/Step');
      const step = await Step.findById(destinationId);
      if (!step) {
        return res.status(404).json({
          success: false,
          message: 'Construction step not found'
        });
      }
      // fetch site for context
      const site = await Site.findById(step.siteId);
      destinationName = site ? `${site.name} • ${step.name || 'Step'} ${step.stepNumber || ''}`.trim() : (step.name || `Step ${destinationId}`);
      destinationDetails = { 
        siteId: step.siteId?.toString?.(),
        stepName: step.name,
        stepNumber: step.stepNumber
      };
    }
    
    // Get vehicle details
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }
    
    // Validate vehicle has required fields
    if (!vehicle.type) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle type is required but not set'
      });
    }
    
    if (!vehicle.vehicleNumber) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle number is required but not set'
      });
    }
    
    // Create dispatch record
    const dispatch = new PlantOutputDispatch({
      outputId,
      outputName: sourceOutput.materialName,
      materialType: sourceOutput.materialType,
      unit: sourceOutput.unit,
      quantity,
      fromPlant: {
        _id: sourceOutput.plant._id,
        name: sourceOutput.plant.name
      },
      destination: {
        type: destinationType,
        id: destinationId,
        name: destinationName,
        details: destinationDetails
      },
      vehicle: {
        _id: vehicle._id,
        vehicleNumber: vehicle.vehicleNumber,
        vehicleType: vehicle.type,
        driverName: vehicle.assignedTo ? 'Assigned Driver' : undefined,
        driverPhone: undefined
      },
      dispatchedBy: {
        _id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email
      },
      status: 'dispatched',
      expectedDeliveryAt: expectedDeliveryAt ? new Date(expectedDeliveryAt) : undefined,
      notes
    });
    
    // Attach delivery images if provided (as fileIds)
    if (Array.isArray(deliveryImages) && deliveryImages.length > 0) {
      dispatch.deliveryImages = deliveryImages.map((fileId) => ({
        fileId,
        uploadedBy: req.user._id,
        uploadedAt: new Date()
      }));
    }

    await dispatch.save();
    
    // Create step inventory receipt if dispatching to a construction step
    if (destinationType === 'construction_step') {
      try {
        // Resolve siteId (step is already loaded above in this branch)
        const siteIdForReceipt = step.siteId && (step.siteId._id || step.siteId);
        if (!siteIdForReceipt) {
          console.warn('Step inventory receipt skipped: no siteId for step', destinationId);
        } else {
        // Map plant output units to step inventory units
        const unitMapping = {
          'cubic_meters': 'm³',
          'tons': 'tons',
          'pieces': 'pieces',
          'kg': 'kg',
          'liters': 'liters'
        };
        
        const mappedUnit = unitMapping[sourceOutput.unit] || 'm³'; // Default to m³ if no mapping found
        
        const stepInventoryReceipt = new StepInventoryReceipt({
          stepId: destinationId,
          siteId: siteIdForReceipt,
          sourceType: 'plant',
          sourceId: sourceOutput.plant._id,
          sourceName: sourceOutput.plant.name,
          materialName: sourceOutput.materialName,
          materialCategory: 'cement_concrete', // Default category for plant output
          materialType: 'primary',
          quantity: quantity,
          unit: mappedUnit,
          qualityGrade: sourceOutput.qualitySpecs?.strength ? `${sourceOutput.qualitySpecs.strength} MPa` : undefined,
          deliveryDate: new Date(),
          deliveryImages: deliveryImages || [],
          deliveryNotes: notes,
          vehicle: {
            _id: vehicle._id,
            vehicleNumber: vehicle.vehicleNumber,
            vehicleType: vehicle.type,
            driverName: vehicle.assignedTo ? 'Assigned Driver' : undefined,
            driverPhone: undefined
          },
          receivedBy: {
            _id: req.user._id,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
            email: req.user.email
          },
          receivedAt: new Date(),
          verifiedBy: req.user._id,
          verificationDate: new Date(),
          verificationNotes: `Dispatched from plant: ${sourceOutput.plant.name}`,
          status: 'received'
        });
        
        await stepInventoryReceipt.save();
        }
      } catch (stepReceiptError) {
        console.error('Error creating step inventory receipt:', stepReceiptError);
        // Don't fail the dispatch if step receipt creation fails
      }
    }
    
    // Reduce stock from source plant output
    sourceOutput.currentStock -= quantity;
    
    // Add to transfer history
    // Map destination type to valid enum value
    let transferredToType;
    if (destinationType === 'construction_site') {
      transferredToType = 'Site';
    } else if (destinationType === 'construction_step') {
      transferredToType = 'Site'; // Construction steps belong to sites
    } else {
      transferredToType = 'Site'; // Default fallback
    }
    
    sourceOutput.transferHistory.push({
      quantity,
      transferredTo: destinationId,
      transferredToType: transferredToType,
      transferredBy: req.user._id,
      transferId: dispatch._id,
      notes: `Dispatched to ${destinationName}: ${notes}`
    });
    
    await sourceOutput.save();
    
    res.json({
      success: true,
      message: 'Plant output dispatched successfully',
      data: {
        dispatch: {
          id: dispatch._id,
          outputName: dispatch.outputName,
          quantity: dispatch.quantity,
          destination: dispatch.destination.name,
          vehicle: dispatch.vehicle.vehicleNumber,
          status: dispatch.status
        },
        sourceOutput: {
          id: sourceOutput._id,
          outputName: sourceOutput.materialName,
          remainingStock: sourceOutput.currentStock,
          plant: sourceOutput.plant.name
        }
      }
    });
    
  } catch (error) {
    console.error('Dispatch plant output error:', error);
    
    if (error.message === 'Insufficient stock available for dispatch') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate dispatch record'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to dispatch plant output',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Receive plant output (supports partial receiving)
router.post('/receive', authenticateToken, requirePermission('plant_output.update'), async (req, res) => {
  try {
    const { 
      dispatchId, 
      receivedQuantity, 
      deliveryImages = [], 
      notes = '',
      qualityCheck = {}
    } = req.body;
    
    if (!dispatchId || !receivedQuantity) {
      return res.status(400).json({
        success: false,
        message: 'Dispatch ID and received quantity are required'
      });
    }
    
    const receivedQty = parseFloat(receivedQuantity);
    if (receivedQty <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Received quantity must be positive'
      });
    }
    
    // Get the dispatch record
    const dispatch = await PlantOutputDispatch.findById(dispatchId)
      .populate('outputId', 'materialName materialType unit plant');
    
    if (!dispatch) {
      return res.status(404).json({
        success: false,
        message: 'Dispatch record not found'
      });
    }
    
    if (dispatch.status === 'received') {
      return res.status(400).json({
        success: false,
        message: 'This dispatch has already been fully received'
      });
    }
    
    if (dispatch.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot receive a cancelled dispatch'
      });
    }
    
    // Check if received quantity exceeds remaining quantity
    const remainingQty = dispatch.remainingQuantity || dispatch.quantity;
    if (receivedQty > remainingQty) {
      return res.status(400).json({
        success: false,
        message: `Received quantity (${receivedQty}) cannot exceed remaining quantity (${remainingQty})`
      });
    }
    
    // Create receipt record
    const receipt = new PlantOutputReceipt({
      dispatchId: dispatch._id,
      receivedQuantity: receivedQty,
      receivedBy: {
        _id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email
      },
      deliveryImages: deliveryImages.map(fileId => ({
        fileId,
        uploadedBy: req.user._id,
        uploadedAt: new Date()
      })),
      notes,
      qualityCheck: {
        performed: qualityCheck.performed || false,
        passed: qualityCheck.passed,
        testResults: qualityCheck.testResults || [],
        checkedBy: qualityCheck.performed ? req.user._id : undefined,
        checkedAt: qualityCheck.performed ? new Date() : undefined
      }
    });
    
    await receipt.save();
    
    // Update dispatch record
    dispatch.receivedQuantity = (dispatch.receivedQuantity || 0) + receivedQty;
    dispatch.remainingQuantity = dispatch.quantity - dispatch.receivedQuantity;
    
    // Update status based on remaining quantity
    if (dispatch.remainingQuantity <= 0) {
      dispatch.status = 'received';
      dispatch.receivedAt = new Date();
      dispatch.receivedBy = {
        _id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email
      };
    } else {
      dispatch.status = 'partially_received';
    }
    
    await dispatch.save();
    
    // If destination is a storage site, add inventory there
    if (dispatch.destination.type === 'storage_site') {
      const Inventory = require('../models/Inventory');
      const destinationStorageSite = await StorageSite.findById(dispatch.destination.id);
      
      if (destinationStorageSite) {
        // Check if destination already has this item
        let destinationItem = await Inventory.findOne({
          itemName: dispatch.outputName,
          storageSite: dispatch.destination.id,
          isActive: true
        });
        
        if (destinationItem) {
          // Update existing item at destination
          destinationItem.currentStock += receivedQty;
          
          // Add to transfer history
          destinationItem.transferHistory.push({
            fromStorageSite: null, // Coming from plant
            toStorageSite: dispatch.destination.id,
            quantity: receivedQty,
            transferredBy: req.user._id,
            notes: `Received from plant output dispatch: ${notes}`,
            dispatchId: dispatch._id
          });
          
          await destinationItem.save();
        } else {
          // Create new item at destination
          destinationItem = new Inventory({
            itemName: dispatch.outputName,
            category: dispatch.materialType,
            unit: dispatch.unit,
            currentStock: receivedQty,
            minimumStock: 0, // Default minimum stock
            maximumStock: 1000, // Default maximum stock
            storageSite: dispatch.destination.id,
            transferHistory: [{
              fromStorageSite: null, // Coming from plant
              toStorageSite: dispatch.destination.id,
              quantity: receivedQty,
              transferredBy: req.user._id,
              notes: `Received from plant output dispatch: ${notes}`,
              dispatchId: dispatch._id
            }]
          });
          
          await destinationItem.save();
        }
      }
    }
    // If destination is a plant, add to plant inventory
    else if (dispatch.destination.type === 'plant') {
      const PlantInventory = require('../models/PlantInventory');
      const destinationPlant = await Plant.findById(dispatch.destination.id);
      
      if (destinationPlant) {
        // Check if destination already has this item
        let destinationItem = await PlantInventory.findOne({
          itemName: dispatch.outputName,
          plant: dispatch.destination.id,
          isActive: true
        });
        
        if (destinationItem) {
          // Update existing item at destination
          destinationItem.currentStock += receivedQty;
          
          // Add to transfer history
          destinationItem.transferHistory.push({
            fromPlant: dispatch.fromPlant._id,
            toPlant: dispatch.destination.id,
            quantity: receivedQty,
            transferredBy: req.user._id,
            notes: `Received from plant output dispatch: ${notes}`,
            dispatchId: dispatch._id
          });
          
          await destinationItem.save();
        } else {
          // Create new item at destination
          destinationItem = new PlantInventory({
            itemName: dispatch.outputName,
            category: dispatch.materialType,
            unit: dispatch.unit,
            materialType: dispatch.materialType,
            currentStock: receivedQty,
            minimumStock: 0, // Default minimum stock
            maximumStock: 1000, // Default maximum stock
            plant: dispatch.destination.id,
            transferHistory: [{
              fromPlant: dispatch.fromPlant._id,
              toPlant: dispatch.destination.id,
              quantity: receivedQty,
              transferredBy: req.user._id,
              notes: `Received from plant output dispatch: ${notes}`,
              dispatchId: dispatch._id
            }]
          });
          
          await destinationItem.save();
        }
      }
    }
    
    res.json({
      success: true,
      message: 'Plant output received successfully',
      data: {
        dispatch: {
          id: dispatch._id,
          outputName: dispatch.outputName,
          receivedQuantity: receivedQty,
          destination: dispatch.destination.name,
          status: dispatch.status
        }
      }
    });
    
  } catch (error) {
    console.error('Receive plant output error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to receive plant output'
    });
  }
});

// Get dispatch history for a plant
router.get('/plant/:plantId', authenticateToken, requirePlantOutputRead, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const plant = await Plant.findById(req.params.plantId);
    
    if (!plant) {
      return res.status(404).json({
        success: false,
        message: 'Plant not found'
      });
    }
    
    // Check access control
    if (req.user.role !== 'admin' && !req.user.assignedPlants.includes(plant._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this plant'
      });
    }
    
    // Build query
    let query = { 'fromPlant._id': plant._id };
    if (status) {
      query.status = status;
    }
    
    const dispatches = await PlantOutputDispatch.find(query)
      .sort({ dispatchedAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('dispatchedBy', 'firstName lastName email')
      .populate('fromPlant', 'name plantType')
      .populate('receivedBy', 'firstName lastName email');
    
    const totalCount = await PlantOutputDispatch.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        plant: {
          _id: plant._id,
          name: plant.name,
          plantType: plant.plantType
        },
        dispatches,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: parseInt(page) * parseInt(limit) < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });
    
  } catch (error) {
    console.error('Get plant dispatch history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plant dispatch history'
    });
  }
});

// Get pending dispatches for a destination
router.get('/pending/:destinationType/:destinationId', authenticateToken, requirePlantOutputRead, async (req, res) => {
  try {
    const { destinationType, destinationId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const query = {
      'destination.type': destinationType,
      'destination.id': destinationId,
      status: { $in: ['dispatched', 'in_transit', 'delivered'] }
    };
    
    const dispatches = await PlantOutputDispatch.find(query)
      .sort({ dispatchedAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('dispatchedBy', 'firstName lastName email')
      .populate('fromPlant', 'name plantType');
    
    const totalCount = await PlantOutputDispatch.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        destination: {
          type: destinationType,
          id: destinationId
        },
        dispatches,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: parseInt(page) * parseInt(limit) < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });
    
  } catch (error) {
    console.error('Get pending plant output dispatches error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending plant output dispatches'
    });
  }
});

// Get all dispatches for a destination (including received ones)
router.get('/destination/:destinationType/:destinationId', authenticateToken, requirePlantOutputRead, async (req, res) => {
  try {
    const { destinationType, destinationId } = req.params;
    const { page = 1, limit = 10, status } = req.query;
    
    const query = {
      'destination.type': destinationType,
      'destination.id': destinationId
    };
    
    // Filter by status if provided
    if (status) {
      query.status = status;
    }
    
    const dispatches = await PlantOutputDispatch.find(query)
      .sort({ dispatchedAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('dispatchedBy', 'firstName lastName email')
      .populate('fromPlant', 'name plantType')
      .populate('receivedBy', 'firstName lastName email');
    
    const totalCount = await PlantOutputDispatch.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        destination: {
          type: destinationType,
          id: destinationId
        },
        dispatches,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: parseInt(page) * parseInt(limit) < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });
    
  } catch (error) {
    console.error('Get destination dispatches error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch destination dispatches'
    });
  }
});

// Get receipt history for a dispatch
router.get('/:dispatchId/receipts', authenticateToken, requirePlantOutputRead, async (req, res) => {
  try {
    const { dispatchId } = req.params;
    
    const receipts = await PlantOutputReceipt.find({ dispatchId })
      .sort({ receivedAt: -1 })
      .populate('receivedBy', 'firstName lastName email');
    
    res.json({
      success: true,
      data: {
        dispatchId,
        receipts
      }
    });
    
  } catch (error) {
    console.error('Get plant output receipt history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plant output receipt history'
    });
  }
});

// Get receipts for a specific destination (construction site or step)
router.get('/receipts/destination/:destinationType/:destinationId', authenticateToken, requirePlantOutputRead, async (req, res) => {
  try {
    const { destinationType, destinationId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    // Find dispatches for this destination
    const dispatches = await PlantOutputDispatch.find({
      'destination.type': destinationType,
      'destination.id': destinationId
    }).select('_id');
    
    const dispatchIds = dispatches.map(d => d._id);
    
    if (dispatchIds.length === 0) {
      return res.json({
        success: true,
        data: {
          destination: {
            type: destinationType,
            id: destinationId
          },
          receipts: [],
          pagination: {
            currentPage: parseInt(page),
            totalPages: 0,
            totalCount: 0,
            hasNext: false,
            hasPrev: false
          }
        }
      });
    }
    
    // Get receipts for these dispatches
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [receipts, totalCount] = await Promise.all([
      PlantOutputReceipt.find({ dispatchId: { $in: dispatchIds } })
        .sort({ receivedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('receivedBy', 'firstName lastName email')
        .populate({
          path: 'dispatchId',
          select: 'outputName quantity destination vehicle dispatchedAt',
          populate: {
            path: 'dispatchedBy',
            select: 'firstName lastName email'
          }
        }),
      PlantOutputReceipt.countDocuments({ dispatchId: { $in: dispatchIds } })
    ]);
    
    res.json({
      success: true,
      data: {
        destination: {
          type: destinationType,
          id: destinationId
        },
        receipts,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + receipts.length < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });
    
  } catch (error) {
    console.error('Get destination receipts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch destination receipts'
    });
  }
});

// Confirm receipt for plant output dispatch to construction step
router.post('/confirm-receipt/:dispatchId', authenticateToken, requirePermission('plant_output.update'), async (req, res) => {
  try {
    const { dispatchId } = req.params;
    const { 
      receivedQuantity, 
      receiptImages = [], 
      notes = '',
      qualityCheck = {},
      discrepancies = {}
    } = req.body;
    
    if (!receivedQuantity || receivedQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid received quantity is required'
      });
    }
    
    // Get the dispatch record
    const dispatch = await PlantOutputDispatch.findById(dispatchId)
      .populate('outputId', 'materialName materialType unit plant');
    
    if (!dispatch) {
      return res.status(404).json({
        success: false,
        message: 'Dispatch record not found'
      });
    }
    
    if (dispatch.destination.type !== 'construction_step') {
      return res.status(400).json({
        success: false,
        message: 'This endpoint is only for construction step dispatches'
      });
    }
    
    if (dispatch.status === 'received') {
      return res.status(400).json({
        success: false,
        message: 'This dispatch has already been received'
      });
    }
    
    if (dispatch.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot confirm a cancelled dispatch'
      });
    }
    
    // Check if received quantity exceeds dispatched quantity
    if (receivedQuantity > dispatch.quantity) {
      return res.status(400).json({
        success: false,
        message: `Received quantity (${receivedQuantity}) cannot exceed dispatched quantity (${dispatch.quantity})`
      });
    }
    
    // Create plant output receipt
    const plantReceipt = new PlantOutputReceipt({
      dispatchId: dispatch._id,
      receivedQuantity: receivedQuantity,
      receivedBy: {
        _id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email
      },
      deliveryImages: receiptImages.map(fileId => ({
        fileId,
        uploadedBy: req.user._id,
        uploadedAt: new Date()
      })),
      notes,
      qualityCheck: {
        performed: qualityCheck.performed || false,
        passed: qualityCheck.passed,
        testResults: qualityCheck.testResults || [],
        checkedBy: qualityCheck.performed ? req.user._id : undefined,
        checkedAt: qualityCheck.performed ? new Date() : undefined
      }
    });
    
    await plantReceipt.save();
    
    // Update dispatch record
    dispatch.receivedQuantity = receivedQuantity;
    dispatch.remainingQuantity = dispatch.quantity - receivedQuantity;
    dispatch.status = 'received';
    dispatch.receivedAt = new Date();
    dispatch.receivedBy = {
      _id: req.user._id,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      email: req.user.email
    };
    
    await dispatch.save();
    
    // Update the corresponding step inventory receipt
    const stepReceipt = await StepInventoryReceipt.findOne({
      stepId: dispatch.destination.id,
      sourceType: 'plant',
      sourceId: dispatch.fromPlant._id,
      materialName: dispatch.outputName
    }).sort({ createdAt: -1 }); // Get the most recent one
    
    if (stepReceipt) {
      // Update the step inventory receipt with confirmed details
      stepReceipt.quantity = receivedQuantity;
      stepReceipt.remainingQuantity = receivedQuantity - stepReceipt.consumedQuantity;
      
      // Add received images
      if (receiptImages && receiptImages.length > 0) {
        stepReceipt.deliveryImages = [...(stepReceipt.deliveryImages || []), ...receiptImages];
      }
      
      // Update delivery notes
      if (notes) {
        stepReceipt.deliveryNotes = notes;
      }
      
      // Add quality check information
      if (qualityCheck && qualityCheck.performed) {
        stepReceipt.qualityCheck = {
          performed: qualityCheck.performed,
          passed: qualityCheck.passed,
          testResults: qualityCheck.testResults || [],
          checkedBy: req.user._id,
          checkedAt: new Date()
        };
      }
      
      // Add discrepancy information
      if (discrepancies && Object.keys(discrepancies).length > 0) {
        stepReceipt.discrepancies = {
          quantityDifference: receivedQuantity - dispatch.quantity,
          qualityIssues: discrepancies.qualityIssues || [],
          damageReport: discrepancies.damageReport || null,
          otherIssues: discrepancies.otherIssues || null,
          reportedBy: req.user._id,
          reportedAt: new Date()
        };
      }
      
      // Update verification info
      stepReceipt.verifiedBy = req.user._id;
      stepReceipt.verificationDate = new Date();
      stepReceipt.status = 'verified';
      
      // Create comprehensive verification notes
      let verificationNotes = `Receipt confirmed by step manager.\n`;
      verificationNotes += `Dispatched: ${dispatch.quantity} ${dispatch.unit}\n`;
      verificationNotes += `Received: ${receivedQuantity} ${dispatch.unit}\n`;
      verificationNotes += `Difference: ${receivedQuantity - dispatch.quantity} ${dispatch.unit}\n`;
      
      if (notes) {
        verificationNotes += `\nStep Manager Notes: ${notes}\n`;
      }
      
      if (discrepancies && discrepancies.quantityDifference !== 0) {
        verificationNotes += `\nDiscrepancy: ${discrepancies.quantityDifference} ${dispatch.unit}\n`;
      }
      
      stepReceipt.verificationNotes = verificationNotes;
      
      await stepReceipt.save();
    }
    
    res.json({
      success: true,
      message: 'Receipt confirmed successfully',
      data: {
        dispatch: {
          id: dispatch._id,
          outputName: dispatch.outputName,
          dispatchedQuantity: dispatch.quantity,
          receivedQuantity: receivedQuantity,
          difference: receivedQuantity - dispatch.quantity,
          destination: dispatch.destination.name,
          status: dispatch.status,
          confirmedBy: {
            firstName: req.user.firstName,
            lastName: req.user.lastName
          },
          confirmedAt: dispatch.receivedAt
        },
        plantReceipt: {
          id: plantReceipt._id,
          receivedQuantity: plantReceipt.receivedQuantity,
          receivedBy: plantReceipt.receivedBy,
          receivedAt: plantReceipt.receivedAt
        },
        stepReceipt: stepReceipt ? {
          id: stepReceipt._id,
          quantity: stepReceipt.quantity,
          status: stepReceipt.status,
          verifiedBy: stepReceipt.verifiedBy,
          verifiedAt: stepReceipt.verificationDate
        } : null
      }
    });
    
  } catch (error) {
    console.error('Confirm plant output receipt error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm receipt'
    });
  }
});

module.exports = router;
