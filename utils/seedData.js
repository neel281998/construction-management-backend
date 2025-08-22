const mongoose = require('mongoose');
const User = require('../models/User');
const Site = require('../models/Site');
const Vehicle = require('../models/Vehicle');
const Inventory = require('../models/Inventory');
require('dotenv').config();

const seedData = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/construction_management');
    console.log('Connected to MongoDB for seeding...');
    
    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Site.deleteMany({}),
      Vehicle.deleteMany({}),
      Inventory.deleteMany({})
    ]);
    console.log('Cleared existing data...');
    
    // Create admin user
    const adminUser = new User({
      email: 'admin@construction.com',
      phone: '+1-555-0001',
      password: 'admin123',
      firstName: 'John',
      lastName: 'Admin',
      role: 'admin',
      isVerified: true
    });
    await adminUser.save();
    console.log('Created admin user...');
    
    // Create site manager
    const siteManager = new User({
      email: 'manager@construction.com',
      phone: '+1-555-0002',
      password: 'manager123',
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'site_manager',
      isVerified: true
    });
    await siteManager.save();
    console.log('Created site manager...');
    
    // Create workers
    const worker1 = new User({
      email: 'worker@construction.com',
      phone: '+1-555-0003',
      password: 'worker123',
      firstName: 'Mike',
      lastName: 'Johnson',
      role: 'worker',
      isVerified: true
    });
    await worker1.save();
    
    const worker2 = new User({
      email: 'worker2@construction.com',
      phone: '+1-555-0004',
      password: 'worker123',
      firstName: 'Sarah',
      lastName: 'Wilson',
      role: 'worker',
      isVerified: true
    });
    await worker2.save();
    
    // Create inventory manager
    const inventoryManager = new User({
      email: 'inventory@construction.com',
      phone: '+1-555-0005',
      password: 'inventory123',
      firstName: 'Tom',
      lastName: 'Brown',
      role: 'inventory_manager',
      isVerified: true
    });
    await inventoryManager.save();
    console.log('Created users...');
    
    // Create sites
    const site1 = new Site({
      name: 'Downtown Office Complex',
      description: 'Modern office building construction',
      address: {
        street: '123 Business Ave',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        coordinates: {
          latitude: 40.7128,
          longitude: -74.0060
        }
      },
      status: 'active',
      startDate: new Date('2024-01-01'),
      expectedEndDate: new Date('2024-06-30'),
      budget: 1500000,
      currentCost: 950000,
      siteManager: siteManager._id,
      progress: 65,
      assignedStaff: [
        { user: worker1._id, role: 'worker' },
        { user: worker2._id, role: 'worker' }
      ]
    });
    await site1.save();
    
    const site2 = new Site({
      name: 'Residential Tower A',
      description: 'Luxury residential tower construction',
      address: {
        street: '456 Housing St',
        city: 'Brooklyn',
        state: 'NY',
        zipCode: '11201',
        coordinates: {
          latitude: 40.6892,
          longitude: -73.9442
        }
      },
      status: 'active',
      startDate: new Date('2023-09-01'),
      expectedEndDate: new Date('2024-04-15'),
      budget: 2200000,
      currentCost: 1870000,
      siteManager: siteManager._id,
      progress: 85,
      assignedStaff: [
        { user: worker1._id, role: 'supervisor' }
      ]
    });
    await site2.save();
    console.log('Created sites...');
    
    // Update user assigned sites
    await User.findByIdAndUpdate(siteManager._id, {
      assignedSites: [site1._id, site2._id]
    });
    await User.findByIdAndUpdate(worker1._id, {
      assignedSites: [site1._id, site2._id]
    });
    await User.findByIdAndUpdate(worker2._id, {
      assignedSites: [site1._id]
    });
    
    // Create vehicles
    const vehicles = [
      {
        vehicleNumber: 'TR-001',
        type: 'truck',
        brand: 'Volvo',
        model: 'FMX 450',
        year: 2022,
        status: 'in_use',
        currentLocation: {
          latitude: 40.7128,
          longitude: -74.0060,
          address: 'Downtown Office Complex, New York, NY',
          lastUpdated: new Date()
        },
        assignedSite: site1._id,
        assignedTo: worker1._id,
        fuelLevel: 85,
        maintenanceSchedule: {
          nextService: new Date('2024-02-15'),
          lastService: new Date('2023-11-15'),
          mileage: 45000
        }
      },
      {
        vehicleNumber: 'EX-002',
        type: 'excavator',
        brand: 'Caterpillar',
        model: '320 GC',
        year: 2021,
        status: 'available',
        currentLocation: {
          latitude: 40.6892,
          longitude: -73.9442,
          address: 'Main Depot, Brooklyn, NY',
          lastUpdated: new Date()
        },
        fuelLevel: 92,
        maintenanceSchedule: {
          nextService: new Date('2024-03-01'),
          lastService: new Date('2023-12-01'),
          mileage: 32000
        }
      },
      {
        vehicleNumber: 'CR-003',
        type: 'crane',
        brand: 'Liebherr',
        model: 'LTM 1050',
        year: 2020,
        status: 'maintenance',
        currentLocation: {
          latitude: 40.7282,
          longitude: -73.7949,
          address: 'Service Center, Queens, NY',
          lastUpdated: new Date()
        },
        fuelLevel: 45,
        maintenanceSchedule: {
          nextService: new Date('2024-01-20'),
          lastService: new Date('2023-10-20'),
          mileage: 28000
        }
      }
    ];
    
    await Vehicle.insertMany(vehicles);
    console.log('Created vehicles...');
    
    // Create inventory items
    const inventoryItems = [
      {
        itemName: 'Portland Cement',
        itemCode: 'CEM-001',
        category: 'Building Materials',
        description: 'High-quality portland cement for construction',
        unit: 'kg',
        currentStock: 50,
        minimumStock: 100,
        maximumStock: 500,
        unitPrice: 12.50,
        supplier: {
          name: 'ABC Building Supplies',
          contact: '+1-555-0101',
          email: 'orders@abcbuilding.com'
        },
        location: 'Warehouse A - Section 1',
        lastRestocked: new Date('2024-01-10')
      },
      {
        itemName: 'Steel Rebar - 12mm',
        itemCode: 'STL-012',
        category: 'Steel Products',
        description: '12mm steel reinforcement bars',
        unit: 'pieces',
        currentStock: 250,
        minimumStock: 100,
        maximumStock: 400,
        unitPrice: 8.75,
        supplier: {
          name: 'Steel Works Inc',
          contact: '+1-555-0202',
          email: 'sales@steelworks.com'
        },
        location: 'Warehouse B - Section 3',
        lastRestocked: new Date('2024-01-08')
      },
      {
        itemName: 'Safety Helmets',
        itemCode: 'SAF-001',
        category: 'Safety Equipment',
        description: 'ANSI approved safety helmets',
        unit: 'pieces',
        currentStock: 25,
        minimumStock: 50,
        maximumStock: 200,
        unitPrice: 15.99,
        supplier: {
          name: 'Safety First Co',
          contact: '+1-555-0303',
          email: 'orders@safetyfirst.com'
        },
        location: 'Warehouse A - Section 5',
        lastRestocked: new Date('2024-01-05')
      },
      {
        itemName: 'Concrete Blocks',
        itemCode: 'BLK-001',
        category: 'Building Materials',
        description: 'Standard concrete building blocks',
        unit: 'pieces',
        currentStock: 800,
        minimumStock: 200,
        maximumStock: 1000,
        unitPrice: 2.25,
        supplier: {
          name: 'Block Masters',
          contact: '+1-555-0404',
          email: 'info@blockmasters.com'
        },
        location: 'Yard - Area C',
        lastRestocked: new Date('2024-01-12')
      },
      {
        itemName: 'Paint - White Primer',
        itemCode: 'PNT-001',
        category: 'Finishing Materials',
        description: 'High-quality white primer paint',
        unit: 'liters',
        currentStock: 15,
        minimumStock: 20,
        maximumStock: 100,
        unitPrice: 25.50,
        supplier: {
          name: 'Color Pro Paints',
          contact: '+1-555-0505',
          email: 'orders@colorpro.com'
        },
        location: 'Storage Room 1',
        lastRestocked: new Date('2024-01-07')
      }
    ];
    
    await Inventory.insertMany(inventoryItems);
    console.log('Created inventory items...');
    
    console.log('✅ Seed data created successfully!');
    console.log('\n📋 Demo Credentials:');
    console.log('Admin: admin@construction.com / admin123');
    console.log('Manager: manager@construction.com / manager123');
    console.log('Worker: worker@construction.com / worker123');
    console.log('Inventory: inventory@construction.com / inventory123');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Seed data creation failed:', error);
    process.exit(1);
  }
};

// Run seeding if called directly
if (require.main === module) {
  seedData();
}

module.exports = seedData;