const express = require('express');
const Inventory = require('../models/Inventory');
const { authenticateToken, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get all inventory items
router.get('/', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      lowStock,
      search
    } = req.query;
    
    // Build query
    let query = { isActive: true };
    
    // Apply filters
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (lowStock === 'true') {
      query.$expr = { $lte: ['$currentStock', '$minimumStock'] };
    }
    
    if (search) {
      query.$or = [
        { itemName: { $regex: search, $options: 'i' } },
        { itemCode: { $regex: search, $options: 'i' } },
        { 'supplier.name': { $regex: search, $options: 'i' } }
      ];
    }
    
    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [items, totalCount, lowStockCount, totalValue] = await Promise.all([
      Inventory.find(query)
        .sort({ itemName: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Inventory.countDocuments(query),
      Inventory.countDocuments({ 
        isActive: true,
        $expr: { $lte: ['$currentStock', '$minimumStock'] }
      }),
      Promise.resolve([{ total: 0 }])
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
          lowStockCount,
          totalValue: totalValue[0]?.total || 0
        }
      }
    });
    
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory items'
    });
  }
});

// Get single inventory item
router.get('/:id', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    res.json({
      success: true,
      data: { item }
    });
    
  } catch (error) {
    console.error('Get inventory item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory item'
    });
  }
});

// Create new inventory item
router.post('/', authenticateToken, requirePermission('inventory.create'), async (req, res) => {
  try {
    const item = new Inventory(req.body);
    await item.save();
    
    res.status(201).json({
      success: true,
      message: 'Inventory item created successfully',
      data: { item }
    });
    
  } catch (error) {
    console.error('Create inventory item error:', error);
    
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
      message: 'Failed to create inventory item'
    });
  }
});

// Restock inventory item
router.post('/:id/restock', authenticateToken, requirePermission('inventory.update'), async (req, res) => {
  try {
    const { quantity, supplier, notes } = req.body;
    
    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }
    

    
    const item = await Inventory.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
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
        restockQuantity: quantity,

      }
    });
    
  } catch (error) {
    console.error('Restock inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restock inventory item'
    });
  }
});

// Consume inventory (use stock)
router.post('/:id/consume', authenticateToken, requirePermission('inventory.update'), async (req, res) => {
  try {
    const { quantity, notes, siteId } = req.body;
    
    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }
    
    const item = await Inventory.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    if (quantity > item.currentStock) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock available',
        data: {
          requested: quantity,
          available: item.currentStock
        }
      });
    }
    
    const previousStock = item.currentStock;
    
    // Use the consume method
    await item.consumeStock(quantity, req.user._id, notes);
    
    res.json({
      success: true,
      message: 'Stock consumed successfully',
      data: {
        itemId: item._id,
        previousStock,
        newStock: item.currentStock,
        consumedQuantity: quantity,
        isLowStock: item.isLowStock
      }
    });
    
  } catch (error) {
    console.error('Consume inventory error:', error);
    
    if (error.message === 'Insufficient stock available') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to consume inventory'
    });
  }
});

// Get low stock items
router.get('/alerts/low-stock', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    const lowStockItems = await Inventory.find({
      isActive: true,
      $expr: { $lte: ['$currentStock', '$minimumStock'] }
    }).sort({ currentStock: 1 });
    
    res.json({
      success: true,
      data: {
        items: lowStockItems,
        count: lowStockItems.length
      }
    });
    
  } catch (error) {
    console.error('Get low stock items error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch low stock items'
    });
  }
});

// Get inventory categories
router.get('/meta/categories', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    // Return the valid categories from the model schema
    const validCategories = [
      'Building Materials',
      'Steel Products',
      'Safety Equipment',
      'Tools & Equipment',
      'Electrical Supplies',
      'Plumbing Supplies',
      'Finishing Materials',
      'Hardware',
      'Other'
    ];
    
    res.json({
      success: true,
      data: { categories: validCategories }
    });
    
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories'
    });
  }
});

// Update inventory stock levels (specific route before general /:id)
router.put('/:id/stock', authenticateToken, requirePermission('inventory.update'), async (req, res) => {
  try {
    const { currentStock, minimumStock } = req.body;
    
    const item = await Inventory.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    if (currentStock !== undefined) {
      if (currentStock < 0) {
        return res.status(400).json({
          success: false,
          message: 'Current stock cannot be negative'
        });
      }
      item.currentStock = currentStock;
    }
    
    if (minimumStock !== undefined) {
      if (minimumStock < 0) {
        return res.status(400).json({
          success: false,
          message: 'Minimum stock cannot be negative'
        });
      }
      item.minimumStock = minimumStock;
    }
    
    await item.save();
    
    res.json({
      success: true,
      message: 'Stock levels updated successfully',
      data: {
        itemId: item._id,
        currentStock: item.currentStock,
        minimumStock: item.minimumStock,
        isLowStock: item.isLowStock
      }
    });
    
  } catch (error) {
    console.error('Update stock levels error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update stock levels'
    });
  }
});



// Update inventory supplier (specific route before general /:id)
router.put('/:id/supplier', authenticateToken, requirePermission('inventory.update'), async (req, res) => {
  try {
    const { supplier } = req.body;
    
    if (!supplier || !supplier.name) {
      return res.status(400).json({
        success: false,
        message: 'Supplier name is required'
      });
    }
    
    const item = await Inventory.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    item.supplier = supplier;
    await item.save();
    
    res.json({
      success: true,
      message: 'Supplier updated successfully',
      data: {
        itemId: item._id,
        supplier: item.supplier
      }
    });
    
  } catch (error) {
    console.error('Update supplier error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update supplier'
    });
  }
});

// Update inventory item (general route - must come after specific routes)
router.put('/:id', authenticateToken, requirePermission('inventory.update'), async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
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
    console.error('Update inventory item error:', error);
    
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
      message: 'Failed to update inventory item'
    });
  }
});

// Delete inventory item (soft delete)
router.delete('/:id', authenticateToken, requirePermission('inventory.delete'), async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    item.isActive = false;
    await item.save();
    
    res.json({
      success: true,
      message: 'Inventory item deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete inventory item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete inventory item'
    });
  }
});

module.exports = router;