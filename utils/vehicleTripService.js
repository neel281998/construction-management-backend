/**
 * Creates VehicleTrip records for inbound movements (storage/plant restock from supplier).
 */
const VehicleTrip = require('../models/VehicleTrip');

/**
 * Create inbound trip for storage site - new item or restock with vehicle
 */
async function createStorageInboundTrip(params) {
  const { storageSite, item, vehicle, quantity, user, supplierName, referenceId, referenceType } = params;
  if (!vehicle || !vehicle._id) return;

  try {
    const trip = new VehicleTrip({
      tripType: 'inbound',
      sourceType: 'supplier',
      sourceName: supplierName || 'Supplier',
      destinationType: 'storage_site',
      destinationId: storageSite._id,
      destinationName: storageSite.name + (storageSite.code ? ' (' + storageSite.code + ')' : ''),
      itemId: item._id,
      itemName: item.itemName || item.materialName,
      category: item.category,
      unit: item.unit,
      quantity: quantity,
      vehicle: {
        _id: vehicle._id,
        vehicleNumber: vehicle.vehicleNumber,
        vehicleType: vehicle.vehicleType || vehicle.type,
        driverName: vehicle.assignedTo ? 'Assigned Driver' : (vehicle.driverName || ''),
        driverPhone: vehicle.driverPhone
      },
      performedBy: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      },
      tripDate: new Date(),
      referenceId: referenceId || item._id,
      referenceType: referenceType || 'inventory'
    });
    await trip.save();
  } catch (err) {
    console.error('VehicleTrip createStorageInboundTrip error:', err);
  }
}

/**
 * Create inbound trip for plant inventory restock with vehicle
 */
async function createPlantInboundTrip(params) {
  const { plant, item, vehicle, quantity, user, supplierName, referenceId } = params;
  if (!vehicle || !vehicle._id) return;

  try {
    const trip = new VehicleTrip({
      tripType: 'inbound',
      sourceType: 'supplier',
      sourceName: supplierName || 'Supplier',
      destinationType: 'plant',
      destinationId: plant._id,
      destinationName: plant.name,
      itemId: item._id,
      itemName: item.itemName,
      category: item.category,
      unit: item.unit,
      quantity: quantity,
      vehicle: {
        _id: vehicle._id,
        vehicleNumber: vehicle.vehicleNumber,
        vehicleType: vehicle.vehicleType || vehicle.type,
        driverName: vehicle.assignedTo ? 'Assigned Driver' : (vehicle.driverName || ''),
        driverPhone: vehicle.driverPhone
      },
      performedBy: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      },
      tripDate: new Date(),
      referenceId: referenceId || item._id,
      referenceType: 'plant_inventory'
    });
    await trip.save();
  } catch (err) {
    console.error('VehicleTrip createPlantInboundTrip error:', err);
  }
}

module.exports = {
  createStorageInboundTrip,
  createPlantInboundTrip
};
