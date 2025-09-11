const express = require('express');
const router = express.Router();
const StorageYardInventory = require('../models/StorageYardInventory');
const Location = require('../models/Location');
const { authenticateToken, requirePermission, requireAdmin } = require('../middleware/auth');

// @route   GET /api/storage-yard-inventory
// @desc    Get all storage yard inventory items with optional filtering
// @access  Private (Admin, Inventory Manager)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      storageYardId,
      category, 
      lowStock, 
      search,
      page = 1, 
      limit = 10
    } = req.query;

    // Build filter object
    const filter = { isActive: true };
    
    if (storageYardId) filter.storageYardId = storageYardId;
    if (category) filter.category = category;
    if (lowStock === 'true') {
      filter.$expr = { $lte: ['$currentStock', '$minimumStock'] };
    }
    if (search) {
      filter.$or = [
        { itemName: new RegExp(search, 'i') },
        { itemCode: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }

    // Check user permissions for storage yard access
    if (req.user.role === 'inventory_manager' && storageYardId) {
      const storageYard = await Location.findById(storageYardId);
      if (storageYard) {
        const hasAccess = storageYard.assignedInventoryManagers.some(
          manager => manager.user.toString() === req.user._id.toString()
        );
        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to this storage yard'
          });
        }
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [items, totalCount, lowStockCount] = await Promise.all([
      StorageYardInventory.find(filter)
        .populate('storageYardId', 'name code type address')
        .sort({ itemName: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      StorageYardInventory.countDocuments(filter),
      StorageYardInventory.countDocuments({ 
        isActive: true,
        $expr: { $lte: ['$currentStock', '$minimumStock'] }
      })
    ]);

    res.json({
      success: true,
      data: {
        items,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + items.length < totalCount,
          hasPrev: parseInt(page) > 1
        },
        summary: {
          lowStockCount
        }
      }
    });
  } catch (error) {
    console.error('Error fetching storage yard inventory:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// @route   GET /api/storage-yard-inventory/:id
// @desc    Get single storage yard inventory item
// @access  Private (Admin, Inventory Manager)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const item = await StorageYardInventory.findById(req.params.id)
      .populate('storageYardId', 'name code type address')
      .populate('restockHistory.restockedBy', 'firstName lastName')
      .populate('transferHistory.transferredBy', 'firstName lastName');
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    // Check if user has access to this storage yard
    if (req.user.role === 'inventory_manager') {
      const hasAccess = item.storageYardId.assignedInventoryManagers.some(
        manager => manager.user.toString() === req.user._id.toString()
      );
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this storage yard'
        });
      }
    }
    
    res.json({
      success: true,
      data: { item }
    });
  } catch (error) {
    console.error('Error fetching inventory item:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/storage-yard-inventory
// @desc    Create new storage yard inventory item
// @access  Private (Admin, Inventory Manager)
router.post('/', authenticateToken, requirePermission('inventory.create'), async (req, res) => {
  try {
    const item = new StorageYardInventory(req.body);
    await item.save();
    
    // Populate the response
    await item.populate('storageYardId', 'name code type address');
    
    res.status(201).json({
      success: true,
      message: 'Inventory item created successfully',
      data: { item }
    });
  } catch (error) {
    console.error('Error creating inventory item:', error);
    
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
        message: 'Item code already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/storage-yard-inventory/:id
// @desc    Update storage yard inventory item
// @access  Private (Admin, Inventory Manager)
router.put('/:id', authenticateToken, requirePermission('inventory.update'), async (req, res) => {
  try {
    const item = await StorageYardInventory.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    // Check if user has access to this storage yard
    if (req.user.role === 'inventory_manager') {
      const storageYard = await Location.findById(item.storageYardId);
      const hasAccess = storageYard.assignedInventoryManagers.some(
        manager => manager.user.toString() === req.user._id.toString()
      );
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this storage yard'
        });
      }
    }
    
    // Update item fields
    Object.assign(item, req.body);
    await item.save();
    
    res.json({
      success: true,
      message: 'Inventory item updated successfully',
      data: { item }
    });
  } catch (error) {
    console.error('Error updating inventory item:', error);
    
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
        message: 'Item code already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/storage-yard-inventory/:id/restock
// @desc    Restock storage yard inventory item
// @access  Private (Admin, Inventory Manager)
router.post('/:id/restock', authenticateToken, requirePermission('inventory.update'), async (req, res) => {
  try {
    const { quantity, supplier, notes } = req.body;
    
    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }
    
    const item = await StorageYardInventory.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    // Check if user has access to this storage yard
    if (req.user.role === 'inventory_manager') {
      const storageYard = await Location.findById(item.storageYardId);
      const hasAccess = storageYard.assignedInventoryManagers.some(
        manager => manager.user.toString() === req.user._id.toString()
      );
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this storage yard'
        });
      }
    }
    
    const previousStock = item.currentStock;
    
    // Use the restock method
    await item.restock(quantity, supplier || item.supplier.name, req.user._id, notes);
    
    res.json({
      success: true,
      message: 'Inventory restocked successfully',
      data: {
        itemId: item._id,
        previousStock,
        newStock: item.currentStock,
        restockQuantity: quantity
      }
    });
  } catch (error) {
    console.error('Error restocking inventory:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/storage-yard-inventory/:id/transfer
// @desc    Transfer inventory from storage yard to construction site
// @access  Private (Admin, Inventory Manager)
router.post('/:id/transfer', authenticateToken, requirePermission('inventory.update'), async (req, res) => {
  try {
    const { quantity, toLocation, notes } = req.body;
    
    if (!quantity || quantity <= 0 || !toLocation) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity and destination location are required'
      });
    }
    
    const item = await StorageYardInventory.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    // Check if user has access to this storage yard
    if (req.user.role === 'inventory_manager') {
      const storageYard = await Location.findById(item.storageYardId);
      const hasAccess = storageYard.assignedInventoryManagers.some(
        manager => manager.user.toString() === req.user._id.toString()
      );
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this storage yard'
        });
      }
    }
    
    const previousStock = item.currentStock;
    
    // Use the transfer method
    await item.transferStock(quantity, toLocation, req.user._id, notes);
    
    res.json({
      success: true,
      message: 'Inventory transferred successfully',
      data: {
        itemId: item._id,
        previousStock,
        newStock: item.currentStock,
        transferredQuantity: quantity,
        toLocation
      }
    });
  } catch (error) {
    console.error('Error transferring inventory:', error);
    
    if (error.message === 'Insufficient stock available') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/storage-yard-inventory/alerts/low-stock
// @desc    Get low stock items across all storage yards
// @access  Private (Admin, Inventory Manager)
router.get('/alerts/low-stock', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    const lowStockItems = await StorageYardInventory.find({
      isActive: true,
      $expr: { $lte: ['$currentStock', '$minimumStock'] }
    })
    .populate('storageYardId', 'name code type address')
    .sort({ currentStock: 1 });
    
    res.json({
      success: true,
      data: {
        items: lowStockItems,
        count: lowStockItems.length
      }
    });
  } catch (error) {
    console.error('Error fetching low stock items:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/storage-yard-inventory/categories
// @desc    Get available inventory categories
// @access  Private
router.get('/meta/categories', authenticateToken, async (req, res) => {
  try {
    const categories = [
      'Cement & Concrete',
      'Steel & Reinforcement',
      'Aggregates',
      'Bricks & Blocks',
      'Tools & Equipment',
      'Safety Equipment',
      'Electrical Materials',
      'Plumbing Materials',
      'Finishing Materials',
      'Other'
    ];
    
    res.json({
      success: true,
      data: { categories }
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/storage-yard-inventory/:id
// @desc    Delete storage yard inventory item (soft delete)
// @access  Private (Admin, Inventory Manager)
router.delete('/:id', authenticateToken, requirePermission('inventory.delete'), async (req, res) => {
  try {
    const item = await StorageYardInventory.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    // Check if user has access to this storage yard
    if (req.user.role === 'inventory_manager') {
      const storageYard = await Location.findById(item.storageYardId);
      const hasAccess = storageYard.assignedInventoryManagers.some(
        manager => manager.user.toString() === req.user._id.toString()
      );
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this storage yard'
        });
      }
    }
    
    item.isActive = false;
    await item.save();
    
    res.json({
      success: true,
      message: 'Inventory item deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
