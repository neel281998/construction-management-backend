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
      search,
      storageSiteId
    } = req.query;
    
    // Build query
    let query = { isActive: true };
    
    // Apply storage site access control for non-admin users
    if (req.user.role !== 'admin') {
      const assignedSites = req.user.assignedStorageSites || [];
      if (assignedSites.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'No storage sites assigned to user'
        });
      }
      query.storageSite = { $in: assignedSites };
    }
    // For admin users, no storage site restriction - they can see all items
    
    // Apply filters
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (storageSiteId && storageSiteId !== 'all') {
      // For non-admin users, ensure they can only access assigned storage sites
      if (req.user.role !== 'admin') {
        const assignedSites = req.user.assignedStorageSites || [];
        if (!assignedSites.includes(storageSiteId)) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to this storage site'
          });
        }
      }
      query.storageSite = storageSiteId;
    }
    
    if (lowStock === 'true') {
      query.$expr = { $lte: ['$currentStock', '$minimumStock'] };
    }
    
    if (search) {
      query.$or = [
        { itemName: { $regex: search, $options: 'i' } },
        { 'supplier.name': { $regex: search, $options: 'i' } }
      ];
    }
    
    // Debug logging
    console.log('Inventory query:', JSON.stringify(query, null, 2));
    console.log('User role:', req.user.role);
    console.log('Storage site ID:', storageSiteId);
    
    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [items, totalCount, lowStockCount, totalValue] = await Promise.all([
      Inventory.find(query)
        .populate('storageSite', 'name code')
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
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      query: req.query,
      user: req.user?.role
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory items'
    });
  }
});

// Get single inventory item
router.get('/:id', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id)
      .populate('storageSite', 'name code');
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && item.storageSite && !req.user.assignedStorageSites.includes(item.storageSite._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this inventory item'
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
    console.log('Create inventory request body:', req.body);
    const { storageSite } = req.body;
    
    // Check access control for non-admin users
    if (req.user.role !== 'admin' && !req.user.assignedStorageSites.includes(storageSite)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this storage site'
      });
    }
    
    // Check if item already exists in this storage site
    const existingItem = await Inventory.findOne({
      itemName: req.body.itemName,
      storageSite: storageSite,
      isActive: true
    });
    
    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: 'Item already exists in this storage site'
      });
    }
    
    // Clean up the request body - remove empty itemCode
    const inventoryData = { ...req.body };
    if (!inventoryData.itemCode || inventoryData.itemCode.trim() === '') {
      delete inventoryData.itemCode;
    }
    
    console.log('Creating inventory with data:', inventoryData);
    
    // Create and save the inventory item
    let item;
    try {
      item = new Inventory(inventoryData);
      console.log('Inventory item created:', item);
      
      await item.save();
      console.log('Inventory item saved successfully');
    } catch (modelError) {
      console.error('Model error:', modelError);
      throw modelError;
    }
    
    // Populate storage site for response
    await item.populate('storageSite', 'name code');
    
    res.status(201).json({
      success: true,
      message: 'Inventory item created successfully',
      data: { item }
    });
    
  } catch (error) {
    console.error('Create inventory item error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      errors: error.errors
    });
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid data format',
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create inventory item',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
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

// Get predefined item names
router.get('/meta/item-names', authenticateToken, requirePermission('inventory.read'), async (req, res) => {
  try {
    const predefinedItemNames = [
      'dust 1',
      'dust 2',
      '6mm',
      '10mm',
      '20mm',
      '40mm',
      'bitumen',
      'ldo',
      'cement',
      'hysd 8mm',
      'hysd10mm',
      'hysd12mm',
      'hysd 16mm',
      'hysd 18mm',
      'hysd 20mm',
      'hysd 25mm',
      'hysd 32mm',
      'others'
    ];
    
    res.json({
      success: true,
      data: { itemNames: predefinedItemNames }
    });
    
  } catch (error) {
    console.error('Get item names error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch item names'
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



// Restock inventory item
router.post('/restock', authenticateToken, requirePermission('inventory.update'), async (req, res) => {
  try {
    const { itemId, quantity, supplier, notes, cost } = req.body;
    
    if (!itemId || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Item ID and quantity are required'
      });
    }
    
    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be greater than 0'
      });
    }
    
    const item = await Inventory.findById(itemId);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    // Check access permissions for non-admin users
    if (req.user.role !== 'admin') {
      const assignedSites = req.user.assignedStorageSites || [];
      if (!assignedSites.includes(item.storageSite.toString())) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this inventory item'
        });
      }
    }
    
    // Update stock
    const previousStock = item.currentStock;
    item.currentStock += quantity;
    item.lastRestocked = new Date();
    
    // Update supplier if provided
    if (supplier) {
      item.supplier = {
        ...item.supplier,
        name: supplier
      };
    }
    
    await item.save();
    
    // Create restock record (you might want to create a separate RestockRecord model)
    // For now, we'll just log it
    console.log(`Restock: ${item.itemName} - Added ${quantity} units (${previousStock} -> ${item.currentStock}) by ${req.user.email}`);
    
    res.json({
      success: true,
      message: `Successfully restocked ${quantity} ${item.unit} of ${item.itemName}`,
      data: {
        itemId: item._id,
        itemName: item.itemName,
        previousStock,
        addedQuantity: quantity,
        newStock: item.currentStock,
        unit: item.unit,
        restockedBy: req.user._id,
        restockedAt: item.lastRestocked
      }
    });
    
  } catch (error) {
    console.error('Restock inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restock inventory'
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