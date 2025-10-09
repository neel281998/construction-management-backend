# Comprehensive Activity Logging System

## Overview
A complete activity logging system that tracks all user actions across the entire construction management application. The system provides a centralized log of all operations including creates, updates, deletes, transfers, and status changes.

## Features

### 1. ActivityLog Model (`models/ActivityLog.js`)
- Tracks all user actions with detailed information
- Stores user details (ID, name, role)
- Records action type, category, title, and message
- Includes entity information (type, ID, name)
- Supports custom metadata for each activity
- Auto-expires old activities after 90 days
- Indexed for efficient querying

### 2. Activity Logger Utility (`utils/activityLogger.js`)
- Easy-to-use function for logging activities
- Automatic icon and color assignment based on action type
- Captures IP address and user agent
- Supports 40+ different action types across all modules

### 3. Tracked Activities

#### Site Operations
- `site_created` - New construction site created
- `site_updated` - Site information updated
- `site_deleted` - Site soft deleted
- `site_status_changed` - Site status changed (active, completed, etc.)
- `site_progress_updated` - Site progress percentage updated

#### Plant Operations
- `plant_created` - New plant created
- `plant_updated` - Plant information updated
- `plant_deleted` - Plant deleted
- `plant_status_changed` - Plant status changed

#### Storage Site Operations
- `storage_site_created` - New storage site created
- `storage_site_updated` - Storage site updated
- `storage_site_deleted` - Storage site deleted

#### Inventory Operations
- `inventory_created` - New inventory item added
- `inventory_updated` - Inventory item updated
- `inventory_deleted` - Inventory item deleted
- `inventory_restocked` - Inventory restocked
- `inventory_consumed` - Inventory consumed

#### Plant Inventory Operations
- `plant_inventory_created` - New plant inventory item
- `plant_inventory_updated` - Plant inventory updated
- `plant_inventory_deleted` - Plant inventory deleted
- `plant_inventory_restocked` - Plant inventory restocked
- `plant_inventory_consumed` - Plant inventory consumed

#### Transfer Operations
- `inventory_transferred` - Inventory transferred between sites
- `transfer_received` - Transfer received at destination
- `transfer_cancelled` - Transfer cancelled

#### Dispatch Operations
- `inventory_dispatched` - Inventory dispatched to site
- `dispatch_received` - Dispatch received
- `dispatch_cancelled` - Dispatch cancelled

#### Vehicle Operations
- `vehicle_created` - New vehicle added
- `vehicle_updated` - Vehicle information updated
- `vehicle_deleted` - Vehicle deleted
- `vehicle_maintenance_scheduled` - Maintenance scheduled
- `vehicle_maintenance_completed` - Maintenance completed

#### User Operations
- `user_created` - New user created
- `user_updated` - User information updated
- `user_deleted` - User deleted
- `user_role_changed` - User role changed
- `user_assigned_to_site` - User assigned to site

#### Step Operations
- `step_created` - New construction step created
- `step_updated` - Step information updated
- `step_progress_updated` - Step progress updated
- `step_status_changed` - Step status changed
- `step_completed` - Step marked as completed

#### Fuel Operations
- `fuel_log_created` - Fuel consumption logged
- `fuel_transfer_created` - Fuel transfer initiated
- `fuel_transfer_completed` - Fuel transfer completed

#### Other Operations
- `alert_created` - New alert created
- `notification_sent` - Notification sent
- `report_generated` - Report generated

## API Endpoints

### Get Recent Activities
```
GET /api/recent-activities?limit=10&category=site&userId=xxx
```

**Query Parameters:**
- `limit` (optional) - Number of activities to return (default: 10)
- `category` (optional) - Filter by category (site, inventory, vehicle, etc.)
- `userId` (optional) - Filter by user ID

**Response:**
```json
{
  "success": true,
  "data": {
    "activities": [
      {
        "id": "activity_id",
        "type": "site_created",
        "category": "site",
        "title": "New Site Created",
        "message": "Downtown Office Complex has been created",
        "icon": "construct",
        "color": "green",
        "timestamp": "2025-10-09T10:30:00.000Z",
        "timeAgo": "2 hours ago",
        "user": {
          "name": "John Doe",
          "role": "admin"
        },
        "entity": {
          "type": "site",
          "id": "site_id",
          "name": "Downtown Office Complex"
        },
        "metadata": {
          "siteTypes": ["BT_ROAD"],
          "totalSteps": 15,
          "estimatedVolume": 50000
        }
      }
    ],
    "total": 1
  }
}
```

### Get Activity Statistics
```
GET /api/recent-activities/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "timePeriods": {
      "today": 25,
      "yesterday": 18,
      "thisWeek": 156
    },
    "byCategory": {
      "site": 45,
      "inventory": 78,
      "vehicle": 23,
      "dispatch": 10
    }
  }
}
```

## Usage Example

### In Route Handlers

```javascript
const { logActivity, getActivityStyle } = require('../utils/activityLogger');

// After creating a site
await logActivity({
  user: req.user,
  action: 'site_created',
  category: 'site',
  title: 'New Site Created',
  message: `${site.name} has been created`,
  entityType: 'site',
  entityId: site._id,
  entityName: site.name,
  metadata: {
    siteTypes: site.siteTypes,
    totalSteps: steps.length,
    estimatedVolume: site.estimatedVolumeM3
  },
  ...getActivityStyle('site_created'),
  req
});
```

## Implementation Status

### ✅ Completed
- ActivityLog model created
- Activity logger utility created
- Recent activities API updated
- Site operations logging (create, update, delete, status change)
- Inventory operations logging (create, restock, delete)

### 🔄 To Be Added
- Plant operations logging
- Storage site operations logging
- Vehicle operations logging
- Transfer operations logging
- Dispatch operations logging
- User management logging
- Step operations logging
- Fuel operations logging

## Benefits

1. **Complete Audit Trail** - Track every action in the system
2. **User Accountability** - Know who did what and when
3. **Activity Dashboard** - Real-time view of system activities
4. **Debugging** - Easier to trace issues and understand system usage
5. **Compliance** - Meet audit and compliance requirements
6. **Analytics** - Understand usage patterns and system activity
7. **Performance** - Indexed for fast queries
8. **Storage Optimization** - Auto-expires old activities after 90 days

## Next Steps

To add activity logging to additional routes:

1. Import the logger utility:
```javascript
const { logActivity, getActivityStyle } = require('../utils/activityLogger');
```

2. Add logging after successful operations:
```javascript
await logActivity({
  user: req.user,
  action: 'your_action',
  category: 'your_category',
  title: 'Action Title',
  message: 'Detailed message',
  entityType: 'entity_type',
  entityId: entity._id,
  entityName: entity.name,
  metadata: { /* additional data */ },
  ...getActivityStyle('your_action'),
  req
});
```

3. The system will automatically:
   - Store the activity in the database
   - Add user information
   - Add timestamp
   - Capture IP and user agent
   - Make it available in the recent activities feed


