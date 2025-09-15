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
      values: ['admin', 'site_manager', 'supervisor', 'worker', 'inventory_manager', 'inventory_assistant', 'step_manager'],
      message: 'Invalid role specified'
    },
    default: 'worker'
  },
  avatar: {
    type: String, // GridFS file ID
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
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
  assignedSites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site'
  }],
  assignedStorageSites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StorageSite'
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

// Set permissions based on role
userSchema.pre('save', function(next) {
  if (!this.isModified('role')) return next();
  
  const rolePermissions = {
    admin: [
      'user.create', 'user.read', 'user.update', 'user.delete',
      'site.create', 'site.read', 'site.update', 'site.delete',
      'vehicle.create', 'vehicle.read', 'vehicle.update', 'vehicle.delete',
      'inventory.create', 'inventory.read', 'inventory.update', 'inventory.delete',
      'storage_site.create', 'storage_site.read', 'storage_site.update', 'storage_site.delete',
      'attendance.read', 'attendance.approve',
      'report.generate', 'report.export'
    ],
    site_manager: [
      'site.read', 'site.update', // Can only read assigned sites and update progress
      'attendance.read', 'attendance.approve',
      'report.generate'
    ],
    supervisor: [
      'user.create', 'user.read', // Can view and create users
      'site.create', 'site.read', // Can view and create sites
      'vehicle.create', 'vehicle.read', // Can view and create vehicles
      'inventory.create', 'inventory.read', // Can view and create inventory
      'attendance.read', 'attendance.approve', // Can view and approve attendance
      'report.generate' // Can generate reports
      // Note: No update/delete permissions for supervisor
    ],
    worker: [
      'site.read',
      'attendance.create', 'attendance.read'
    ],
    inventory_manager: [
      'inventory.create', 'inventory.read', 'inventory.update', 'inventory.delete',
      'storage_site.read', 'storage_site.update',
      'report.generate'
    ],
    inventory_assistant: [
      'inventory.read', 'inventory.update',
      'storage_site.read'
    ],
    step_manager: [
      'step.create', 'step.read', 'step.update', 'step.delete',
      'site.read', // Can read sites to manage steps
      'user.read', // Can read users to assign to steps
      'report.generate' // Can generate step reports
    ]
  };
  
  this.permissions = rolePermissions[this.role] || [];
  next();
});

// Index for performance (email and phone already have unique indexes from schema definition)
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

module.exports = mongoose.model('User', userSchema);