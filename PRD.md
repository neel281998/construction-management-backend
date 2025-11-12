# Product Requirements Document (PRD)
## Construction Management Backend API

**Version:** 1.0.0  
**Date:** December 2024  
**Status:** Production  
**Technology Stack:** Node.js, Express.js, MongoDB, Mongoose

---

## 1. Executive Summary

### 1.1 Overview
The Construction Management Backend API is a comprehensive RESTful API service designed to support a mobile-first construction management application. The system manages construction sites, inventory, vehicles, production plants, fuel management, attendance tracking, and provides real-time analytics and reporting capabilities.

### 1.2 Purpose
This backend serves as the central data and business logic layer for a construction management mobile application, providing secure, scalable, and performant APIs for managing all aspects of construction operations.

### 1.3 Target Users
- **Site Managers**: Oversee construction sites, track progress, manage inventory
- **Supervisors**: Monitor daily operations, track attendance, manage workflows
- **Workers**: Record attendance, view assigned tasks, log activities
- **Inventory Managers**: Manage inventory across sites and storage locations
- **Plant Managers**: Manage production plants, track output, manage batches
- **Fuel Managers**: Manage fuel storage, transfers, and vehicle refueling
- **Administrators**: System-wide management, user administration, reporting

---

## 2. System Architecture

### 2.1 Technology Stack
- **Runtime**: Node.js (v18.0.0+)
- **Framework**: Express.js v4.18.2
- **Database**: MongoDB (MongoDB Atlas)
- **ODM**: Mongoose v8.0.3
- **Authentication**: JWT (jsonwebtoken)
- **Security**: Helmet, CORS, express-rate-limit
- **File Storage**: GridFS (via gridfs-stream)
- **Email**: Nodemailer
- **Scheduling**: node-cron
- **Deployment**: Vercel (Serverless)

### 2.2 Architecture Patterns
- **RESTful API Design**: Standard HTTP methods and status codes
- **Middleware-based**: Request processing pipeline with middleware
- **Role-Based Access Control (RBAC)**: Multi-role permission system
- **Serverless Architecture**: Optimized for Vercel serverless functions
- **Connection Pooling**: Optimized database connection management

### 2.3 Key Design Principles
- Security-first approach with authentication and authorization
- Performance optimization (caching, query optimization, compression)
- Scalability for handling multiple concurrent users
- Comprehensive activity logging for audit trails
- Error handling and graceful degradation

---

## 3. Core Features & Modules

### 3.1 Authentication & Authorization

#### 3.1.1 User Authentication
- **JWT-based Authentication**: Secure token-based authentication
- **Login Endpoint**: Email/phone and password authentication
- **Registration**: User registration with role assignment
- **Token Management**: Token expiration, refresh mechanisms
- **Password Security**: bcrypt hashing, minimum 6 characters

#### 3.1.2 Role-Based Access Control
**Supported Roles:**
- `admin`: Full system access
- `site_manager`: Site management, progress tracking
- `supervisor`: Daily operations oversight
- `worker`: Basic operations, attendance logging
- `inventory_manager`: Inventory management across locations
- `inventory_assistant`: Inventory assistance operations
- `step_manager`: Workflow step management
- `plant_manager`: Production plant management
- `fuel_main_manager`: Main fuel storage management
- `fuel_sub_manager`: Sub fuel storage management

#### 3.1.3 Permission System
- Site-based access control: Users assigned to specific sites
- Storage site access control: Users assigned to storage locations
- Permission-based endpoints: Fine-grained access control
- Role-based middleware: Automatic permission enforcement

#### 3.1.4 Security Features
- Rate limiting: 100 requests per 15 minutes per IP
- CORS protection: Configurable origin whitelist
- Helmet.js: Security headers
- Input validation: Request body and parameter validation
- SQL injection prevention: Mongoose parameterization

---

### 3.2 Site Management

#### 3.2.1 Site CRUD Operations
- **Create Sites**: New construction site registration
- **Read Sites**: List all sites, get site details
- **Update Sites**: Modify site information, status
- **Delete Sites**: Soft delete with status management

#### 3.2.2 Site Features
- Site information: Name, location, type, status
- Site types: Configurable site types (e.g., excavation, foundation, etc.)
- Progress tracking: Volume tracking (M³), percentage completion
- Status management: Active, completed, on-hold, cancelled
- Site assignment: Assign users to sites
- Site inventory: Track inventory at each site

#### 3.2.3 Site Types
- Configurable site type system
- Type-specific configurations
- Material templates per site type
- Progress tracking per type

---

### 3.3 Step/Workflow Management

#### 3.3.1 Step Operations
- **Create Steps**: Define workflow steps for sites
- **Step Status**: Track step completion status
- **Progress Tracking**: Volume-based progress (M³)
- **Step Ordering**: Sequential step management
- **Step Inventory**: Link inventory consumption to steps

#### 3.3.2 Step Features
- Estimated vs actual volume tracking
- Step completion percentage
- Status: pending, in-progress, completed
- Step-to-step dependencies
- Inventory consumption per step
- Receipt tracking for step inventory

---

### 3.4 Inventory Management

#### 3.4.1 Inventory Locations
- **Site Inventory**: Inventory at construction sites
- **Storage Sites**: Centralized storage locations
- **Plant Inventory**: Inventory at production plants
- **Step Inventory**: Inventory for workflow steps

#### 3.4.2 Inventory Operations
- **CRUD Operations**: Create, read, update, delete inventory items
- **Stock Management**: Track quantities, units, types
- **Restocking**: Add inventory to locations
- **Consumption**: Record inventory usage
- **Transfers**: Move inventory between locations
- **Dispatch**: Ship inventory to sites
- **Receipt**: Receive inventory at sites

#### 3.4.3 Inventory Features
- Low stock alerts: Automatic alerts when stock is low
- Stock history: Track all inventory movements
- Multi-unit support: Support for different measurement units
- Inventory types: Categorize by material type
- Batch tracking: Track inventory by batch/lot

---

### 3.5 Plant Management

#### 3.5.1 Plant Operations
- **Plant CRUD**: Create, read, update, delete plants
- **Plant Types**: Configurable plant types
- **Plant Status**: Active, inactive, maintenance
- **Plant Inventory**: Manage materials at plants
- **Plant Output**: Track production output

#### 3.5.2 Production Management
- **Production Batches**: Create and track production batches
- **Output Tracking**: Record plant output quantities
- **Output Types**: Configurable output types (e.g., concrete, asphalt)
- **Dispatch Management**: Ship output to sites
- **Receipt Tracking**: Receive output at destination sites

#### 3.5.3 Plant Features
- Production capacity tracking
- Output quality tracking
- Batch management with dates and quantities
- Plant-to-site dispatch workflow
- Production analytics

---

### 3.6 Storage Site Management

#### 3.6.1 Storage Site Operations
- **CRUD Operations**: Manage storage locations
- **Site Types**: Different types of storage sites
- **Access Control**: Role-based access to storage sites
- **Inventory Tracking**: Track all inventory at storage sites

#### 3.6.2 Storage Site Features
- Location management
- Capacity tracking
- Inventory levels per storage site
- Transfer operations from/to storage sites
- Vehicle tracking at storage sites

---

### 3.7 Vehicle Management

#### 3.7.1 Vehicle Operations
- **Vehicle CRUD**: Register and manage vehicles
- **Vehicle Status**: Track vehicle availability, maintenance status
- **Vehicle Assignment**: Assign vehicles to sites/trips
- **Trip Management**: Track vehicle trips and routes

#### 3.7.2 Vehicle Features
- Vehicle information: License, type, capacity
- Vehicle status: Available, in-use, maintenance
- Trip history: Complete trip logs
- Trip reports: Detailed trip information
- Vehicle analytics: Usage statistics, efficiency metrics
- Maintenance tracking: Scheduled and unscheduled maintenance

---

### 3.8 Fuel Management

#### 3.8.1 Fuel Storage
- **Fuel Storage Sites**: Manage fuel storage locations
- **Storage Levels**: Track fuel quantities per location
- **Storage Types**: Main storage and sub-storage sites
- **Storage Capacity**: Maximum capacity tracking

#### 3.8.2 Fuel Operations
- **Fuel Transfers**: Transfer fuel between storage locations
- **Fuel Restocking**: Add fuel to storage sites
- **Fuel Logging**: Record fuel usage and refueling
- **Vehicle Refueling**: Track fuel consumption per vehicle

#### 3.8.3 Fuel Features
- Fuel type support: Diesel, petrol, etc.
- Low fuel alerts
- Fuel consumption analytics
- Vehicle fuel efficiency tracking
- Transfer receipts and documentation

---

### 3.9 Attendance Management

#### 3.9.1 Attendance Operations
- **Check-in/Check-out**: Record employee attendance
- **Attendance Tracking**: Daily attendance records
- **Location-based**: Track attendance by site
- **Time Tracking**: Entry and exit times

#### 3.9.2 Attendance Features
- Daily attendance reports
- Site-wise attendance
- User attendance history
- Attendance analytics
- Missing attendance alerts

---

### 3.10 Alert & Notification System

#### 3.10.1 Alert Types
- **Low Stock Alerts**: Inventory below threshold
- **System Alerts**: Critical system notifications
- **Activity Alerts**: Important activity notifications
- **Custom Alerts**: Configurable alert types

#### 3.10.2 Notification Features
- Real-time notifications
- Notification preferences
- Read/unread status
- Notification history
- Email notifications (optional)

---

### 3.11 Activity Logging

#### 3.11.1 Activity Tracking
- **Comprehensive Logging**: All user actions logged
- **Activity Categories**: Grouped by module (sites, inventory, vehicles, etc.)
- **Activity Types**: 40+ action types tracked
- **Metadata Support**: Custom metadata per activity

#### 3.11.2 Activity Features
- User action tracking
- Entity change tracking
- IP address and user agent logging
- Automatic expiration (90 days)
- Activity search and filtering
- Recent activities endpoint

---

### 3.12 Analytics & Reporting

#### 3.12.1 Vehicle Analytics
- Vehicle usage statistics
- Trip efficiency metrics
- Fuel consumption analytics
- Maintenance cost tracking
- Vehicle performance reports

#### 3.12.2 Production Analytics
- Plant output statistics
- Batch production reports
- Production efficiency metrics
- Output quality tracking

#### 3.12.3 Inventory Analytics
- Inventory turnover rates
- Stock level trends
- Consumption patterns
- Transfer activity reports

---

### 3.13 File Upload & Management

#### 3.13.1 File Operations
- **File Upload**: Support for image and document uploads
- **GridFS Storage**: Scalable file storage
- **File Retrieval**: Download uploaded files
- **Avatar Management**: User profile pictures

#### 3.13.2 File Features
- Image upload support
- Document upload support
- File size limits (10MB)
- Secure file access
- File deletion

---

## 4. API Endpoints

### 4.1 Authentication Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/refresh` - Refresh authentication token
- `GET /api/auth/me` - Get current user information

### 4.2 User Management Endpoints
- `GET /api/users` - List all users
- `GET /api/users/:id` - Get user details
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### 4.3 Site Management Endpoints
- `GET /api/sites` - List all sites
- `GET /api/sites/:id` - Get site details
- `POST /api/sites` - Create new site
- `PUT /api/sites/:id` - Update site
- `DELETE /api/sites/:id` - Delete site

### 4.4 Inventory Endpoints
- `GET /api/inventory` - List inventory items
- `GET /api/site-inventory` - Get site inventory
- `GET /api/storage-sites` - Get storage sites
- `POST /api/inventory-transfers` - Transfer inventory
- `POST /api/inventory-dispatch` - Dispatch inventory
- `GET /api/low-stock-alerts` - Get low stock alerts

### 4.5 Plant Management Endpoints
- `GET /api/plants` - List all plants
- `POST /api/plants` - Create plant
- `GET /api/plant-inventory` - Get plant inventory
- `POST /api/plant-output` - Create plant output
- `POST /api/plant-output-dispatch` - Dispatch plant output
- `GET /api/production-batches` - Get production batches

### 4.6 Vehicle Management Endpoints
- `GET /api/vehicles` - List all vehicles
- `POST /api/vehicles` - Create vehicle
- `GET /api/trip-reports` - Get trip reports
- `GET /api/vehicle-analytics` - Get vehicle analytics
- `GET /api/vehicle-maintenance` - Get maintenance records

### 4.7 Fuel Management Endpoints
- `GET /api/fuel/storages` - Get fuel storage sites
- `POST /api/fuel/transfers` - Transfer fuel
- `GET /api/fuel/logs` - Get fuel logs
- `POST /api/fuel` - Fuel management operations

### 4.8 Attendance Endpoints
- `POST /api/attendance` - Record attendance
- `GET /api/attendance` - Get attendance records

### 4.9 Notification Endpoints
- `GET /api/notifications` - Get notifications
- `PUT /api/notifications/:id/read` - Mark notification as read

### 4.10 Activity Endpoints
- `GET /api/recent-activities` - Get recent activities
- `GET /api/alerts` - Get system alerts

### 4.11 System Endpoints
- `GET /` - API status and endpoint list
- `GET /api/health` - Health check with database status

---

## 5. Data Models

### 5.1 Core Models
- **User**: User accounts, authentication, roles, permissions
- **Site**: Construction sites, location, status, progress
- **Step**: Workflow steps, progress tracking, status
- **Inventory**: Inventory items, quantities, locations
- **Stock**: Stock levels, units, types
- **Plant**: Production plants, types, status
- **Vehicle**: Vehicle registration, status, assignment
- **StorageSite**: Storage locations, capacity

### 5.2 Transaction Models
- **InventoryTransfer**: Inventory transfers between locations
- **InventoryDispatch**: Inventory dispatch to sites
- **InventoryReceipt**: Inventory receipt at sites
- **PlantOutput**: Plant production output
- **PlantOutputDispatch**: Plant output dispatch
- **PlantOutputReceipt**: Plant output receipt
- **ProductionBatch**: Production batch tracking
- **FuelTransfer**: Fuel transfers between storage
- **FuelRestock**: Fuel restocking operations
- **FuelLog**: Fuel usage and refueling logs
- **VehicleRefueling**: Vehicle refueling records
- **TripHistory**: Vehicle trip history

### 5.3 Supporting Models
- **Attendance**: Employee attendance records
- **Alert**: System alerts and notifications
- **Notification**: User notifications
- **ActivityLog**: User activity audit trail
- **VehicleAnalytics**: Vehicle performance analytics
- **VehicleMaintenance**: Vehicle maintenance records
- **DailyReading**: Daily operational readings

---

## 6. Security Requirements

### 6.1 Authentication
- JWT token-based authentication
- Token expiration (configurable, default 7 days)
- Secure password storage (bcrypt hashing)
- Account activation/deactivation

### 6.2 Authorization
- Role-based access control (RBAC)
- Permission-based endpoint access
- Site-based access restrictions
- Storage site access restrictions
- Admin override capabilities

### 6.3 Data Security
- Input validation on all endpoints
- SQL injection prevention (Mongoose)
- XSS protection (Helmet.js)
- CORS configuration
- Rate limiting (100 requests/15 minutes)
- Request size limits (10MB)

### 6.4 API Security
- HTTPS enforcement (production)
- Security headers (Helmet.js)
- Error message sanitization
- Request logging (errors only for performance)

---

## 7. Performance Requirements

### 7.1 Response Times
- Health check: < 100ms
- List endpoints: < 500ms (with pagination)
- Detail endpoints: < 300ms
- Create/Update operations: < 1s
- File uploads: < 5s (depending on file size)

### 7.2 Optimization Strategies
- **Database Indexing**: Indexes on frequently queried fields
- **Query Optimization**: Batch queries to prevent N+1 problems
- **Response Compression**: Gzip compression on all responses
- **Connection Pooling**: Optimized MongoDB connection management
- **Caching**: Response caching where appropriate (via middleware)
- **Lean Queries**: Use `.lean()` for read-only operations

### 7.3 Scalability
- Serverless architecture (Vercel)
- Horizontal scaling support
- Database connection pooling
- Efficient query patterns
- Pagination on list endpoints

---

## 8. Error Handling

### 8.1 Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error (development only)"
}
```

### 8.2 HTTP Status Codes
- `200 OK`: Successful GET, PUT, PATCH
- `201 Created`: Successful POST
- `400 Bad Request`: Invalid input
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error
- `503 Service Unavailable`: Database unavailable

### 8.3 Error Categories
- Authentication errors
- Authorization errors
- Validation errors
- Database errors
- Not found errors
- Server errors

---

## 9. Deployment & Infrastructure

### 9.1 Deployment Platform
- **Primary**: Vercel (Serverless)
- **Alternative**: Railway, Heroku, AWS Lambda

### 9.2 Environment Configuration
**Required Environment Variables:**
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: JWT signing secret
- `JWT_EXPIRES_IN`: Token expiration (default: "7d")

**Optional Environment Variables:**
- `EMAIL_HOST`: SMTP host for email
- `EMAIL_PORT`: SMTP port
- `EMAIL_USER`: Email username
- `EMAIL_PASS`: Email password
- `FRONTEND_URL`: Frontend URL for CORS
- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: 5000)

### 9.3 Database
- **Primary**: MongoDB Atlas (Cloud)
- **Database Name**: `construction_management`
- **Connection**: Optimized for serverless

### 9.4 Monitoring & Logging
- Health check endpoint for monitoring
- Error logging to console
- Activity logging for audit trails
- Database connection state monitoring

---

## 10. Development Guidelines

### 10.1 Code Structure
```
backend/
├── api/              # API entry point (Vercel)
├── config/           # Configuration files
├── middleware/       # Express middleware
├── models/           # Mongoose models
├── routes/           # API routes
├── utils/            # Utility functions
├── server.js         # Local server (development)
└── package.json      # Dependencies
```

### 10.2 Coding Standards
- Use async/await for async operations
- Implement proper error handling
- Validate all inputs
- Use middleware for authentication/authorization
- Follow RESTful conventions
- Use meaningful variable names
- Add comments for complex logic

### 10.3 Testing Strategy
- Unit tests for utilities
- Integration tests for routes
- Manual API testing
- Health check monitoring

---

## 11. Future Enhancements

### 11.1 Planned Features
- GraphQL API support
- Real-time updates via WebSockets
- Advanced reporting and analytics
- Bulk operations API
- Data export functionality (CSV, Excel)
- Image optimization and CDN integration
- Advanced search functionality
- Audit log export

### 11.2 Performance Improvements
- Redis caching layer
- Database read replicas
- API response compression improvements
- Background job processing
- Database query optimization

### 11.3 Security Enhancements
- OAuth 2.0 support
- Two-factor authentication (2FA)
- API key management
- IP whitelisting
- Advanced rate limiting strategies

---

## 12. Maintenance & Support

### 12.1 Regular Maintenance
- Database index optimization
- Activity log cleanup (90-day retention)
- Performance monitoring
- Security updates
- Dependency updates

### 12.2 Support Documentation
- API documentation (inline comments)
- Deployment guides
- Performance optimization guides
- Activity logging documentation
- CORS configuration documentation

---

## 13. Success Metrics

### 13.1 Performance Metrics
- API response time < 500ms (95th percentile)
- Uptime > 99.9%
- Database query time < 100ms (average)
- Zero data loss incidents

### 13.2 User Metrics
- Successful authentication rate > 99%
- API error rate < 1%
- User satisfaction with API performance
- System adoption rate

---

## 14. Appendix

### 14.1 API Response Examples

#### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

#### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error (development only)"
}
```

### 14.2 Database Schema Highlights
- All models use Mongoose ODM
- Automatic timestamps (createdAt, updatedAt)
- Soft delete support (isActive flags)
- Indexed fields for performance
- Schema validation

### 14.3 Dependencies Summary
- **Core**: express, mongoose
- **Security**: helmet, cors, express-rate-limit, bcryptjs, jsonwebtoken
- **Utilities**: compression, dotenv, multer, xlsx
- **Email**: nodemailer
- **Scheduling**: node-cron
- **File Storage**: gridfs-stream

---

**Document Version**: 1.0.0  
**Last Updated**: December 2024  
**Maintained By**: Development Team

