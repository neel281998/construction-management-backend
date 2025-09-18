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
      Inventory.deleteMany({}),
      Step.deleteMany({}),
      Stock.deleteMany({})
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
    
    // Create sites with new site types
    const site1 = new Site({
      name: 'Main Highway BT Road',
      siteType: 'BT_ROAD',
      description: 'Bituminous road construction on main highway',
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

      estimatedVolumeM3: 680,
      totalProgressM3: 442,
      currentStep: 3,
      siteManager: siteManager._id,
      progress: 65,
      assignedStaff: [
        { user: worker1._id, role: 'worker' },
        { user: worker2._id, role: 'worker' }
      ]
    });
    await site1.save();
    
    const site2 = new Site({
      name: 'City Bridge Construction',
      siteType: 'BRIDGE',
      description: 'Major bridge construction over river',
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

      estimatedVolumeM3: 1650,
      totalProgressM3: 1402.5,
      currentStep: 4,
      siteManager: siteManager._id,
      progress: 85,
      assignedStaff: [
        { user: worker1._id, role: 'supervisor' }
      ]
    });
    await site2.save();
    
    const site3 = new Site({
      name: 'Residential CC Road',
      siteType: 'CC_ROAD',
      description: 'Cement concrete road in residential area',
      address: {
        street: '789 Residential Blvd',
        city: 'Queens',
        state: 'NY',
        zipCode: '11375',
        coordinates: {
          latitude: 40.7282,
          longitude: -73.7949
        }
      },
      status: 'planning',
      startDate: new Date('2024-03-01'),
      expectedEndDate: new Date('2024-08-30'),

      estimatedVolumeM3: 750,
      totalProgressM3: 0,
      currentStep: 1,
      siteManager: siteManager._id,
      progress: 0
    });
    await site3.save();
    
    const site4 = new Site({
      name: 'Storm Drainage System',
      siteType: 'DRAINAGE',
      description: 'Storm water drainage system construction',
      address: {
        street: '321 Industrial Park',
        city: 'Bronx',
        state: 'NY',
        zipCode: '10451',
        coordinates: {
          latitude: 40.8448,
          longitude: -73.8648
        }
      },
      status: 'active',
      startDate: new Date('2024-02-01'),
      expectedEndDate: new Date('2024-05-30'),

      estimatedVolumeM3: 390,
      totalProgressM3: 195,
      currentStep: 2,
      siteManager: siteManager._id,
      progress: 50
    });
    await site4.save();
    console.log('Created sites...');
    
    // Update user assigned sites
    await User.findByIdAndUpdate(siteManager._id, {
      assignedSites: [site1._id, site2._id, site3._id, site4._id]
    });
    await User.findByIdAndUpdate(worker1._id, {
      assignedSites: [site1._id, site2._id, site4._id]
    });
    await User.findByIdAndUpdate(worker2._id, {
      assignedSites: [site1._id, site3._id]
    });
    
    // Create vehicles with capacity
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
          address: 'Main Highway BT Road, New York, NY',
          lastUpdated: new Date()
        },
        assignedSite: site1._id,
        assignedTo: worker1._id,
        fuelLevel: 85,
        specifications: {
          engineType: 'Diesel',
          fuelCapacity: 400,
          maxLoad: 25000,
          capacityM3: 15
        },
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
        specifications: {
          engineType: 'Diesel',
          fuelCapacity: 300,
          maxLoad: 20000,
          capacityM3: 1.2
        },
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
        specifications: {
          engineType: 'Diesel',
          fuelCapacity: 500,
          maxLoad: 50000,
          capacityM3: 0
        },
        maintenanceSchedule: {
          nextService: new Date('2024-01-20'),
          lastService: new Date('2023-10-20'),
          mileage: 28000
        }
      },
      {
        vehicleNumber: 'DT-004',
        type: 'dump_truck',
        brand: 'Tata',
        model: 'LPK 2518',
        year: 2023,
        status: 'available',
        currentLocation: {
          latitude: 40.8448,
          longitude: -73.8648,
          address: 'Storm Drainage System, Bronx, NY',
          lastUpdated: new Date()
        },
        fuelLevel: 78,
        specifications: {
          engineType: 'Diesel',
          fuelCapacity: 200,
          maxLoad: 18000,
          capacityM3: 12
        },
        maintenanceSchedule: {
          nextService: new Date('2024-04-01'),
          lastService: new Date('2024-01-01'),
          mileage: 15000
        }
      },
      {
        vehicleNumber: 'MX-005',
        type: 'mixer',
        brand: 'Schwing',
        model: 'SPM 5000',
        year: 2022,
        status: 'available',
        currentLocation: {
          latitude: 40.7282,
          longitude: -73.7949,
          address: 'Residential CC Road, Queens, NY',
          lastUpdated: new Date()
        },
        fuelLevel: 90,
        specifications: {
          engineType: 'Diesel',
          fuelCapacity: 350,
          maxLoad: 12000,
          capacityM3: 8
        },
        maintenanceSchedule: {
          nextService: new Date('2024-03-15'),
          lastService: new Date('2023-12-15'),
          mileage: 22000
        }
      }
    ];
    
    await Vehicle.insertMany(vehicles);
    console.log('Created vehicles...');
    
    // Create inventory items
    const inventoryItems = [
      {
        itemName: 'Portland Cement',
        category: 'Building Materials',
        description: 'High-quality portland cement for construction',
        unit: 'kg',
        currentStock: 50,
        minimumStock: 100,
        maximumStock: 500,

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
        category: 'Steel Products',
        description: '12mm steel reinforcement bars',
        unit: 'pieces',
        currentStock: 250,
        minimumStock: 100,
        maximumStock: 400,

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
        category: 'Safety Equipment',
        description: 'ANSI approved safety helmets',
        unit: 'pieces',
        currentStock: 25,
        minimumStock: 50,
        maximumStock: 200,

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
        category: 'Building Materials',
        description: 'Standard concrete building blocks',
        unit: 'pieces',
        currentStock: 800,
        minimumStock: 200,
        maximumStock: 1000,

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
        category: 'Finishing Materials',
        description: 'High-quality white primer paint',
        unit: 'liters',
        currentStock: 15,
        minimumStock: 20,
        maximumStock: 100,

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
    
    // Create steps for existing sites
    const Step = require('../models/Step');
    const { getStepsForSiteType } = require('../config/siteTypes');
    
    // Create steps for BT Road site
    const btRoadSteps = getStepsForSiteType('BT_ROAD');
    const btRoadStepPromises = btRoadSteps.map((stepConfig, index) => {
      const progressM3 = index < 3 ? stepConfig.defaultVolumeM3 * 0.65 : 0; // First 3 steps 65% complete
      const status = index < 3 ? 'completed' : (index === 3 ? 'in_progress' : 'pending');
      
      return new Step({
        siteId: site1._id,
        stepNumber: stepConfig.stepNumber,
        stepName: stepConfig.stepName,
        primaryStock: stepConfig.primaryStock,
        secondaryStock: stepConfig.secondaryStock,
        estimatedVolumeM3: stepConfig.defaultVolumeM3,
        progressM3,
        status,
        startDate: index < 3 ? new Date('2024-01-01') : null,
        completedDate: index < 2 ? new Date('2024-01-15') : null
      }).save();
    });
    await Promise.all(btRoadStepPromises);
    
    // Create steps for Bridge site
    const bridgeSteps = getStepsForSiteType('BRIDGE');
    const bridgeStepPromises = bridgeSteps.map((stepConfig, index) => {
      const progressM3 = index < 4 ? stepConfig.defaultVolumeM3 * 0.85 : 0; // First 4 steps 85% complete
      const status = index < 4 ? 'completed' : 'pending';
      
      return new Step({
        siteId: site2._id,
        stepNumber: stepConfig.stepNumber,
        stepName: stepConfig.stepName,
        primaryStock: stepConfig.primaryStock,
        secondaryStock: stepConfig.secondaryStock,
        estimatedVolumeM3: stepConfig.defaultVolumeM3,
        progressM3,
        status,
        startDate: index < 4 ? new Date('2023-09-01') : null,
        completedDate: index < 4 ? new Date('2024-01-20') : null
      }).save();
    });
    await Promise.all(bridgeStepPromises);
    
    // Create steps for CC Road site (planning stage)
    const ccRoadSteps = getStepsForSiteType('CC_ROAD');
    const ccRoadStepPromises = ccRoadSteps.map(stepConfig => {
      return new Step({
        siteId: site3._id,
        stepNumber: stepConfig.stepNumber,
        stepName: stepConfig.stepName,
        primaryStock: stepConfig.primaryStock,
        secondaryStock: stepConfig.secondaryStock,
        estimatedVolumeM3: stepConfig.defaultVolumeM3,
        progressM3: 0,
        status: 'pending'
      }).save();
    });
    await Promise.all(ccRoadStepPromises);
    
    // Create steps for Drainage site
    const drainageSteps = getStepsForSiteType('DRAINAGE');
    const drainageStepPromises = drainageSteps.map((stepConfig, index) => {
      const progressM3 = index < 2 ? stepConfig.defaultVolumeM3 * 0.5 : 0; // First 2 steps 50% complete
      const status = index < 2 ? 'in_progress' : 'pending';
      
      return new Step({
        siteId: site4._id,
        stepNumber: stepConfig.stepNumber,
        stepName: stepConfig.stepName,
        primaryStock: stepConfig.primaryStock,
        secondaryStock: stepConfig.secondaryStock,
        estimatedVolumeM3: stepConfig.defaultVolumeM3,
        progressM3,
        status,
        startDate: index < 2 ? new Date('2024-02-01') : null
      }).save();
    });
    await Promise.all(drainageStepPromises);
    
    console.log('Created steps for all sites...');
    
    // Create sample stock consumption data
    const Stock = require('../models/Stock');
    
    // Get step IDs for stock creation
    const btRoadStep1 = await Step.findOne({ siteId: site1._id, stepNumber: 1 });
    const bridgeStep1 = await Step.findOne({ siteId: site2._id, stepNumber: 1 });
    const drainageStep1 = await Step.findOne({ siteId: site4._id, stepNumber: 1 });
    
    const sampleStocks = [
      // BT Road - Site Clearing
      {
        siteId: site1._id,
        stepId: btRoadStep1._id,
        stockType: 'primary',
        materialName: 'Excavator',
        quantityM3: 65,
        supplier: 'Heavy Equipment Co',
        date: new Date('2024-01-05')
      },
      {
        siteId: site1._id,
        stepId: btRoadStep1._id,
        stockType: 'secondary',
        materialName: 'Dump Soil',
        quantityM3: 100,
        supplier: 'Soil Suppliers Ltd',
        date: new Date('2024-01-05')
      },
      // Bridge - Foundation
      {
        siteId: site2._id,
        stepId: bridgeStep1._id,
        stockType: 'primary',
        materialName: 'Cement',
        quantityM3: 255,
        supplier: 'Cement Corp',
        date: new Date('2023-09-10')
      },
      {
        siteId: site2._id,
        stepId: bridgeStep1._id,
        stockType: 'secondary',
        materialName: 'Steel',
        quantityM3: 45,
        supplier: 'Steel Works Inc',
        date: new Date('2023-09-10')
      },
      // Drainage - Excavation
      {
        siteId: site4._id,
        stepId: drainageStep1._id,
        stockType: 'primary',
        materialName: 'Excavator',
        quantityM3: 40,
        supplier: 'Heavy Equipment Co',
        date: new Date('2024-02-05')
      },
      {
        siteId: site4._id,
        stepId: drainageStep1._id,
        stockType: 'secondary',
        materialName: 'Dump Soil',
        quantityM3: 40,
        supplier: 'Soil Suppliers Ltd',
        date: new Date('2024-02-05')
      }
    ];
    
    await Stock.insertMany(sampleStocks);
    console.log('Created sample stock consumption data...');
    
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