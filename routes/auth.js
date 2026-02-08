const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendOTPEmail } = require('../utils/emailService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Register new user (Public registration - only worker role allowed)
router.post('/register', async (req, res) => {
  try {
    const { email, phone, password, firstName, lastName } = req.body;
    
    // Validate required fields
    if (!email || !phone || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }]
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or phone already exists'
      });
    }
    
    // Create new user - ONLY worker role allowed for public registration
    const user = new User({
      email,
      phone,
      password,
      firstName,
      lastName,
      role: 'worker', // Force worker role for public registration
      isVerified: false, // Require email verification
      status: 'pending' // Set to pending until admin approval
    });
    
    await user.save();
    
    // Send verification email
    try {
      await sendOTPEmail(email, '123456'); // In production, generate real OTP
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Continue with registration even if email fails
    }
    
    res.status(201).json({
      success: true,
      message: 'Registration successful! Please verify your email and wait for admin approval.',
      data: {
        user: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          status: user.status
        }
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
    });
  }
});

// Admin-only user creation endpoint
router.post('/admin/create-user', authenticateToken, async (req, res) => {
  try {
    // Check if current user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }
    
    const { email, phone, password, firstName, lastName, role } = req.body;
    
    // Validate required fields
    if (!email || !phone || !password || !firstName || !lastName || !role) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required including role'
      });
    }
    
    // Validate role
    const validRoles = ['admin', 'site_manager', 'supervisor', 'inventory_manager', 'inventory_assistant', 'worker', 'fuel_main_manager', 'fuel_sub_manager'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
      });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }]
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or phone already exists'
      });
    }
    
    // Create new user with admin-specified role
    const user = new User({
      email,
      phone,
      password,
      firstName,
      lastName,
      role,
      isVerified: true, // Admin-created users are auto-verified
      status: 'active' // Admin-created users are immediately active
    });
    
    await user.save();
    
    res.status(201).json({
      success: true,
      message: 'User created successfully!',
      data: {
        user: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          status: user.status,
          permissions: user.permissions
        }
      }
    });
    
  } catch (error) {
    console.error('Admin user creation error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'User creation failed. Please try again.'
    });
  }
});

// Get pending users (Admin only)
router.get('/admin/pending-users', authenticateToken, async (req, res) => {
  try {
    // Check if current user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }
    
    const pendingUsers = await User.find({ 
      status: 'pending',
      isVerified: false 
    }).select('-password');
    
    res.json({
      success: true,
      data: pendingUsers
    });
    
  } catch (error) {
    console.error('Error fetching pending users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending users'
    });
  }
});

// Approve user (Admin or Supervisor - no delete)
router.post('/admin/approve-user/:userId', authenticateToken, async (req, res) => {
  try {
    if (!['admin', 'supervisor'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin or supervisor required.'
      });
    }
    
    const { userId } = req.params;
    const { role } = req.body; // Optional role change during approval
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (user.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'User is not pending approval'
      });
    }
    
    // Update user status and role (allowed roles: admin, supervisor, user)
    user.status = 'active';
    user.isVerified = true;
    if (role && ['admin', 'supervisor', 'user'].includes(role)) {
      user.role = role;
    }
    
    await user.save();
    
    res.json({
      success: true,
      message: 'User approved successfully',
      data: {
        user: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          status: user.status
        }
      }
    });
    
  } catch (error) {
    console.error('Error approving user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve user'
    });
  }
});

// Reject user (Admin only)
router.post('/admin/reject-user/:userId', authenticateToken, async (req, res) => {
  try {
    // Check if current user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }
    
    const { userId } = req.params;
    const { reason } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (user.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'User is not pending approval'
      });
    }
    
    // Delete the user or mark as rejected
    await User.findByIdAndDelete(userId);
    
    res.json({
      success: true,
      message: 'User rejected and removed',
      data: { reason: reason || 'No reason provided' }
    });
    
  } catch (error) {
    console.error('Error rejecting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject user'
    });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }
    
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const otpResult = user.verifyOTP(otp);
    
    if (!otpResult.success) {
      await user.save(); // Save updated attempt count
      return res.status(400).json({
        success: false,
        message: otpResult.message
      });
    }
    
    await user.save();
    
    // Generate JWT token
    const token = generateToken(user._id);
    
    res.json({
      success: true,
      message: 'OTP verified successfully',
      data: {
        token,
        user: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          permissions: user.permissions,
          assignedSites: user.assignedSites
        }
      }
    });
    
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({
      success: false,
      message: 'OTP verification failed. Please try again.'
    });
  }
});

// Resend OTP
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'User is already verified'
      });
    }
    
    // Generate new OTP
    const otp = user.generateOTP();
    await user.save();
    
    // Send OTP email
    try {
      await sendOTPEmail(email, otp, user.fullName);
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email'
      });
    }
    
    res.json({
      success: true,
      message: 'OTP sent successfully',
      data: {
        email: user.email,
        expiresAt: user.otp.expiresAt
      }
    });
    
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend OTP. Please try again.'
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
    
    // Find user and include password for comparison
    const user = await User.findOne({ email }).populate('assignedSites', 'name status');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }
    
    // Skip email verification check - users are auto-verified
    // if (!user.isVerified) {
    //   return res.status(401).json({
    //     success: false,
    //     message: 'Please verify your email first',
    //     requiresVerification: true,
    //     email: user.email
    //   });
    // }
    
    // Check password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Ensure admins always have full permissions (others are custom-only)
    const adminPermissions = [
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

    if (user.role === 'admin' && (!user.permissions || user.permissions.length === 0) && !user.hasCustomPermissions) {
      user.permissions = adminPermissions;
    }
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    // Generate JWT token
    const token = generateToken(user._id);
    
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          role: user.role,
          permissions: user.permissions,
          assignedSites: user.assignedSites,
          lastLogin: user.lastLogin
        }
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
});

// Forgot password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const user = await User.findOne({ email });
    
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({
        success: true,
        message: 'If an account with this email exists, a password reset link has been sent.'
      });
    }
    
    // Generate password reset OTP
    const otp = user.generateOTP();
    await user.save();
    
    // Send password reset email
    try {
      await sendOTPEmail(email, otp, user.fullName, 'reset');
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
    }
    
    res.json({
      success: true,
      message: 'If an account with this email exists, a password reset link has been sent.'
    });
    
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process request. Please try again.'
    });
  }
});

// Reset password with OTP
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    
    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP, and new password are required'
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }
    
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const otpResult = user.verifyOTP(otp);
    
    if (!otpResult.success) {
      await user.save(); // Save updated attempt count
      return res.status(400).json({
        success: false,
        message: otpResult.message
      });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    res.json({
      success: true,
      message: 'Password reset successfully'
    });
    
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password. Please try again.'
    });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('assignedSites', 'name status progress');
    
    res.json({
      success: true,
      data: {
        user
      }
    });
    
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile'
    });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;
    const userId = req.user._id;
    
    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (phone) updateData.phone = phone;
    
    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });
    
  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }
    
    const user = await User.findById(req.user._id);
    
    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
    
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
});

// Logout (invalidate token - in a real app, you'd maintain a blacklist)
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // In a production app, you would:
    // 1. Add token to blacklist
    // 2. Remove device token if provided
    // 3. Clear any cached sessions
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
    
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});

module.exports = router;