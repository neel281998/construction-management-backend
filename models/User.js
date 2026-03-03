const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true,
    match: [/^\+?[\d\s\-\(\)]{10,}$/, 'Please enter a valid phone number']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  role: {
    type: String,
    required: [true, 'Role is required'],
    enum: {
      values: ['admin', 'supervisor', 'user', 'worker'],
      message: 'Invalid role specified'
    },
    default: 'user'
  },
  avatar: {
    type: String, // GridFS file ID or URL
    default: null
  },
  location: {
    type: String,
    default: null,
    trim: true,
    maxlength: [200, 'Location cannot exceed 200 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'inactive', 'suspended'],
    default: 'active'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date,
    default: null
  },
  otp: {
    code: {
      type: String,
      default: null
    },
    expiresAt: {
      type: Date,
      default: null
    },
    attempts: {
      type: Number,
      default: 0
    }
  },
  permissions: [{
    type: String
  }],
  hasCustomPermissions: {
    type: Boolean,
    default: false
  },
  assignedSites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site'
  }],
  assignedStorageSites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StorageSite'
  }],
  assignedPlants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plant'
  }],
  deviceTokens: [{
    token: String,
    platform: {
      type: String,
      enum: ['ios', 'android', 'web']
    },
    lastUsed: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to generate OTP
userSchema.methods.generateOTP = function() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.otp.code = otp;
  this.otp.expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  this.otp.attempts = 0;
  return otp;
};

// Method to verify OTP
userSchema.methods.verifyOTP = function(candidateOTP) {
  if (!this.otp.code || !this.otp.expiresAt) {
    return { success: false, message: 'No OTP found' };
  }
  
  if (this.otp.expiresAt < new Date()) {
    return { success: false, message: 'OTP has expired' };
  }
  
  if (this.otp.attempts >= 3) {
    return { success: false, message: 'Maximum OTP attempts exceeded' };
  }
  
  if (this.otp.code !== candidateOTP) {
    this.otp.attempts += 1;
    return { success: false, message: 'Invalid OTP' };
  }
  
  // Clear OTP after successful verification
  this.otp.code = null;
  this.otp.expiresAt = null;
  this.otp.attempts = 0;
  this.isVerified = true;
  
  return { success: true, message: 'OTP verified successfully' };
};

// Default admin permissions (full access including delete)
const ADMIN_PERMISSIONS = [
  'user.create', 'user.read', 'user.update', 'user.delete',
  'site.create', 'site.read', 'site.update', 'site.delete',
  'vehicle.create', 'vehicle.read', 'vehicle.update', 'vehicle.delete',
  'inventory.create', 'inventory.read', 'inventory.update', 'inventory.delete',
  'storage_site.create', 'storage_site.read', 'storage_site.update', 'storage_site.delete',
  'plant.create', 'plant.read', 'plant.update', 'plant.delete',
  'plant_inventory.create', 'plant_inventory.read', 'plant_inventory.update', 'plant_inventory.delete', 'plant_inventory.transfer',
  'plant_output.create', 'plant_output.read', 'plant_output.update', 'plant_output.delete',
  'fuel.create', 'fuel.read', 'fuel.update', 'fuel.delete', 'fuel.restock', 'fuel.reading', 'fuel.refuel',
  'attendance.read', 'attendance.approve',
  'report.generate', 'report.export'
];

// Worker: site and vehicle read only (site-based filtering applied in APIs)
const WORKER_PERMISSIONS = ['site.read', 'vehicle.read'];

// Supervisor: all permissions except delete (no *.delete)
const SUPERVISOR_PERMISSIONS = [
  'user.create', 'user.read', 'user.update',
  'site.create', 'site.read', 'site.update',
  'vehicle.create', 'vehicle.read', 'vehicle.update',
  'inventory.create', 'inventory.read', 'inventory.update',
  'storage_site.create', 'storage_site.read', 'storage_site.update',
  'plant.create', 'plant.read', 'plant.update',
  'plant_inventory.create', 'plant_inventory.read', 'plant_inventory.update', 'plant_inventory.transfer',
  'plant_output.create', 'plant_output.read', 'plant_output.update',
  'fuel.create', 'fuel.read', 'fuel.update', 'fuel.restock', 'fuel.reading', 'fuel.refuel',
  'attendance.read', 'attendance.approve',
  'report.generate', 'report.export'
];

// Set permissions defaults by role
userSchema.pre('save', function(next) {
  // If user has custom permissions, never override
  if (this.hasCustomPermissions) {
    return next();
  }

  // Admin: full permissions including delete
  if (this.role === 'admin' && (!this.permissions || this.permissions.length === 0)) {
    this.permissions = ADMIN_PERMISSIONS;
    this.hasCustomPermissions = false;
  }

  // Supervisor: all except delete
  if (this.role === 'supervisor' && (!this.permissions || this.permissions.length === 0)) {
    this.permissions = SUPERVISOR_PERMISSIONS;
    this.hasCustomPermissions = false;
  }

  // Worker: site.read and vehicle.read (site-based filtering in APIs)
  if (this.role === 'worker' && (!this.permissions || this.permissions.length === 0)) {
    this.permissions = WORKER_PERMISSIONS;
    this.hasCustomPermissions = false;
  }

  // User: permissions managed by admin/supervisor (assigned sites + custom permissions)
  if (this.role === 'user' && this.isModified('role')) {
    this.hasCustomPermissions = true;
  }

  if (!Array.isArray(this.permissions)) {
    this.permissions = [];
  }

  next();
});

// Index for performance (email and phone already have unique indexes from schema definition)
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

module.exports = mongoose.model('User', userSchema);