const mongoose = require('mongoose');

const fuelAccessConfigSchema = new mongoose.Schema({
  allowedUserIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Single document for app-wide config
fuelAccessConfigSchema.statics.getConfig = async function () {
  let config = await this.findOne();
  if (!config) {
    config = await this.create({ allowedUserIds: [] });
  }
  return config;
};

module.exports = mongoose.model('FuelAccessConfig', fuelAccessConfigSchema);
