const express = require('express');
const Inventory = require('../models/Inventory');
const StorageSite = require('../models/StorageSite');
const { authenticateToken, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Transfer inventory between storage sites
router.post('/transfer', authenticateToken, requirePermission('inventory.update'), async (req, res) => {
  try {
    const { 
      itemId, 
      toStorageSiteId, 
      quantity, 
      notes = '' 
    } = req.body;
    
    if (!itemId || !toStorageSiteId || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Item ID, destination storage site ID, and quantity are required'
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
    
    // Get the destination storage site
    const destinationStorageSite = await StorageSite.findById(toStorageSiteId);
    
    if (!destinationStorageSite) {
      return res.status(404).json({
        success: false,
        message: 'Destination storage site not found'
      });
    }
    
    // Check access control for destination storage site
    if (req.user.role !== 'admin' && !req.user.assignedStorageSites.includes(toStorageSiteId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to destination storage site'
      });
    }
    
    // Check if source and destination are the same
    if (sourceItem.storageSite._id.toString() === toStorageSiteId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot transfer to the same storage site'
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
    
    // Check if destination already has this item
    let destinationItem = await Inventory.findOne({
      itemName: sourceItem.itemName,
      storageSite: toStorageSiteId,
      isActive: true
    });
    
    if (destinationItem) {
      // Update existing item at destination
      destinationItem.currentStock += quantity;
      
      // Add to transfer history
      destinationItem.transferHistory.push({
        fromStorageSite: sourceItem.storageSite._id,
        toStorageSite: toStorageSiteId,
        quantity,
        transferredBy: req.user._id,
        notes: `Received from ${sourceItem.storageSite.name}: ${notes}`
      });
      
      await destinationItem.save();
    } else {
      // Create new item at destination
      destinationItem = new Inventory({
        itemName: sourceItem.itemName,
        category: sourceItem.category,
        description: sourceItem.description,
        unit: sourceItem.unit,
        currentStock: quantity,
        minimumStock: sourceItem.minimumStock,
        maximumStock: sourceItem.maximumStock,
        supplier: sourceItem.supplier,
        storageSite: toStorageSiteId,
        transferHistory: [{
          fromStorageSite: sourceItem.storageSite._id,
          toStorageSite: toStorageSiteId,
          quantity,
          transferredBy: req.user._id,
          notes: `Transferred from ${sourceItem.storageSite.name}: ${notes}`
        }]
      });
      
      await destinationItem.save();
    }
    
    // Update source item
    await sourceItem.transferToStorageSite(toStorageSiteId, quantity, req.user._id, notes);
    
    res.json({
      success: true,
      message: 'Inventory transferred successfully',
      data: {
        sourceItem: {
          id: sourceItem._id,
          itemName: sourceItem.itemName,
          remainingStock: sourceItem.currentStock,
          storageSite: sourceItem.storageSite.name
        },
        destinationItem: {
          id: destinationItem._id,
          itemName: destinationItem.itemName,
          newStock: destinationItem.currentStock,
          storageSite: destinationStorageSite.name
        },
        transferQuantity: quantity
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
    
    if (error.message === 'Cannot transfer to the same storage site') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to transfer inventory'
    });
  }
});

// Get transfer history for an inventory item
router.get('/item/:itemId/history', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const item = await Inventory.findById(req.params.itemId)
      .populate('storageSite', 'name code')
      .populate('transferHistory.fromStorageSite', 'name code')
      .populate('transferHistory.toStorageSite', 'name code')
      .populate('transferHistory.transferredBy', 'firstName lastName email');
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    // Check access control
    if (req.user.role !== 'admin' && !req.user.assignedStorageSites.includes(item.storageSite._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this inventory item'
      });
    }
    
    // Paginate transfer history
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const transferHistory = item.transferHistory
      .sort((a, b) => new Date(b.transferredAt) - new Date(a.transferredAt))
      .slice(skip, skip + parseInt(limit));
    
    res.json({
      success: true,
      data: {
        item: {
          _id: item._id,
          itemName: item.itemName,
          currentStorageSite: item.storageSite
        },
        transferHistory,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(item.transferHistory.length / parseInt(limit)),
          totalCount: item.transferHistory.length,
          hasNext: skip + transferHistory.length < item.transferHistory.length,
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

// Get transfer history for a storage site
router.get('/storage-site/:storageSiteId/history', authenticateToken, requirePermission('storage_site.read'), async (req, res) => {
  try {
    const { page = 1, limit = 10, type = 'all' } = req.query; // type: 'incoming', 'outgoing', 'all'
    
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
    
    // Build query based on transfer type
    let matchQuery = { isActive: true };
    
    if (type === 'incoming') {
      matchQuery['transferHistory.toStorageSite'] = storageSite._id;
    } else if (type === 'outgoing') {
      matchQuery['transferHistory.fromStorageSite'] = storageSite._id;
    } else {
      matchQuery.$or = [
        { 'transferHistory.toStorageSite': storageSite._id },
        { 'transferHistory.fromStorageSite': storageSite._id }
      ];
    }
    
    const items = await Inventory.find(matchQuery)
      .populate('storageSite', 'name code')
      .populate('transferHistory.fromStorageSite', 'name code')
      .populate('transferHistory.toStorageSite', 'name code')
      .populate('transferHistory.transferredBy', 'firstName lastName email')
      .select('itemName storageSite transferHistory');
    
    // Flatten and filter transfer history
    let allTransfers = [];
    items.forEach(item => {
      item.transferHistory.forEach(transfer => {
        if (type === 'all' || 
            (type === 'incoming' && transfer.toStorageSite._id.toString() === storageSite._id.toString()) ||
            (type === 'outgoing' && transfer.fromStorageSite._id.toString() === storageSite._id.toString())) {
          allTransfers.push({
            _id: transfer._id,
            itemName: item.itemName,
            fromStorageSite: transfer.fromStorageSite,
            toStorageSite: transfer.toStorageSite,
            quantity: transfer.quantity,
            transferredBy: transfer.transferredBy,
            transferredAt: transfer.transferredAt,
            notes: transfer.notes
          });
        }
      });
    });
    
    // Sort by date (newest first)
    allTransfers.sort((a, b) => new Date(b.transferredAt) - new Date(a.transferredAt));
    
    // Paginate
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedTransfers = allTransfers.slice(skip, skip + parseInt(limit));
    
    res.json({
      success: true,
      data: {
        storageSite: {
          _id: storageSite._id,
          name: storageSite.name,
          code: storageSite.code
        },
        transfers: paginatedTransfers,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(allTransfers.length / parseInt(limit)),
          totalCount: allTransfers.length,
          hasNext: skip + paginatedTransfers.length < allTransfers.length,
          hasPrev: parseInt(page) > 1
        }
      }
    });
    
  } catch (error) {
    console.error('Get storage site transfer history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch storage site transfer history'
    });
  }
});

module.exports = router;
