const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  site: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
    required: [true, 'Site is required']
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    default: () => {
      const today = new Date();
      return new Date(today.getFullYear(), today.getMonth(), today.getDate());
    }
  },
  checkIn: {
    time: {
      type: Date,
      default: null
    },
    location: {
      latitude: {
        type: Number,
        min: [-90, 'Latitude must be between -90 and 90'],
        max: [90, 'Latitude must be between -90 and 90']
      },
      longitude: {
        type: Number,
        min: [-180, 'Longitude must be between -180 and 180'],
        max: [180, 'Longitude must be between -180 and 180']
      },
      address: String
    },
    photo: {
      type: String, // GridFS file ID
      default: null
    },
    notes: {
      type: String,
      maxlength: [200, 'Check-in notes cannot exceed 200 characters']
    }
  },
  checkOut: {
    time: {
      type: Date,
      default: null
    },
    location: {
      latitude: {
        type: Number,
        min: [-90, 'Latitude must be between -90 and 90'],
        max: [90, 'Latitude must be between -90 and 90']
      },
      longitude: {
        type: Number,
        min: [-180, 'Longitude must be between -180 and 180'],
        max: [180, 'Longitude must be between -180 and 180']
      },
      address: String
    },
    photo: {
      type: String, // GridFS file ID
      default: null
    },
    notes: {
      type: String,
      maxlength: [200, 'Check-out notes cannot exceed 200 characters']
    }
  },
  totalHours: {
    type: Number,
    min: [0, 'Total hours cannot be negative'],
    default: 0
  },
  overtime: {
    type: Number,
    min: [0, 'Overtime cannot be negative'],
    default: 0
  },
  status: {
    type: String,
    enum: {
      values: ['present', 'absent', 'late', 'half_day', 'sick_leave', 'vacation'],
      message: 'Invalid attendance status'
    },
    default: 'present'
  },
  breakTime: {
    start: Date,
    end: Date,
    duration: {
      type: Number,
      default: 0 // in minutes
    }
  },
  tasks: [{
    description: {
      type: String,
      required: true,
      maxlength: [200, 'Task description cannot exceed 200 characters']
    },
    startTime: Date,
    endTime: Date,
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      default: 'pending'
    }
  }],
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for work duration
attendanceSchema.virtual('workDuration').get(function() {
  if (!this.checkIn.time || !this.checkOut.time) return 0;
  
  const checkInTime = new Date(this.checkIn.time);
  const checkOutTime = new Date(this.checkOut.time);
  const diffMs = checkOutTime - checkInTime;
  const diffHours = diffMs / (1000 * 60 * 60);
  
  return Math.max(0, diffHours);
});

// Virtual for late status
attendanceSchema.virtual('isLate').get(function() {
  if (!this.checkIn.time) return false;
  
  const checkInTime = new Date(this.checkIn.time);
  const expectedStartTime = new Date(checkInTime);
  expectedStartTime.setHours(8, 0, 0, 0); // Assuming 8 AM start time
  
  return checkInTime > expectedStartTime;
});

// Method to calculate total hours
attendanceSchema.methods.calculateHours = function() {
  if (!this.checkIn.time || !this.checkOut.time) {
    this.totalHours = 0;
    this.overtime = 0;
    return;
  }
  
  const workDuration = this.workDuration;
  const breakDuration = this.breakTime.duration / 60; // convert minutes to hours
  const netWorkHours = workDuration - breakDuration;
  
  const standardHours = 8; // Standard work day
  this.totalHours = Math.max(0, netWorkHours);
  this.overtime = Math.max(0, netWorkHours - standardHours);
};

// Pre-save middleware to calculate hours
attendanceSchema.pre('save', function(next) {
  this.calculateHours();
  next();
});

// Compound index to ensure one attendance record per user per day
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });
attendanceSchema.index({ site: 1, date: 1 });
attendanceSchema.index({ status: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);