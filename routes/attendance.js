const express = require('express');
const Attendance = require('../models/Attendance');
const { authenticateToken, requirePermission, canAccessSite } = require('../middleware/auth');

const router = express.Router();

// Check in
router.post('/checkin', authenticateToken, async (req, res) => {
  try {
    const { siteId, latitude, longitude, address, notes } = req.body;
    
    if (!siteId) {
      return res.status(400).json({
        success: false,
        message: 'Site ID is required'
      });
    }
    
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Location coordinates are required'
      });
    }
    
    const today = new Date();
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    // Check if user already checked in today
    let attendance = await Attendance.findOne({
      user: req.user._id,
      site: siteId,
      date: dateOnly
    });
    
    if (attendance && attendance.checkIn.time) {
      return res.status(400).json({
        success: false,
        message: 'Already checked in today',
        data: {
          checkInTime: attendance.checkIn.time
        }
      });
    }
    
    // Create or update attendance record
    if (!attendance) {
      attendance = new Attendance({
        user: req.user._id,
        site: siteId,
        date: dateOnly
      });
    }
    
    attendance.checkIn = {
      time: new Date(),
      location: {
        latitude,
        longitude,
        address
      },
      notes
    };
    
    // Determine if late (assuming 8 AM start time)
    const checkInTime = new Date();
    const expectedStartTime = new Date(dateOnly);
    expectedStartTime.setHours(8, 0, 0, 0);
    
    if (checkInTime > expectedStartTime) {
      attendance.status = 'late';
    }
    
    await attendance.save();
    await attendance.populate(['user', 'site']);
    
    res.json({
      success: true,
      message: 'Checked in successfully',
      data: { attendance }
    });
    
  } catch (error) {
    console.error('Check in error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check in'
    });
  }
});

// Check out
router.post('/checkout', authenticateToken, async (req, res) => {
  try {
    const { siteId, latitude, longitude, address, notes } = req.body;
    
    if (!siteId) {
      return res.status(400).json({
        success: false,
        message: 'Site ID is required'
      });
    }
    
    const today = new Date();
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const attendance = await Attendance.findOne({
      user: req.user._id,
      site: siteId,
      date: dateOnly
    });
    
    if (!attendance || !attendance.checkIn.time) {
      return res.status(400).json({
        success: false,
        message: 'No check-in record found for today'
      });
    }
    
    if (attendance.checkOut.time) {
      return res.status(400).json({
        success: false,
        message: 'Already checked out today',
        data: {
          checkOutTime: attendance.checkOut.time
        }
      });
    }
    
    attendance.checkOut = {
      time: new Date(),
      location: {
        latitude,
        longitude,
        address
      },
      notes
    };
    
    await attendance.save();
    await attendance.populate(['user', 'site']);
    
    res.json({
      success: true,
      message: 'Checked out successfully',
      data: {
        attendance,
        totalHours: attendance.totalHours,
        overtime: attendance.overtime
      }
    });
    
  } catch (error) {
    console.error('Check out error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check out'
    });
  }
});

// Get attendance records
router.get('/', authenticateToken, requirePermission('attendance.read'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      userId,
      siteId,
      startDate,
      endDate,
      status
    } = req.query;
    
    // Build query
    let query = {};
    
    // Role-based filtering
    if (req.user.role === 'worker') {
      query.user = req.user._id;
    } else if (userId) {
      query.user = userId;
    }
    
    if (siteId) {
      query.site = siteId;
    }
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Date range filtering
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    
    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [attendanceRecords, totalCount] = await Promise.all([
      Attendance.find(query)
        .populate('user', 'firstName lastName email')
        .populate('site', 'name address')
        .sort({ date: -1, 'checkIn.time': -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Attendance.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: {
        attendanceRecords,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + attendanceRecords.length < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });
    
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance records'
    });
  }
});

// Get today's attendance status
router.get('/today/status', authenticateToken, async (req, res) => {
  try {
    const today = new Date();
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const attendance = await Attendance.findOne({
      user: req.user._id,
      date: dateOnly
    }).populate('site', 'name address');
    
    res.json({
      success: true,
      data: {
        attendance,
        hasCheckedIn: attendance && attendance.checkIn.time,
        hasCheckedOut: attendance && attendance.checkOut.time,
        canCheckOut: attendance && attendance.checkIn.time && !attendance.checkOut.time
      }
    });
    
  } catch (error) {
    console.error('Get today attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch today\'s attendance status'
    });
  }
});

// Approve attendance
router.put('/:id/approve', authenticateToken, requirePermission('attendance.approve'), async (req, res) => {
  try {
    const { approved, notes } = req.body;
    
    const attendance = await Attendance.findById(req.params.id);
    
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }
    
    if (approved) {
      attendance.approvedBy = req.user._id;
      attendance.approvedAt = new Date();
      if (notes) attendance.notes = notes;
    }
    
    await attendance.save();
    await attendance.populate(['user', 'site', 'approvedBy']);
    
    res.json({
      success: true,
      message: `Attendance ${approved ? 'approved' : 'updated'} successfully`,
      data: { attendance }
    });
    
  } catch (error) {
    console.error('Approve attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve attendance'
    });
  }
});

// Get attendance summary for a user
router.get('/summary/:userId', authenticateToken, requirePermission('attendance.read'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { month, year } = req.query;
    
    const currentDate = new Date();
    const targetMonth = month ? parseInt(month) - 1 : currentDate.getMonth();
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();
    
    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0);
    
    const attendanceRecords = await Attendance.find({
      user: userId,
      date: { $gte: startDate, $lte: endDate }
    }).populate('site', 'name');
    
    // Calculate summary
    const summary = {
      totalDays: attendanceRecords.length,
      presentDays: attendanceRecords.filter(a => a.status === 'present').length,
      lateDays: attendanceRecords.filter(a => a.status === 'late').length,
      absentDays: attendanceRecords.filter(a => a.status === 'absent').length,
      totalHours: attendanceRecords.reduce((sum, a) => sum + (a.totalHours || 0), 0),
      totalOvertime: attendanceRecords.reduce((sum, a) => sum + (a.overtime || 0), 0),
      records: attendanceRecords
    };
    
    res.json({
      success: true,
      data: { summary }
    });
    
  } catch (error) {
    console.error('Get attendance summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance summary'
    });
  }
});

module.exports = router;