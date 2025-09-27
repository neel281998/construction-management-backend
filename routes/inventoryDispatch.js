const express = require('express');
const Inventory = require('../models/Inventory');
const InventoryDispatch = require('../models/InventoryDispatch');
const InventoryReceipt = require('../models/InventoryReceipt');
const StorageSite = require('../models/StorageSite');
const Vehicle = require('../models/Vehicle');
const Site = require('../models/Site');
const { authenticateToken, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get all dispatch history (for admin or managers with access)
router.get('/', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
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
      query['fromStorageSite._id'] = { $in: assignedSites };
    }
    
    // Filter by status if provided
    if (status) {
      query.status = status;
    }
    
    const dispatches = await InventoryDispatch.find(query)
      .sort({ dispatchedAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('dispatchedBy', 'firstName lastName email')
      .populate('receivedBy', 'firstName lastName email');
    
    const totalCount = await InventoryDispatch.countDocuments(query);
    
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
    console.error('Get dispatch history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dispatch history'
    });
  }
});

// Dispatch inventory
router.post('/dispatch', authenticateToken, requirePermission('inventory.update'), async (req, res) => {
  try {
    const { 
      itemId, 
      quantity, 
      destinationType, 
      destinationId, 
      vehicleId, 
      expectedDeliveryAt, 
      notes = '' 
    } = req.body;
    
    if (!itemId || !quantity || !destinationType || !destinationId || !vehicleId) {
      return res.status(400).json({
        success: false,
        message: 'Item ID, quantity, destination type, destination ID, and vehicle ID are required'
      });
    }
    
    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Dispatch quantity must be positive'
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
        message: 'Insufficient stock available for dispatch',
        data: {
          requested: quantity,
          available: sourceItem.currentStock
        }
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
    } else if (destinationType === 'storage_site') {
      const storageSite = await StorageSite.findById(destinationId);
      if (!storageSite) {
        return res.status(404).json({
          success: false,
          message: 'Storage site not found'
        });
      }
      destinationName = storageSite.name;
    } else if (destinationType === 'construction_step') {
      // For construction steps, we'll need to get the step details
      // This would require additional logic to fetch step information
      destinationName = `Construction Step ${destinationId}`;
    } else if (destinationType === 'plant') {
      const Plant = require('../models/Plant');
      const plant = await Plant.findById(destinationId);
      if (!plant) {
        return res.status(404).json({
          success: false,
          message: 'Plant not found'
        });
      }
      destinationName = plant.name;
      destinationDetails = { plantType: plant.plantType };
    }
    
    // Get vehicle details
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }
    
    // Create dispatch record
    const dispatch = new InventoryDispatch({
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
      destination: {
        type: destinationType,
        id: destinationId,
        name: destinationName,
        details: destinationDetails
      },
      vehicle: {
        _id: vehicle._id,
        vehicleNumber: vehicle.vehicleNumber,
        vehicleType: vehicle.vehicleType,
        driverName: vehicle.driverName,
        driverPhone: vehicle.driverPhone
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
    
    await dispatch.save();
    
    // Reduce stock from source inventory
    sourceItem.currentStock -= quantity;
    
    // Add to transfer history
    sourceItem.transferHistory.push({
      fromStorageSite: sourceItem.storageSite._id,
      toStorageSite: destinationType === 'storage_site' ? destinationId : null,
      quantity,
      transferredBy: req.user._id,
      notes: `Dispatched to ${destinationName}: ${notes}`,
      dispatchId: dispatch._id
    });
    
    await sourceItem.save();
    
    res.json({
      success: true,
      message: 'Inventory dispatched successfully',
      data: {
        dispatch: {
          id: dispatch._id,
          itemName: dispatch.itemName,
          quantity: dispatch.quantity,
          destination: dispatch.destination.name,
          vehicle: dispatch.vehicle.vehicleNumber,
          status: dispatch.status
        },
        sourceItem: {
          id: sourceItem._id,
          itemName: sourceItem.itemName,
          remainingStock: sourceItem.currentStock,
          storageSite: sourceItem.storageSite.name
        }
      }
    });
    
  } catch (error) {
    console.error('Dispatch inventory error:', error);
    
    if (error.message === 'Insufficient stock available for dispatch') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to dispatch inventory'
    });
  }
});

// Receive inventory transfer (for the new transfer system)
router.post('/receive-transfer', authenticateToken, requirePermission('inventory.update'), async (req, res) => {
  try {
    console.log('Receive transfer request body:', req.body);
    const { 
      transferId, 
      receivedQuantity, 
      deliveryImages = [], 
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
    const InventoryTransfer = require('../models/InventoryTransfer');
    const transfer = await InventoryTransfer.findById(transferId);
    
    console.log('Found transfer:', transfer ? {
      id: transfer._id,
      itemName: transfer.itemName,
      status: transfer.status,
      toPlant: transfer.toPlant,
      toStorageSite: transfer.toStorageSite
    } : 'Not found');
    
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
    
    // Check if received quantity exceeds transfer quantity
    if (receivedQty > transfer.quantity) {
      return res.status(400).json({
        success: false,
        message: `Received quantity (${receivedQty}) cannot exceed transfer quantity (${transfer.quantity})`
      });
    }
    
    // Update transfer record
    transfer.status = 'received';
    transfer.receivedBy = {
      _id: req.user._id,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      email: req.user.email
    };
    transfer.receivedAt = new Date();
    // Note: receivedQuantity field doesn't exist in model, we'll track this in notes
    transfer.notes = transfer.notes ? `${transfer.notes}\nReceived: ${receivedQty} ${transfer.unit} on ${new Date().toISOString()}` : `Received: ${receivedQty} ${transfer.unit} on ${new Date().toISOString()}`;
    // Note: receiptImages field doesn't exist, we'll add to transferImages if needed
    if (deliveryImages && deliveryImages.length > 0) {
      transfer.transferImages = transfer.transferImages || [];
      transfer.transferImages.push(...deliveryImages.map(fileId => ({
        fileId,
        uploadedBy: req.user._id,
        uploadedAt: new Date()
      })));
    }
    
    await transfer.save();
    
    // Check if this is an outgoing transfer (from storage site to plant only)
    // Storage site to storage site transfers are NOT outgoing transfers
    const isOutgoingTransfer = transfer.fromStorageSite && transfer.toPlant && !transfer.toStorageSite;
    console.log('Is outgoing transfer:', isOutgoingTransfer);
    
    // Mark vehicle as available again since transfer is completed
    const Vehicle = require('../models/Vehicle');
    const vehicle = await Vehicle.findById(transfer.vehicle._id);
    if (vehicle) {
      vehicle.status = 'available';
      vehicle.tripTracking.currentTrip = null; // Clear current trip
      await vehicle.save();
      console.log(`Vehicle ${vehicle.vehicleNumber} marked as available`);
    }
    
    // Reduce inventory from source storage site (only for incoming transfers)
    if (transfer.fromStorageSite && transfer.fromStorageSite._id && !isOutgoingTransfer) {
      console.log('Reducing inventory from source storage site:', transfer.fromStorageSite._id);
      const sourceItem = await require('../models/Inventory').findOne({
        itemName: transfer.itemName,
        storageSite: transfer.fromStorageSite._id,
        isActive: true
      });
      
      if (sourceItem) {
        console.log('Found source inventory item:', {
          itemName: sourceItem.itemName,
          currentStock: sourceItem.currentStock,
          transferQty: receivedQty,
          newStock: sourceItem.currentStock - receivedQty
        });
        
        if (sourceItem.currentStock >= receivedQty) {
          sourceItem.currentStock -= receivedQty;
          
          // Update existing transfer history entry
          const existingTransferIndex = sourceItem.transferHistory.findIndex(
            entry => entry.transferId && entry.transferId.toString() === transfer._id.toString()
          );
          
          if (existingTransferIndex !== -1) {
            sourceItem.transferHistory[existingTransferIndex].status = 'delivered';
            sourceItem.transferHistory[existingTransferIndex].deliveredAt = new Date();
            sourceItem.transferHistory[existingTransferIndex].deliveredBy = req.user._id;
            console.log('Updated source transfer history entry');
          }
          
          await sourceItem.save();
          console.log('Source inventory reduced successfully');
        } else {
          console.log('Insufficient stock at source for transfer');
          return res.status(400).json({
            success: false,
            message: 'Insufficient stock at source storage site'
          });
        }
      } else {
        console.log('Source inventory item not found');
        return res.status(404).json({
          success: false,
          message: 'Source inventory item not found'
        });
      }
    }
    
    // Handle outgoing transfers - update source transfer history without reducing inventory
    if (isOutgoingTransfer && transfer.fromStorageSite && transfer.fromStorageSite._id) {
      console.log('Processing outgoing transfer - updating source transfer history');
      const sourceItem = await require('../models/Inventory').findOne({
        itemName: transfer.itemName,
        storageSite: transfer.fromStorageSite._id,
        isActive: true
      });
      
      if (sourceItem) {
        // Update existing transfer history entry
        const existingTransferIndex = sourceItem.transferHistory.findIndex(
          entry => entry.transferId && entry.transferId.toString() === transfer._id.toString()
        );
        
        if (existingTransferIndex !== -1) {
          sourceItem.transferHistory[existingTransferIndex].status = 'delivered';
          sourceItem.transferHistory[existingTransferIndex].deliveredAt = new Date();
          sourceItem.transferHistory[existingTransferIndex].deliveredBy = req.user._id;
          console.log('Updated outgoing transfer history entry');
          await sourceItem.save();
        } else {
          console.log('Outgoing transfer history entry not found');
        }
      }
    }
    
    // Add inventory to destination based on transfer type
    console.log('Transfer details:', {
      toPlant: transfer.toPlant,
      toStorageSite: transfer.toStorageSite,
      fromStorageSite: transfer.fromStorageSite,
      itemName: transfer.itemName,
      quantity: transfer.quantity
    });
    
    // Validate transfer data
    if (!transfer.itemName || !transfer.quantity) {
      console.log('Invalid transfer data:', { itemName: transfer.itemName, quantity: transfer.quantity });
      return res.status(400).json({
        success: false,
        message: 'Invalid transfer data - missing item name or quantity'
      });
    }
    
    if (transfer.toPlant) {
      console.log('Processing plant transfer to:', transfer.toPlant._id);
      const PlantInventory = require('../models/PlantInventory');
      const destinationPlant = await require('../models/Plant').findById(transfer.toPlant._id);
      console.log('Found destination plant:', destinationPlant ? destinationPlant.name : 'Not found');
      
      if (destinationPlant) {
        // Check if destination already has this item
        let destinationItem = await PlantInventory.findOne({
          itemName: transfer.itemName,
          plant: transfer.toPlant._id,
          isActive: true
        });
        
        if (destinationItem) {
          // Update existing item at destination
          destinationItem.currentStock += receivedQty;
          
          // Update existing transfer history entry instead of adding new one
          const existingTransferIndex = destinationItem.transferHistory.findIndex(
            entry => entry.transferId && entry.transferId.toString() === transfer._id.toString()
          );
          
          if (existingTransferIndex !== -1) {
            // Update existing entry
            destinationItem.transferHistory[existingTransferIndex].status = 'delivered';
            destinationItem.transferHistory[existingTransferIndex].receivedAt = new Date();
            destinationItem.transferHistory[existingTransferIndex].receivedBy = req.user._id;
            console.log('Updated existing plant transfer history entry');
          } else {
            // Add new entry if not found (fallback)
            destinationItem.transferHistory.push({
              fromStorageSite: transfer.fromStorageSite._id,
              toPlant: transfer.toPlant._id,
              quantity: receivedQty,
              transferredBy: req.user._id,
              notes: `Received from transfer: ${notes}`,
              transferId: transfer._id,
              status: 'delivered'
            });
            console.log('Added new plant transfer history entry');
          }
          
          await destinationItem.save();
        } else {
          // Create new item at destination
          // Map category to valid PlantInventory category
          const mapCategory = (category) => {
            const categoryMap = {
              'Building Materials': 'Other',
              'Steel Products': 'Steel Reinforcement',
              'Safety Equipment': 'Safety Equipment',
              'Tools & Equipment': 'Tools & Equipment',
              'Electrical Supplies': 'Other',
              'Plumbing Supplies': 'Other',
              'Finishing Materials': 'Other',
              'Hardware': 'Other',
              'Other': 'Other'
            };
            const mappedCategory = categoryMap[category] || 'Other';
            console.log(`Mapping category: ${category} -> ${mappedCategory}`);
            return mappedCategory;
          };

          const plantInventoryData = {
            itemName: transfer.itemName,
            category: mapCategory(transfer.category),
            unit: transfer.unit,
            materialType: 'raw_material', // Default for received items
            currentStock: receivedQty,
            minimumStock: 0, // Default minimum stock
            maximumStock: 1000, // Default maximum stock
            plant: transfer.toPlant._id,
            transferHistory: [{
              fromStorageSite: transfer.fromStorageSite._id,
              toPlant: transfer.toPlant._id,
              quantity: receivedQty,
              transferredBy: req.user._id,
              notes: `Received from transfer: ${notes}`,
              transferId: transfer._id,
              status: 'delivered'
            }]
          };

          console.log('Creating PlantInventory with data:', plantInventoryData);
          destinationItem = new PlantInventory(plantInventoryData);
          
          await destinationItem.save();
          console.log('PlantInventory created successfully');
        }
      }
    } else if (transfer.toStorageSite) {
      console.log('Processing storage site transfer to:', transfer.toStorageSite._id);
      try {
        const destinationStorageSite = await require('../models/StorageSite').findById(transfer.toStorageSite._id);
        console.log('Found destination storage site:', destinationStorageSite ? destinationStorageSite.name : 'Not found');
      
      if (destinationStorageSite) {
        // Check if destination already has this item
        let destinationItem = await require('../models/Inventory').findOne({
          itemName: transfer.itemName,
          storageSite: transfer.toStorageSite._id,
          isActive: true
        });
        
        console.log('Searching for inventory item:', {
          itemName: transfer.itemName,
          storageSite: transfer.toStorageSite._id,
          found: !!destinationItem
        });
        
        if (destinationItem) {
          // Update existing item at destination
          console.log('Found existing inventory item:', {
            itemName: destinationItem.itemName,
            currentStock: destinationItem.currentStock,
            receivedQty: receivedQty,
            newStock: destinationItem.currentStock + receivedQty
          });
          destinationItem.currentStock += receivedQty;
          
          // Update existing transfer history entry instead of adding new one
          const existingTransferIndex = destinationItem.transferHistory.findIndex(
            entry => entry.transferId && entry.transferId.toString() === transfer._id.toString()
          );
          
          if (existingTransferIndex !== -1) {
            // Update existing entry
            destinationItem.transferHistory[existingTransferIndex].status = 'delivered';
            destinationItem.transferHistory[existingTransferIndex].receivedAt = new Date();
            destinationItem.transferHistory[existingTransferIndex].receivedBy = req.user._id;
            console.log('Updated existing transfer history entry');
          } else {
            // Add new entry if not found (fallback)
            destinationItem.transferHistory.push({
              fromStorageSite: transfer.fromStorageSite._id,
              toStorageSite: transfer.toStorageSite._id,
              quantity: receivedQty,
              transferredBy: req.user._id,
              notes: `Received from transfer: ${notes}`,
              transferId: transfer._id,
              status: 'delivered'
            });
            console.log('Added new transfer history entry');
          }
          
          await destinationItem.save();
        } else {
          // Create new item at destination
          destinationItem = new (require('../models/Inventory'))({
            itemName: transfer.itemName,
            category: transfer.category,
            unit: transfer.unit,
            currentStock: receivedQty,
            minimumStock: 0, // Default minimum stock
            maximumStock: 1000, // Default maximum stock
            storageSite: transfer.toStorageSite._id,
            transferHistory: [{
              fromStorageSite: transfer.fromStorageSite._id,
              toStorageSite: transfer.toStorageSite._id,
              quantity: receivedQty,
              transferredBy: req.user._id,
              notes: `Received from transfer: ${notes}`,
              transferId: transfer._id,
              status: 'delivered'
            }]
          });
          
          await destinationItem.save();
        }
      }
      } catch (error) {
        console.error('Storage site transfer error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to process storage site transfer'
        });
      }
    }
    
    res.json({
      success: true,
      message: 'Inventory transfer received successfully',
      data: {
        transfer: {
          id: transfer._id,
          itemName: transfer.itemName,
          receivedQuantity: receivedQty,
          destination: transfer.toPlant?.name || transfer.toStorageSite?.name || 'Unknown',
          status: transfer.status
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
    res.status(500).json({
      success: false,
      message: 'Failed to receive inventory transfer'
    });
  }
});

// Receive inventory (supports partial receiving)
router.post('/receive', authenticateToken, requirePermission('inventory.update'), async (req, res) => {
  try {
    const { 
      dispatchId, 
      receivedQuantity, 
      deliveryImages = [], 
      notes = '' 
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
    const dispatch = await InventoryDispatch.findById(dispatchId)
      .populate('itemId', 'itemName category unit storageSite');
    
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
    const receipt = new InventoryReceipt({
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
      notes
    });
    
    await receipt.save();
    
    // Update dispatch record
    dispatch.receivedQuantity = (dispatch.receivedQuantity || 0) + receivedQty;
    dispatch.remainingQuantity = dispatch.quantity - dispatch.receivedQuantity;
    
    // Update status based on remaining quantity
    if (dispatch.remainingQuantity <= 0) {
      dispatch.status = 'received';
      dispatch.receivedAt = new Date();
    } else {
      dispatch.status = 'partially_received';
    }
    
    await dispatch.save();
    
    // Mark vehicle as available and increment trip count if dispatch is fully received
    if (dispatch.status === 'received' && dispatch.vehicle) {
      const Vehicle = require('../models/Vehicle');
      const { incrementTripCount } = require('../utils/tripTracking');
      
      const vehicle = await Vehicle.findById(dispatch.vehicle._id);
      if (vehicle) {
        // Increment trip count for completed delivery
        await incrementTripCount(vehicle._id, {
          dispatchId: dispatch._id,
          destination: dispatch.destination.type,
          destinationName: dispatch.destination.name,
          completedAt: new Date(),
          notes: `Completed delivery: ${dispatch.itemName}`
        });
        
        // Mark vehicle as available
        vehicle.status = 'available';
        vehicle.tripTracking.currentTrip = null; // Clear current trip
        await vehicle.save();
        
        console.log(`Vehicle ${vehicle.vehicleNumber} marked as available and trip count incremented (dispatch completed)`);
      }
    }
    
    // If destination is a storage site, add inventory there
    if (dispatch.destination.type === 'storage_site') {
      const destinationStorageSite = await StorageSite.findById(dispatch.destination.id);
      
      if (destinationStorageSite) {
        // Check if destination already has this item
        let destinationItem = await Inventory.findOne({
          itemName: dispatch.itemName,
          storageSite: dispatch.destination.id,
          isActive: true
        });
        
        if (destinationItem) {
          // Update existing item at destination
          destinationItem.currentStock += receivedQty;
          
          // Add to transfer history
          destinationItem.transferHistory.push({
            fromStorageSite: dispatch.fromStorageSite._id,
            toStorageSite: dispatch.destination.id,
            quantity: receivedQty,
            transferredBy: req.user._id,
            notes: `Received from dispatch: ${notes}`,
            dispatchId: dispatch._id
          });
          
          await destinationItem.save();
        } else {
          // Create new item at destination
          destinationItem = new Inventory({
            itemName: dispatch.itemName,
            category: dispatch.category,
            unit: dispatch.unit,
            currentStock: receivedQty,
            minimumStock: 0, // Default minimum stock
            maximumStock: 1000, // Default maximum stock
            storageSite: dispatch.destination.id,
            transferHistory: [{
              fromStorageSite: dispatch.fromStorageSite._id,
              toStorageSite: dispatch.destination.id,
              quantity: receivedQty,
              transferredBy: req.user._id,
              notes: `Received from dispatch: ${notes}`,
              dispatchId: dispatch._id
            }]
          });
          
          await destinationItem.save();
        }
      }
    }
    // If destination is a plant, add inventory there
    else if (dispatch.destination.type === 'plant') {
      const PlantInventory = require('../models/PlantInventory');
      const destinationPlant = await Plant.findById(dispatch.destination.id);
      
      if (destinationPlant) {
        // Check if destination already has this item
        let destinationItem = await PlantInventory.findOne({
          itemName: dispatch.itemName,
          plant: dispatch.destination.id,
          isActive: true
        });
        
        if (destinationItem) {
          // Update existing item at destination
          destinationItem.currentStock += receivedQty;
          
          // Add to transfer history
          destinationItem.transferHistory.push({
            fromStorageSite: dispatch.fromStorageSite._id,
            toPlant: dispatch.destination.id,
            quantity: receivedQty,
            transferredBy: req.user._id,
            notes: `Received from dispatch: ${notes}`,
            dispatchId: dispatch._id
          });
          
          await destinationItem.save();
        } else {
          // Create new item at destination
          destinationItem = new PlantInventory({
            itemName: dispatch.itemName,
            category: dispatch.category,
            unit: dispatch.unit,
            materialType: 'raw_material', // Default for received items
            currentStock: receivedQty,
            minimumStock: 0, // Default minimum stock
            maximumStock: 1000, // Default maximum stock
            plant: dispatch.destination.id,
            transferHistory: [{
              fromStorageSite: dispatch.fromStorageSite._id,
              toPlant: dispatch.destination.id,
              quantity: receivedQty,
              transferredBy: req.user._id,
              notes: `Received from dispatch: ${notes}`,
              dispatchId: dispatch._id
            }]
          });
          
          await destinationItem.save();
        }
      }
    }
    
    res.json({
      success: true,
      message: 'Inventory received successfully',
      data: {
        dispatch: {
          id: dispatch._id,
          itemName: dispatch.itemName,
          receivedQuantity: receivedQty,
          destination: dispatch.destination.name,
          status: dispatch.status
        }
      }
    });
    
  } catch (error) {
    console.error('Receive inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to receive inventory'
    });
  }
});

// Get dispatch history for a storage site
router.get('/storage-site/:storageSiteId', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const storageSite = await StorageSite.findById(req.params.storageSiteId);
    
    if (!storageSite) {
      return res.status(404).json({
        success: false,
        message: 'Storage site not found'
      });
    }
    
    // Check access control
    if (req.user.role !== 'admin' && !req.user.assignedStorageSites.includes(storageSite._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this storage site'
      });
    }
    
    // Build query
    let query = { 'fromStorageSite._id': storageSite._id };
    if (status) {
      query.status = status;
    }
    
    const dispatches = await InventoryDispatch.find(query)
      .sort({ dispatchedAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('dispatchedBy', 'firstName lastName email')
      .populate('receivedBy', 'firstName lastName email');
    
    const totalCount = await InventoryDispatch.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        storageSite: {
          _id: storageSite._id,
          name: storageSite.name,
          code: storageSite.code
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
    console.error('Get dispatch history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dispatch history'
    });
  }
});

// Get pending dispatches for a destination
router.get('/pending/:destinationType/:destinationId', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    const { destinationType, destinationId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const query = {
      'destination.type': destinationType,
      'destination.id': destinationId,
      status: { $in: ['dispatched', 'in_transit', 'delivered'] }
    };
    
    const dispatches = await InventoryDispatch.find(query)
      .sort({ dispatchedAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('dispatchedBy', 'firstName lastName email')
      .populate('fromStorageSite', 'name code');
    
    const totalCount = await InventoryDispatch.countDocuments(query);
    
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
    console.error('Get pending dispatches error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending dispatches'
    });
  }
});

// Get pending receipts (query formatted) for flexibility
// Supports: GET /inventory-dispatch/pending-receipts?destinationType=storage_site&destinationId=...&page=1&limit=10
router.get('/pending-receipts', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    const { destinationType, destinationId, page = 1, limit = 10 } = req.query;

    // Query for InventoryDispatch records
    const dispatchQuery = {
      status: { $in: ['dispatched', 'in_transit', 'delivered'] }
    };

    // Query for InventoryTransfer records
    const transferQuery = {
      status: { $in: ['in_transit'] }
    };

    if (destinationType && destinationId) {
      // For InventoryDispatch
      dispatchQuery['destination.type'] = destinationType;
      dispatchQuery['destination.id'] = destinationId;
      
      // For InventoryTransfer - check different destination fields based on type
      if (destinationType === 'storage_site') {
        transferQuery['toStorageSite._id'] = destinationId;
      } else if (destinationType === 'plant') {
        transferQuery['toPlant._id'] = destinationId;
      } else if (destinationType === 'construction_site') {
        transferQuery['toConstructionSite._id'] = destinationId;
      } else if (destinationType === 'construction_step') {
        transferQuery['toConstructionStep._id'] = destinationId;
      }
    } else if (req.user.role !== 'admin') {
      // For non-admins default to assigned storage sites if destination is not provided
      const assignedSites = req.user.assignedStorageSites || [];
      if (assignedSites.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'No storage sites assigned to user'
        });
      }
      dispatchQuery['destination.type'] = 'storage_site';
      dispatchQuery['destination.id'] = { $in: assignedSites.map(s => s.toString()) };
      transferQuery['toStorageSite._id'] = { $in: assignedSites.map(s => s.toString()) };
    }

    // Fetch both types of records
    const [dispatches, transfers] = await Promise.all([
      InventoryDispatch.find(dispatchQuery)
        .sort({ dispatchedAt: -1 })
        .populate('dispatchedBy', 'firstName lastName email')
        .populate('fromStorageSite', 'name code'),
      
      require('../models/InventoryTransfer').find(transferQuery)
        .sort({ createdAt: -1 })
        .populate('transferredBy', 'firstName lastName email')
        .populate('fromStorageSite._id', 'name code')
    ]);

    // Combine and format the results
    const allPendingReceipts = [
      ...dispatches.map(dispatch => ({
        _id: dispatch._id,
        type: 'dispatch',
        itemName: dispatch.itemName,
        quantity: dispatch.quantity,
        unit: dispatch.unit,
        fromStorageSite: dispatch.fromStorageSite,
        destination: dispatch.destination,
        status: dispatch.status,
        dispatchedAt: dispatch.dispatchedAt,
        dispatchedBy: dispatch.dispatchedBy,
        vehicle: dispatch.vehicle,
        notes: dispatch.notes
      })),
      ...transfers.map(transfer => ({
        _id: transfer._id,
        type: 'transfer',
        itemName: transfer.itemName,
        quantity: transfer.quantity,
        unit: transfer.unit,
        fromStorageSite: transfer.fromStorageSite,
        destination: {
          type: transfer.toStorageSite ? 'storage_site' : 
                 transfer.toPlant ? 'plant' :
                 transfer.toConstructionSite ? 'construction_site' :
                 transfer.toConstructionStep ? 'construction_step' : 'unknown',
          id: transfer.toStorageSite?._id || 
              transfer.toPlant?._id || 
              transfer.toConstructionSite?._id || 
              transfer.toConstructionStep?._id,
          name: transfer.toStorageSite?.name || 
                transfer.toPlant?.name || 
                transfer.toConstructionSite?.name || 
                `${transfer.toConstructionStep?.siteName} - ${transfer.toConstructionStep?.stepName}`
        },
        status: transfer.status,
        dispatchedAt: transfer.createdAt, // Use createdAt as dispatchedAt for transfers
        dispatchedBy: transfer.transferredBy,
        vehicle: transfer.vehicle,
        notes: transfer.notes
      }))
    ];

    // Sort combined results by date (newest first)
    allPendingReceipts.sort((a, b) => new Date(b.dispatchedAt) - new Date(a.dispatchedAt));

    // Apply pagination
    const totalCount = allPendingReceipts.length;
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedResults = allPendingReceipts.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        filters: { destinationType, destinationId },
        dispatches: paginatedResults, // Keep the same field name for compatibility
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
    console.error('Get pending receipts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending receipts'
    });
  }
});

// Get receipt history for a dispatch
router.get('/:dispatchId/receipts', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    const { dispatchId } = req.params;
    
    const receipts = await InventoryReceipt.find({ dispatchId })
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
    console.error('Get receipt history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch receipt history'
    });
  }
});

module.exports = router;


