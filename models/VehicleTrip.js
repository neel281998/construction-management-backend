/**
 * VehicleTrip - Unified record for vehicle movements.
 * Populated when:
 * - Storage site: new item creation or restock from supplier (inbound)
 * - Plant inventory: restock from supplier (inbound)
 * - InventoryTransfer/InventoryDispatch/PlantOutputDispatch are queried separately for transfer/outbound
 */
const mongoose = require('mongoose');

const vehicleTripSchema = new mongoose.Schema({
  tripType: {
    type: String,
    enum: ['inbound', 'outbound', 'transfer'],
    required: true
  },
  sourceType: {
    type: String,
    enum: ['storage_site', 'plant', 'supplier'],
    required: true
  },
  sourceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  sourceName: {
    type: String,
    required: true
  },
  destinationType: {
    type: String,
    enum: ['storage_site', 'plant', 'construction_site', 'construction_step'],
    required: true
  },
  destinationId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  destinationName: {
    type: String,
    required: true
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: false
  },
  itemName: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: false
  },
  unit: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  vehicle: {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true
    },
    vehicleNumber: {
      type: String,
      required: true
    },
    vehicleType: {
      type: String,
      required: true
    },
    driverName: String,
    driverPhone: String
  },
  performedBy: {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    firstName: String,
    lastName: String,
    email: String
  },
  receivedBy: {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    firstName: String,
    lastName: String,
    email: String
  },
  tripDate: {
    type: Date,
    default: Date.now
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    comment: 'ID of source record (Inventory, PlantInventory, etc) for traceability'
  },
  referenceType: {
    type: String,
    enum: ['inventory', 'plant_inventory'],
    required: false
  }
}, {
  timestamps: true
});

vehicleTripSchema.index({ tripDate: -1 });
vehicleTripSchema.index({ 'vehicle._id': 1, tripDate: -1 });
vehicleTripSchema.index({ sourceType: 1, sourceId: 1 });
vehicleTripSchema.index({ tripType: 1 });

module.exports = mongoose.model('VehicleTrip', vehicleTripSchema);
