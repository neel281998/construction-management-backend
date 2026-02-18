const express = require('express');
const Inventory = require('../models/Inventory');
const InventoryTransfer = require('../models/InventoryTransfer');
const InventoryTransferReceipt = require('../models/InventoryTransferReceipt');
const Vehicle = require('../models/Vehicle');
const StorageSite = require('../models/StorageSite');
const StepInventoryReceipt = require('../models/StepInventoryReceipt');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const AlertService = require('../utils/alertService');

// Map storage-site/Inventory category to StepInventoryReceipt materialCategory enum
const CATEGORY_TO_STEP_MATERIAL = {
  'Cement': 'cement_concrete',
  'Aggregates': 'aggregates',
  'Water': 'cement_concrete',
  'Admixtures': 'cement_concrete',
  'Steel Reinforcement': 'steel_reinforcement',
  'Concrete Mix': 'cement_concrete',
  'Tools & Equipment': 'tools_equipment',
  'Safety Equipment': 'tools_equipment',
  'Building Materials': 'other',
  'Other': 'other'
};
const STEP_RECEIPT_UNITS = ['m³', 'kg', 'liters', 'pieces', 'tons', 'sq.m', 'linear.m', 'bags', 'bundles'];

const router = express.Router();

// Get transfer history
router.get('/history', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    
    let query = {};
    
    // Apply access control for non-admin users
    if (req.user.role !== 'admin') {
      const assignedSites = req.user.assignedStorageSites || [];
      if (assignedSites.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'No storage sites assigned to user'
        });
      }
      query.$or = [
        { 'fromStorageSite._id': { $in: assignedSites } },
        { 'toStorageSite._id': { $in: assignedSites } }
      ];
    }
    
    // Filter by status if provided
    if (status) {
      query.status = status;
    }
    
    const transfers = await InventoryTransfer.find(query)
      .sort({ transferredAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('transferredBy', 'firstName lastName email')
      .populate('receivedBy', 'firstName lastName email');
    
    const totalCount = await InventoryTransfer.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        transfers,
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
    console.error('Get transfer history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transfer history'
    });
  }
});

// Get pending transfers for a construction step (must be before /:transferId so path is not matched as transferId)
router.get('/pending-construction-step/:stepId', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const { stepId } = req.params;
    const Step = require('../models/Step');
    const step = await Step.findById(stepId).select('siteId').lean();
    if (!step || !step.siteId) {
      return res.status(404).json({
        success: false,
        message: 'Construction step not found'
      });
    }
    const siteId = step.siteId.toString();
    if (req.user.role !== 'admin') {
      const assignedSites = (req.user.assignedSites || []).map(s => (s && s._id ? s._id : s).toString());
      if (!assignedSites.length || !assignedSites.includes(siteId)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this construction step'
        });
      }
    }
    const transfers = await InventoryTransfer.find({
      'toConstructionStep._id': stepId,
      status: 'in_transit'
    })
      .sort({ transferredAt: -1 })
      .populate('transferredBy', 'firstName lastName email')
      .lean();
    res.json({
      success: true,
      data: {
        stepId,
        siteId,
        transfers
      }
    });
  } catch (error) {
    console.error('Get pending transfers for step error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending transfers for step'
    });
  }
});

// Get specific transfer by ID (must be before other routes to avoid conflicts)
router.get('/:transferId', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    const { transferId } = req.params;
    
    const transfer = await InventoryTransfer.findById(transferId)
      .populate('transferredBy', 'firstName lastName email')
      .populate('receivedBy', 'firstName lastName email');
    
    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: 'Transfer not found'
      });
    }
    
    // Check access control (storage sites or construction site/step)
    if (req.user.role !== 'admin') {
      const storageSiteIds = req.user.assignedStorageSites || [];
      const constructionSiteIds = (req.user.assignedSites || []).map(s => (s && s._id ? s._id : s).toString());
      const fromId = (transfer.fromStorageSite && (transfer.fromStorageSite._id || transfer.fromStorageSite))?.toString();
      const toStorageId = (transfer.toStorageSite && transfer.toStorageSite._id)?.toString();
      const toStepSiteId = (transfer.toConstructionStep && transfer.toConstructionStep.siteId && (transfer.toConstructionStep.siteId._id || transfer.toConstructionStep.siteId))?.toString();
      const toSiteId = (transfer.toConstructionSite && transfer.toConstructionSite._id)?.toString();
      const hasStorageAccess = (fromId && storageSiteIds.includes(fromId)) || (toStorageId && storageSiteIds.includes(toStorageId));
      const hasConstructionAccess = (toStepSiteId && constructionSiteIds.includes(toStepSiteId)) || (toSiteId && constructionSiteIds.includes(toSiteId));
      if (!hasStorageAccess && !hasConstructionAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this transfer'
        });
      }
    }

    res.json({
      success: true,
      data: {
        transfer
      }
    });
    
  } catch (error) {
    console.error('Get transfer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transfer details'
    });
  }
});

// Create transfer (Phase 1: Source manager initiates)
router.post('/transfer', authenticateToken, requirePermission('inventory.update'), async (req, res) => {
  try {
    const { 
      itemId, 
      quantity, 
      toStorageSiteId, 
      toPlantId,
      toConstructionSiteId,
      toConstructionStepId,
      vehicleId, 
      transferImages = [], 
      notes = '',
      expectedDeliveryAt 
    } = req.body;
    
    if (!itemId || !quantity || !vehicleId) {
      return res.status(400).json({
        success: false,
        message: 'Item ID, quantity, and vehicle ID are required'
      });
    }
    
    if (!toStorageSiteId && !toPlantId && !toConstructionSiteId && !toConstructionStepId) {
      return res.status(400).json({
        success: false,
        message: 'At least one destination (storage site, plant, construction site, or construction step) is required'
      });
    }
    
    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Transfer quantity must be positive'
      });
    }
    
    // Get the source inventory item
    const sourceItem = await Inventory.findById(itemId)
      .populate('storageSite', 'name code');
    
    if (!sourceItem) {
      return res.status(404).json({
        success: false,
        message: 'Source inventory item not found'
      });
    }
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedStorageSites.includes(sourceItem.storageSite._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to source storage site'
      });
    }
    
    // Check if sufficient stock is available
    if (quantity > sourceItem.currentStock) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock available for transfer',
        data: {
          requested: quantity,
          available: sourceItem.currentStock
        }
      });
    }
    
    // Get destination (storage site, plant, construction site, or construction step)
    let destinationStorageSite = null;
    let destinationPlant = null;
    let destinationConstructionSite = null;
    let destinationConstructionStep = null;
    
    if (toStorageSiteId) {
      destinationStorageSite = await StorageSite.findById(toStorageSiteId);
      if (!destinationStorageSite) {
        return res.status(404).json({
          success: false,
          message: 'Destination storage site not found'
        });
      }
    }
    
    if (toPlantId) {
      const Plant = require('../models/Plant');
      destinationPlant = await Plant.findById(toPlantId);
      if (!destinationPlant) {
        return res.status(404).json({
          success: false,
          message: 'Destination plant not found'
        });
      }
    }
    
    if (toConstructionSiteId) {
      const Site = require('../models/Site');
      destinationConstructionSite = await Site.findById(toConstructionSiteId);
      if (!destinationConstructionSite) {
        return res.status(404).json({
          success: false,
          message: 'Destination construction site not found'
        });
      }
    }
    
    if (toConstructionStepId) {
      const Step = require('../models/Step');
      destinationConstructionStep = await Step.findById(toConstructionStepId)
        .populate('siteId', 'name siteType');
      if (!destinationConstructionStep) {
        return res.status(404).json({
          success: false,
          message: 'Destination construction step not found'
        });
      }
    }
    
    // Get vehicle details
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }
    
    // Check if vehicle is available
    if (vehicle.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: 'Vehicle is not available for transfer'
      });
    }
    
    // Calculate trip number for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let tripNumber = 1;
    if (vehicle.tripTracking.lastTripDate && 
        vehicle.tripTracking.lastTripDate.toDateString() === today.toDateString()) {
      tripNumber = vehicle.tripTracking.dailyTrips + 1;
    }
    
    // Create transfer record
    const transfer = new InventoryTransfer({
      itemId,
      itemName: sourceItem.itemName,
      category: sourceItem.category,
      unit: sourceItem.unit,
      quantity,
      fromStorageSite: {
        _id: sourceItem.storageSite._id,
        name: sourceItem.storageSite.name,
        code: sourceItem.storageSite.code
      },
      toStorageSite: destinationStorageSite ? {
        _id: destinationStorageSite._id,
        name: destinationStorageSite.name,
        code: destinationStorageSite.code
      } : null,
      toPlant: destinationPlant ? {
        _id: destinationPlant._id,
        name: destinationPlant.name,
        plantType: destinationPlant.plantType
      } : null,
      toConstructionSite: destinationConstructionSite ? {
        _id: destinationConstructionSite._id,
        name: destinationConstructionSite.name,
        code: destinationConstructionSite.code,
        siteType: destinationConstructionSite.siteType
      } : null,
      toConstructionStep: destinationConstructionStep ? {
        _id: destinationConstructionStep._id,
        stepName: destinationConstructionStep.stepName,
        stepNumber: destinationConstructionStep.stepNumber,
        siteId: destinationConstructionStep.siteId._id,
        siteName: destinationConstructionStep.siteId.name,
        siteType: destinationConstructionStep.siteId.siteType
      } : null,
      vehicle: {
        _id: vehicle._id,
        vehicleNumber: vehicle.vehicleNumber,
        vehicleType: vehicle.type,
        driverName: vehicle.assignedTo ? 'Assigned Driver' : undefined,
        driverPhone: undefined
      },
      transferredBy: {
        _id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email
      },
      status: 'in_transit',
      transferImages: transferImages.map(fileId => ({
        fileId,
        uploadedBy: req.user._id,
        uploadedAt: new Date()
      })),
      notes,
      expectedDeliveryAt: expectedDeliveryAt ? new Date(expectedDeliveryAt) : undefined,
      tripDate: today,
      tripNumber
    });
    
    await transfer.save();
    
    // Update vehicle status and trip tracking
    vehicle.status = 'busy';
    vehicle.tripTracking.currentTrip = transfer._id;
    
    if (vehicle.tripTracking.lastTripDate && 
        vehicle.tripTracking.lastTripDate.toDateString() === today.toDateString()) {
      vehicle.tripTracking.dailyTrips += 1;
    } else {
      vehicle.tripTracking.dailyTrips = 1;
      vehicle.tripTracking.lastTripDate = today;
    }
    
    vehicle.tripTracking.totalTrips += 1;
    await vehicle.save();
    
    // Reduce stock from source inventory (but don't add to destination yet)
    sourceItem.currentStock -= quantity;
    
    // Add to transfer history
    let destinationName = '';
    if (destinationStorageSite) {
      destinationName = destinationStorageSite.name;
    } else if (destinationPlant) {
      destinationName = destinationPlant.name;
    } else if (destinationConstructionSite) {
      destinationName = destinationConstructionSite.name;
    } else if (destinationConstructionStep) {
      destinationName = `${destinationConstructionStep.siteId.name} - ${destinationConstructionStep.stepName}`;
    }

    sourceItem.transferHistory.push({
      fromStorageSite: sourceItem.storageSite._id,
      toStorageSite: destinationStorageSite?._id || null,
      toPlant: destinationPlant?._id || null,
      toConstructionSite: destinationConstructionSite?._id || null,
      toConstructionStep: destinationConstructionStep?._id || null,
      quantity,
      transferredBy: req.user._id,
      notes: `Transferred to ${destinationName}: ${notes}`,
      transferId: transfer._id,
      status: 'in_transit'
    });
    
    await sourceItem.save();
    
    res.json({
      success: true,
      message: 'Inventory transfer initiated successfully',
      data: {
        transfer: {
          id: transfer._id,
          itemName: transfer.itemName,
          quantity: transfer.quantity,
          fromStorageSite: transfer.fromStorageSite.name,
          toStorageSite: transfer.toStorageSite?.name || null,
          toPlant: transfer.toPlant?.name || null,
          toConstructionSite: transfer.toConstructionSite?.name || null,
          toConstructionStep: transfer.toConstructionStep?.stepName || null,
          vehicle: transfer.vehicle.vehicleNumber,
          status: transfer.status,
          tripNumber: transfer.tripNumber
        },
        sourceItem: {
          id: sourceItem._id,
          itemName: sourceItem.itemName,
          remainingStock: sourceItem.currentStock,
          storageSite: sourceItem.storageSite.name
        },
        vehicle: {
          id: vehicle._id,
          vehicleNumber: vehicle.vehicleNumber,
          status: vehicle.status,
          dailyTrips: vehicle.tripTracking.dailyTrips,
          totalTrips: vehicle.tripTracking.totalTrips
        }
      }
    });
    
  } catch (error) {
    console.error('Transfer inventory error:', error);
    
    if (error.message === 'Insufficient stock available for transfer') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to initiate inventory transfer'
    });
  }
});

// Receive transfer (Phase 2: Destination manager confirms)
router.post('/receive', authenticateToken, requirePermission('inventory.update'), async (req, res) => {
  try {
    const { 
      transferId, 
      receivedQuantity, 
      receiptImages = [], 
      notes = '' 
    } = req.body;
    
    if (!transferId || !receivedQuantity) {
      return res.status(400).json({
        success: false,
        message: 'Transfer ID and received quantity are required'
      });
    }
    
    const receivedQty = parseFloat(receivedQuantity);
    if (receivedQty <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Received quantity must be positive'
      });
    }
    
    // Get the transfer record
    const transfer = await InventoryTransfer.findById(transferId)
      .populate('itemId', 'itemName category unit storageSite');
    
    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: 'Transfer record not found'
      });
    }
    
    if (transfer.status === 'received') {
      return res.status(400).json({
        success: false,
        message: 'This transfer has already been received'
      });
    }
    
    if (transfer.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot receive a cancelled transfer'
      });
    }
    
    // Check access control for destination (storage site, plant, or construction site/step)
    if (req.user.role !== 'admin') {
      if (transfer.toStorageSite && transfer.toStorageSite._id) {
        if (!req.user.assignedStorageSites.includes(transfer.toStorageSite._id)) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to destination storage site'
          });
        }
      } else if (transfer.toPlant && transfer.toPlant._id) {
        if (!req.user.assignedPlants || !req.user.assignedPlants.includes(transfer.toPlant._id)) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to destination plant'
          });
        }
      } else if (transfer.toConstructionStep && transfer.toConstructionStep._id) {
        const siteId = transfer.toConstructionStep.siteId && (transfer.toConstructionStep.siteId._id || transfer.toConstructionStep.siteId);
        const assignedSites = (req.user.assignedSites || []).map(s => (s && s._id ? s._id : s));
        if (!siteId || !assignedSites.length || !assignedSites.some(s => s.toString() === siteId.toString())) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to destination construction step'
          });
        }
      } else if (transfer.toConstructionSite && transfer.toConstructionSite._id) {
        const siteId = transfer.toConstructionSite._id;
        const assignedSites = (req.user.assignedSites || []).map(s => (s && s._id ? s._id : s));
        if (!assignedSites.length || !assignedSites.some(s => s.toString() === siteId.toString())) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to destination construction site'
          });
        }
      }
    }
    
    // Calculate quantity difference and discrepancy
    const quantityDifference = receivedQty - transfer.quantity;
    const discrepancyPercentage = Math.abs((quantityDifference / transfer.quantity) * 100);
    const hasDiscrepancy = discrepancyPercentage > 5; // 5% tolerance
    
    // Create receipt record
    const receipt = new InventoryTransferReceipt({
      transferId: transfer._id,
      receivedQuantity: receivedQty,
      quantityDifference,
      discrepancyPercentage,
      receivedBy: {
        _id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email
      },
      receiptImages: receiptImages.map(fileId => ({
        fileId,
        uploadedBy: req.user._id,
        uploadedAt: new Date()
      })),
      notes,
      hasDiscrepancy,
      discrepancyReason: hasDiscrepancy ? `Quantity difference: ${quantityDifference} (${discrepancyPercentage.toFixed(2)}%)` : undefined
    });
    
    await receipt.save();
    
    // Update transfer record
    transfer.status = 'received';
    transfer.receivedBy = {
      _id: req.user._id,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      email: req.user.email
    };
    transfer.receivedAt = new Date();
    await transfer.save();
    
    // Add inventory to destination (storage site or plant)
    if (transfer.toStorageSite && transfer.toStorageSite._id) {
      // Handle storage site transfer
      const destinationStorageSite = await StorageSite.findById(transfer.toStorageSite._id);
      
      if (destinationStorageSite) {
        // Check if destination already has this item
        let destinationItem = await Inventory.findOne({
          itemName: transfer.itemName,
          storageSite: transfer.toStorageSite._id,
          isActive: true
        });
        
        if (destinationItem) {
          // Update existing item at destination
          destinationItem.currentStock += receivedQty;
          
          // Add to transfer history
          destinationItem.transferHistory.push({
            fromStorageSite: transfer.fromStorageSite._id,
            toStorageSite: transfer.toStorageSite._id,
            quantity: receivedQty,
            transferredBy: req.user._id,
            notes: `Received from transfer: ${notes}`,
            transferId: transfer._id,
            status: 'received'
          });
          
          await destinationItem.save();
        } else {
          // Create new item at destination
          destinationItem = new Inventory({
            itemName: transfer.itemName,
            category: transfer.category,
            unit: transfer.unit,
            currentStock: receivedQty,
            minimumStock: 0,
            maximumStock: receivedQty * 2, // Set reasonable default
            storageSite: transfer.toStorageSite._id,
            supplier: null,
            lastRestocked: new Date(),
            transferHistory: [{
              fromStorageSite: transfer.fromStorageSite._id,
              toStorageSite: transfer.toStorageSite._id,
              quantity: receivedQty,
              transferredBy: req.user._id,
              notes: `Received from transfer: ${notes}`,
              transferId: transfer._id,
              status: 'received'
            }],
            isActive: true
          });
          
          await destinationItem.save();
        }
      }
    } else if (transfer.toPlant && transfer.toPlant._id) {
      // Handle plant transfer - update plant inventory
      const PlantInventory = require('../models/PlantInventory');
      const plantId = transfer.toPlant._id;
      const fromStorageSiteId = transfer.fromStorageSite && (transfer.fromStorageSite._id || transfer.fromStorageSite);

      // Map storage-site category to PlantInventory category enum (Plant uses different enum; fallback to 'Other')
      const plantCategoryEnum = ['Cement', 'Aggregates', 'Water', 'Admixtures', 'Steel Reinforcement', 'Concrete Mix', 'Tools & Equipment', 'Safety Equipment', 'Other'];
      const categoryForPlant = plantCategoryEnum.includes(transfer.category) ? transfer.category : 'Other';

      // Check if plant already has this item (PlantInventory uses itemName)
      let plantItem = await PlantInventory.findOne({
        itemName: transfer.itemName,
        plant: plantId,
        isActive: true
      });

      if (plantItem) {
        // Update existing plant inventory item
        plantItem.currentStock += receivedQty;

        // Add to transfer history (schema: fromStorageSite, toPlant, quantity, transferredBy, notes, transferId)
        plantItem.transferHistory = plantItem.transferHistory || [];
        plantItem.transferHistory.push({
          fromStorageSite: fromStorageSiteId,
          toPlant: plantId,
          quantity: receivedQty,
          transferredBy: req.user._id,
          notes: `Received from transfer: ${notes}`,
          transferId: transfer._id
        });

        await plantItem.save();
      } else {
        // Create new plant inventory item (itemName, category, materialType required; materialType = raw_material/finished_product/consumable)
        plantItem = new PlantInventory({
          itemName: transfer.itemName,
          category: categoryForPlant,
          materialType: 'raw_material',
          unit: transfer.unit,
          currentStock: receivedQty,
          minimumStock: 0,
          maximumStock: receivedQty * 2,
          plant: plantId,
          supplier: (transfer.supplier && transfer.supplier.name) ? { name: transfer.supplier.name } : undefined,
          lastRestocked: new Date(),
          transferHistory: [{
            fromStorageSite: fromStorageSiteId,
            toPlant: plantId,
            quantity: receivedQty,
            transferredBy: req.user._id,
            notes: `Received from transfer: ${notes}`,
            transferId: transfer._id
          }],
          isActive: true
        });

        await plantItem.save();
      }
    } else if (transfer.toConstructionStep && transfer.toConstructionStep._id) {
      // Create step inventory receipt so it appears in Step Details → View Receipts
      try {
        const stepId = transfer.toConstructionStep._id;
        let resolvedSiteId = transfer.toConstructionStep.siteId && (transfer.toConstructionStep.siteId._id || transfer.toConstructionStep.siteId);
        if (!resolvedSiteId) {
          const Step = require('../models/Step');
          const step = await Step.findById(stepId).select('siteId').lean();
          resolvedSiteId = step && step.siteId;
        }
        if (!resolvedSiteId) {
          console.warn('Receive transfer: could not resolve siteId for step', stepId);
        } else {
          const materialCategory = CATEGORY_TO_STEP_MATERIAL[transfer.category] || 'other';
          const unit = STEP_RECEIPT_UNITS.includes(transfer.unit) ? transfer.unit : 'kg';
          const fromStorageSite = transfer.fromStorageSite && (transfer.fromStorageSite._id || transfer.fromStorageSite);
          const stepReceipt = new StepInventoryReceipt({
            stepId,
            siteId: resolvedSiteId,
            sourceType: 'storage_site',
            sourceId: fromStorageSite,
            sourceName: (transfer.fromStorageSite && transfer.fromStorageSite.name) || 'Storage',
            materialName: transfer.itemName,
            materialCategory,
            materialType: 'primary',
            quantity: receivedQty,
            unit,
            deliveryDate: new Date(),
            deliveryImages: Array.isArray(receiptImages) ? receiptImages : [],
            deliveryNotes: notes || `Received from transfer (ID: ${transfer._id})`,
            receivedBy: {
              _id: req.user._id,
              firstName: req.user.firstName,
              lastName: req.user.lastName,
              email: req.user.email
            },
            receivedAt: new Date(),
            verifiedBy: req.user._id,
            verificationDate: new Date(),
            verificationNotes: `Received from storage: ${(transfer.fromStorageSite && transfer.fromStorageSite.name) || 'Storage'}`,
            status: 'received',
            vehicle: transfer.vehicle && transfer.vehicle._id ? {
              _id: transfer.vehicle._id,
              vehicleNumber: transfer.vehicle.vehicleNumber,
              vehicleType: transfer.vehicle.vehicleType,
              driverName: transfer.vehicle.driverName,
              driverPhone: transfer.vehicle.driverPhone
            } : undefined
          });
          await stepReceipt.save();
        }
      } catch (stepReceiptError) {
        console.error('Error creating step inventory receipt for transfer:', stepReceiptError);
        // Don't fail the receive if step receipt creation fails
      }
    }
    
    // Update vehicle status back to available
    const vehicleId = transfer.vehicle && (transfer.vehicle._id || transfer.vehicle);
    let vehicle = null;
    if (vehicleId) {
      vehicle = await Vehicle.findById(vehicleId);
      if (vehicle) {
        vehicle.status = 'available';
        if (vehicle.tripTracking) vehicle.tripTracking.currentTrip = null;
        await vehicle.save();
      }
    }
    
    // Send alerts if there's a discrepancy
    if (hasDiscrepancy) {
      try {
        await AlertService.createQuantityDiscrepancyAlert({
          transferId: transfer._id,
          itemName: transfer.itemName,
          expectedQuantity: transfer.quantity,
          receivedQuantity: receivedQty,
          quantityDifference,
          discrepancyPercentage,
          fromStorageSite: transfer.fromStorageSite,
          toStorageSite: transfer.toStorageSite,
          transferredBy: transfer.transferredBy,
          receivedBy: receipt.receivedBy
        });
      } catch (alertError) {
        console.error('Error creating discrepancy alert:', alertError);
        // Don't fail the receipt process if alert creation fails
      }
    }

    // Create transfer completion alert
    try {
      await AlertService.createTransferCompletionAlert({
        transferId: transfer._id,
        itemName: transfer.itemName,
        quantity: receivedQty,
        fromStorageSite: transfer.fromStorageSite,
        toStorageSite: transfer.toStorageSite,
        transferredBy: transfer.transferredBy,
        receivedBy: receipt.receivedBy,
        vehicle: transfer.vehicle
      });
    } catch (alertError) {
      console.error('Error creating completion alert:', alertError);
    }

    // Create vehicle trip alert (only if vehicle was loaded)
    try {
      if (vehicle) {
        await AlertService.createVehicleTripAlert({
          vehicleId: vehicle._id,
          vehicleNumber: vehicle.vehicleNumber,
          dailyTrips: (vehicle.tripTracking && vehicle.tripTracking.dailyTrips) || 0,
          totalTrips: (vehicle.tripTracking && vehicle.tripTracking.totalTrips) || 0,
          tripDate: transfer.tripDate
        }, {
        transferId: transfer._id,
        itemName: transfer.itemName,
        quantity: receivedQty,
        fromStorageSite: transfer.fromStorageSite,
        toStorageSite: transfer.toStorageSite,
        receivedBy: receipt.receivedBy
        });
      }
    } catch (alertError) {
      console.error('Error creating vehicle trip alert:', alertError);
    }

    res.json({
      success: true,
      message: 'Transfer received successfully',
      data: {
        transfer: {
          id: transfer._id,
          itemName: transfer.itemName,
          expectedQuantity: transfer.quantity,
          receivedQuantity: receivedQty,
          quantityDifference,
          discrepancyPercentage,
          hasDiscrepancy,
          status: transfer.status
        },
        receipt: {
          id: receipt._id,
          receivedAt: receipt.receivedAt,
          receivedBy: receipt.receivedBy
        },
        vehicle: vehicle ? {
          id: vehicle._id,
          vehicleNumber: vehicle.vehicleNumber,
          status: vehicle.status
        } : null
      }
    });
    
  } catch (error) {
    console.error('Receive transfer error:', error);
    const message = error.message || 'Failed to receive transfer';
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'development' ? message : 'Failed to receive transfer'
    });
  }
});

// Get pending transfers for a storage site
router.get('/pending/:storageSiteId', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    const { storageSiteId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    // Check access control
    if (req.user.role !== 'admin' && !req.user.assignedStorageSites.includes(storageSiteId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this storage site'
      });
    }
    
    const transfers = await InventoryTransfer.find({
      'toStorageSite._id': storageSiteId,
      status: 'in_transit'
    })
      .sort({ transferredAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('transferredBy', 'firstName lastName email')
      .populate('fromStorageSite', 'name code');
    
    const totalCount = await InventoryTransfer.countDocuments({
      'toStorageSite._id': storageSiteId,
      status: 'in_transit'
    });
    
    res.json({
      success: true,
      data: {
        storageSite: {
          id: storageSiteId
        },
        transfers,
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
    console.error('Get pending transfers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending transfers'
    });
  }
});

// Get vehicle trip statistics
router.get('/vehicle-trips/:vehicleId', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { startDate, endDate } = req.query;
    
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }
    
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        tripDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    }
    
    const transfers = await InventoryTransfer.find({
      'vehicle._id': vehicleId,
      ...dateFilter
    })
      .sort({ tripDate: -1, tripNumber: -1 })
      .populate('transferredBy', 'firstName lastName')
      .populate('receivedBy', 'firstName lastName');
    
    const tripStats = {
      vehicle: {
        id: vehicle._id,
        vehicleNumber: vehicle.vehicleNumber,
        vehicleType: vehicle.type,
        status: vehicle.status
      },
      tripTracking: vehicle.tripTracking,
      transfers,
      summary: {
        totalTransfers: transfers.length,
        completedTransfers: transfers.filter(t => t.status === 'received').length,
        pendingTransfers: transfers.filter(t => t.status === 'in_transit').length,
        totalQuantityTransferred: transfers.reduce((sum, t) => sum + t.quantity, 0)
      }
    };
    
    res.json({
      success: true,
      data: tripStats
    });
    
  } catch (error) {
    console.error('Get vehicle trips error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicle trip statistics'
    });
  }
});

// Update transfer status (cancel, dispute, etc.)
router.patch('/:transferId/status', authenticateToken, requirePermission('inventory.update'), async (req, res) => {
  try {
    const { transferId } = req.params;
    const { status, reason } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }
    
    const validStatuses = ['in_transit', 'received', 'disputed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }
    
    const transfer = await InventoryTransfer.findById(transferId);
    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: 'Transfer not found'
      });
    }
    
    // Update transfer status
    transfer.status = status;
    if (reason) {
      transfer.notes = transfer.notes ? `${transfer.notes}\nStatus update: ${reason}` : `Status update: ${reason}`;
    }
    
    await transfer.save();
    
    // If transfer is cancelled or disputed, mark vehicle as available
    if ((status === 'cancelled' || status === 'disputed') && transfer.vehicle) {
      const vehicle = await Vehicle.findById(transfer.vehicle._id);
      if (vehicle) {
        vehicle.status = 'available';
        vehicle.tripTracking.currentTrip = null; // Clear current trip
        await vehicle.save();
        console.log(`Vehicle ${vehicle.vehicleNumber} marked as available (transfer ${status})`);
      }
    }
    
    res.json({
      success: true,
      message: `Transfer status updated to ${status}`,
      data: {
        transfer: {
          id: transfer._id,
          status: transfer.status,
          itemName: transfer.itemName,
          quantity: transfer.quantity
        }
      }
    });
    
  } catch (error) {
    console.error('Update transfer status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update transfer status'
    });
  }
});

module.exports = router;