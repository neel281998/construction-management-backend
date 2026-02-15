const express = require('express');
const PlantInventory = require('../models/PlantInventory');
const PlantOutput = require('../models/PlantOutput');
const { authenticateToken, requirePermission } = require('../middleware/auth');

const router = express.Router();

const locationStr = (addr) => {
  if (!addr) return '';
  const parts = [addr.street, addr.city, addr.state, addr.zipCode].filter(Boolean);
  return parts.join(', ');
};

// Plant Inventory Report
router.get('/inventory', authenticateToken, requirePermission('plant_inventory.read'), async (req, res) => {
  try {
    const { plantId, category, materialType, lowStock, startDate, endDate } = req.query;

    let query = { isActive: true };

    if (plantId) {
      query.plant = plantId;
    } else if (req.user.role !== 'admin' && req.user.assignedPlants && req.user.assignedPlants.length > 0) {
      query.plant = { $in: req.user.assignedPlants };
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (materialType && materialType !== 'all') {
      query.materialType = materialType;
    }

    if (lowStock === 'true') {
      query.$expr = { $lte: ['$currentStock', '$minimumStock'] };
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate + 'T23:59:59.999Z');
      query.$or = [
        { lastRestocked: { $gte: start, $lte: end } },
        { $and: [
          { $or: [{ lastRestocked: null }, { lastRestocked: { $exists: false } }] },
          { createdAt: { $gte: start, $lte: end } }
        ]}
      ];
    }

    const items = await PlantInventory.find(query)
      .populate('plant', 'name plantType address')
      .populate('restockHistory.restockedBy', 'firstName lastName email role phone')
      .sort({ 'plant.name': 1, itemName: 1 })
      .limit(1000)
      .lean();

    const rows = items.map((inv) => {
      const plant = inv.plant;
      const lastRestock = inv.restockHistory && inv.restockHistory.length > 0
        ? inv.restockHistory[inv.restockHistory.length - 1]
        : null;
      const lastRestockUser = lastRestock && lastRestock.restockedBy ? lastRestock.restockedBy : null;

      let stockStatus = 'Normal';
      if (inv.currentStock <= inv.minimumStock) stockStatus = 'Low Stock';
      if (inv.minimumStock > 0 && inv.currentStock === 0) stockStatus = 'Out of Stock';

      return {
        _id: inv._id,
        plantName: plant ? plant.name : '',
        plantType: plant ? plant.plantType : '',
        location: plant && plant.address ? locationStr(plant.address) : '',
        itemName: inv.itemName,
        unit: inv.unit,
        category: inv.category,
        materialType: inv.materialType || '',
        currentStock: inv.currentStock,
        minimumStock: inv.minimumStock,
        maximumStock: inv.maximumStock,
        stockStatus,
        lastRestockedDate: lastRestock && lastRestock.restockedAt ? lastRestock.restockedAt : (inv.lastRestocked || ''),
        quantityAdded: lastRestock ? lastRestock.quantity : '',
        supplier: lastRestock && lastRestock.supplier ? lastRestock.supplier : (inv.supplier && inv.supplier.name ? inv.supplier.name : ''),
        vehicleNumber: lastRestock && lastRestock.vehicle && lastRestock.vehicle.vehicleNumber
          ? lastRestock.vehicle.vehicleNumber
          : (inv.broughtByVehicle && inv.broughtByVehicle.vehicleNumber ? inv.broughtByVehicle.vehicleNumber : ''),
        cost: lastRestock && lastRestock.cost != null ? lastRestock.cost : '',
        lastRestockedBy: lastRestockUser ? (lastRestockUser.firstName + ' ' + lastRestockUser.lastName).trim() : '',
        userRole: lastRestockUser ? lastRestockUser.role : '',
        userContact: lastRestockUser ? (lastRestockUser.phone || lastRestockUser.email || '') : '',
      };
    });

    res.json({
      success: true,
      data: { report: rows },
    });
  } catch (error) {
    console.error('Plant inventory report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plant inventory report',
    });
  }
});

// Plant Output Report
router.get('/output', authenticateToken, requirePermission('plant_output.read'), async (req, res) => {
  try {
    const { plantId, materialType, status, startDate, endDate } = req.query;

    let query = { isActive: true };

    if (plantId) {
      query.plant = plantId;
    } else if (req.user.role !== 'admin' && req.user.assignedPlants && req.user.assignedPlants.length > 0) {
      query.plant = { $in: req.user.assignedPlants };
    }

    if (materialType && materialType !== 'all') {
      query.materialType = materialType;
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate + 'T23:59:59.999Z');
      query.productionDate = { $gte: start, $lte: end };
    }

    const outputs = await PlantOutput.find(query)
      .populate('plant', 'name plantType address')
      .populate('createdBy', 'firstName lastName email role phone')
      .sort({ productionDate: -1 })
      .limit(1000)
      .lean();

    const rows = outputs.map((out) => {
      const plant = out.plant;
      const createdByUser = out.createdBy;

      let stockStatus = 'Normal';
      if (out.currentStock <= out.minimumStock) stockStatus = 'Low Stock';
      if (out.minimumStock > 0 && out.currentStock === 0) stockStatus = 'Out of Stock';

      return {
        _id: out._id,
        outputId: out.outputId || '',
        plantName: plant ? plant.name : '',
        plantType: plant ? plant.plantType : '',
        location: plant && plant.address ? locationStr(plant.address) : '',
        materialType: out.materialType,
        materialName: out.materialName,
        unit: out.unit,
        currentStock: out.currentStock,
        minimumStock: out.minimumStock,
        maximumStock: out.maximumStock,
        stockStatus,
        productionDate: out.productionDate,
        status: out.status,
        expiryDate: out.expiryDate || '',
        strength: out.qualitySpecs && out.qualitySpecs.strength != null ? out.qualitySpecs.strength : '',
        temperature: out.qualitySpecs && out.qualitySpecs.temperature != null ? out.qualitySpecs.temperature : '',
        createdBy: createdByUser ? (createdByUser.firstName + ' ' + createdByUser.lastName).trim() : '',
        userRole: createdByUser ? createdByUser.role : '',
        userContact: createdByUser ? (createdByUser.phone || createdByUser.email || '') : '',
      };
    });

    res.json({
      success: true,
      data: { report: rows },
    });
  } catch (error) {
    console.error('Plant output report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plant output report',
    });
  }
});

module.exports = router;
