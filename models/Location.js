const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Location name is required'],
    trim: true,
    maxlength: [100, 'Location name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Location code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    match: [/^[A-Z]{2,4}-\d{3}$/, 'Location code must be in format XX-000 or XXX-000']
  },
  type: {
    type: String,
    required: [true, 'Location type is required'],
    enum: {
      values: [
        'warehouse',
        'storage_yard',
        'construction_site',
        'office',
        'distribution_center',
        'temporary_storage',
        'other'
      ],
      message: 'Invalid location type'
    }
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  address: {
    street: {
      type: String,
      required: [true, 'Street address is required'],
      trim: true
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true
    },
    zipCode: {
      type: String,
      required: [true, 'ZIP code is required'],
      trim: true
    },
    coordinates: {
      latitude: {
        type: Number,
        min: [-90, 'Latitude must be between -90 and 90'],
        max: [90, 'Latitude must be between -90 and 90']
      },
      longitude: {
        type: Number,
        min: [-180, 'Longitude must be between -180 and 180'],
        max: [180, 'Longitude must be between -180 and 180']
      }
    }
  },
  capacity: {
    totalArea: {
      type: Number,
      min: [0, 'Total area cannot be negative']
    },
    areaUnit: {
      type: String,
      enum: ['sqft', 'sqm', 'acres', 'hectares'],
      default: 'sqm'
    },
    storageCapacity: {
      type: Number,
      min: [0, 'Storage capacity cannot be negative']
    },
    capacityUnit: {
      type: String,
      enum: ['cubic_meters', 'cubic_feet', 'tons', 'kg', 'units'],
      default: 'cubic_meters'
    }
  },
  facilities: {
    hasSecurity: {
      type: Boolean,
      default: false
    },
    hasClimateControl: {
      type: Boolean,
      default: false
    },
    hasLoadingDock: {
      type: Boolean,
      default: false
    },
    hasCrane: {
      type: Boolean,
      default: false
    },
    hasForklift: {
      type: Boolean,
      default: false
    },
    hasShelving: {
      type: Boolean,
      default: false
    },
    hasFencing: {
      type: Boolean,
      default: false
    },
    hasLighting: {
      type: Boolean,
      default: true
    },
    hasDrainage: {
      type: Boolean,
      default: false
    }
  },
  contact: {
    manager: {
      name: {
        type: String,
        trim: true
      },
      phone: {
        type: String,
        trim: true,
        match: [/^\+?[\d\s\-\(\)]{10,}$/, 'Please enter a valid phone number']
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
      }
    },
    emergencyContact: {
      name: {
        type: String,
        trim: true
      },
      phone: {
        type: String,
        trim: true,
        match: [/^\+?[\d\s\-\(\)]{10,}$/, 'Please enter a valid phone number']
      }
    }
  },
  operatingHours: {
    monday: {
      isOpen: { type: Boolean, default: true },
      openTime: { type: String, default: '08:00' },
      closeTime: { type: String, default: '18:00' }
    },
    tuesday: {
      isOpen: { type: Boolean, default: true },
      openTime: { type: String, default: '08:00' },
      closeTime: { type: String, default: '18:00' }
    },
    wednesday: {
      isOpen: { type: Boolean, default: true },
      openTime: { type: String, default: '08:00' },
      closeTime: { type: String, default: '18:00' }
    },
    thursday: {
      isOpen: { type: Boolean, default: true },
      openTime: { type: String, default: '08:00' },
      closeTime: { type: String, default: '18:00' }
    },
    friday: {
      isOpen: { type: Boolean, default: true },
      openTime: { type: String, default: '08:00' },
      closeTime: { type: String, default: '18:00' }
    },
    saturday: {
      isOpen: { type: Boolean, default: true },
      openTime: { type: String, default: '08:00' },
      closeTime: { type: String, default: '16:00' }
    },
    sunday: {
      isOpen: { type: Boolean, default: false },
      openTime: { type: String, default: '08:00' },
      closeTime: { type: String, default: '16:00' }
    }
  },
  assignedInventoryManagers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    assignedDate: {
      type: Date,
      default: Date.now
    },
    isPrimary: {
      type: Boolean,
      default: false
    },
    permissions: [{
      type: String,
      enum: ['read', 'write', 'delete', 'approve', 'transfer']
    }]
  }],
  status: {
    type: String,
    enum: {
      values: ['active', 'inactive', 'maintenance', 'closed'],
      message: 'Invalid location status'
    },
    default: 'active'
  },
  photos: [{
    fileId: String, // GridFS file ID
    caption: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  documents: [{
    fileId: String, // GridFS file ID
    fileName: String,
    fileType: String,
    category: {
      type: String,
      enum: ['license', 'permit', 'insurance', 'contract', 'other']
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full address
locationSchema.virtual('fullAddress').get(function() {
  return `${this.address.street}, ${this.address.city}, ${this.address.state} ${this.address.zipCode}`;
});

// Virtual for primary inventory manager
locationSchema.virtual('primaryManager').get(function() {
  return this.assignedInventoryManagers.find(manager => manager.isPrimary);
});

// Virtual for inventory count
locationSchema.virtual('inventoryCount', {
  ref: 'Inventory',
  localField: '_id',
  foreignField: 'locationId',
  count: true
});

// Virtual for total inventory value (if you add pricing later)
locationSchema.virtual('totalInventoryValue', {
  ref: 'Inventory',
  localField: '_id',
  foreignField: 'locationId',
  options: { match: { isActive: true } }
});

// Method to check if location is open at given time
locationSchema.methods.isOpenAt = function(dateTime = new Date()) {
  const day = dateTime.toLocaleLowerCase().substring(0, 3);
  const dayKey = day === 'sun' ? 'sunday' : 
                 day === 'mon' ? 'monday' :
                 day === 'tue' ? 'tuesday' :
                 day === 'wed' ? 'wednesday' :
                 day === 'thu' ? 'thursday' :
                 day === 'fri' ? 'friday' : 'saturday';
  
  const daySchedule = this.operatingHours[dayKey];
  if (!daySchedule.isOpen) return false;
  
  const currentTime = dateTime.toTimeString().substring(0, 5);
  return currentTime >= daySchedule.openTime && currentTime <= daySchedule.closeTime;
};

// Method to get next opening time
locationSchema.methods.getNextOpeningTime = function() {
  const now = new Date();
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  
  for (let i = 0; i < 7; i++) {
    const checkDate = new Date(now);
    checkDate.setDate(now.getDate() + i);
    const dayName = days[checkDate.getDay()];
    const daySchedule = this.operatingHours[dayName];
    
    if (daySchedule.isOpen) {
      const [hours, minutes] = daySchedule.openTime.split(':');
      checkDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      if (checkDate > now) {
        return checkDate;
      }
    }
  }
  
  return null;
};

// Index for performance
locationSchema.index({ code: 1 });
locationSchema.index({ type: 1 });
locationSchema.index({ status: 1 });
locationSchema.index({ 'address.city': 1, 'address.state': 1 });
locationSchema.index({ 'assignedInventoryManagers.user': 1 });
locationSchema.index({ isActive: 1 });

module.exports = mongoose.model('Location', locationSchema);
