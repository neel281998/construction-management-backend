// Step configurations for different site types
const stepConfigurations = {
  BT_ROAD: [
    {
      stepNumber: 1,
      stepName: 'Site Preparation',
      stepType: 'custom',
      primaryStock: 'Excavation Equipment',
      secondaryStock: 'Survey Equipment',
      defaultDimensions: {
        length: 0,
        breadth: 0,
        height: 0,
        thickness: 0,
        unit: 'm'
      }
    },
    {
      stepNumber: 2,
      stepName: 'Subgrade Preparation',
      stepType: 'road_base',
      primaryStock: 'Soil',
      secondaryStock: 'Compaction Equipment',
      defaultDimensions: {
        length: 0,
        breadth: 0,
        thickness: 0.3,
        unit: 'm'
      }
    },
    {
      stepNumber: 3,
      stepName: 'Base Course',
      stepType: 'road_base',
      primaryStock: 'Aggregate',
      secondaryStock: 'Bitumen',
      defaultDimensions: {
        length: 0,
        breadth: 0,
        thickness: 0.2,
        unit: 'm'
      }
    },
    {
      stepNumber: 4,
      stepName: 'Bituminous Surface',
      stepType: 'road_surface',
      primaryStock: 'Bitumen',
      secondaryStock: 'Aggregate',
      defaultDimensions: {
        length: 0,
        breadth: 0,
        thickness: 0.05,
        unit: 'm'
      }
    }
  ],
  
  CC_ROAD: [
    {
      stepNumber: 1,
      stepName: 'Site Preparation',
      stepType: 'custom',
      primaryStock: 'Excavation Equipment',
      secondaryStock: 'Survey Equipment',
      defaultDimensions: {
        length: 0,
        breadth: 0,
        height: 0,
        thickness: 0,
        unit: 'm'
      }
    },
    {
      stepNumber: 2,
      stepName: 'Subgrade Preparation',
      stepType: 'road_base',
      primaryStock: 'Soil',
      secondaryStock: 'Compaction Equipment',
      defaultDimensions: {
        length: 0,
        breadth: 0,
        thickness: 0.3,
        unit: 'm'
      }
    },
    {
      stepNumber: 3,
      stepName: 'Base Course',
      stepType: 'road_base',
      primaryStock: 'Aggregate',
      secondaryStock: 'Cement',
      defaultDimensions: {
        length: 0,
        breadth: 0,
        thickness: 0.15,
        unit: 'm'
      }
    },
    {
      stepNumber: 4,
      stepName: 'Concrete Surface',
      stepType: 'slab',
      primaryStock: 'Concrete',
      secondaryStock: 'Reinforcement',
      defaultDimensions: {
        length: 0,
        breadth: 0,
        thickness: 0.2,
        unit: 'm'
      }
    }
  ],
  
  BRIDGE: [
    {
      stepNumber: 1,
      stepName: 'Foundation',
      stepType: 'foundation',
      primaryStock: 'Concrete',
      secondaryStock: 'Reinforcement',
      defaultDimensions: {
        length: 0,
        breadth: 0,
        thickness: 1.0,
        unit: 'm'
      }
    },
    {
      stepNumber: 2,
      stepName: 'Piers/Columns',
      stepType: 'column',
      primaryStock: 'Concrete',
      secondaryStock: 'Reinforcement',
      defaultDimensions: {
        count: 0,
        length: 0.8,
        breadth: 0.8,
        height: 0,
        unit: 'm'
      }
    },
    {
      stepNumber: 3,
      stepName: 'Beams',
      stepType: 'beam',
      primaryStock: 'Concrete',
      secondaryStock: 'Reinforcement',
      defaultDimensions: {
        length: 0,
        breadth: 0.6,
        height: 1.2,
        unit: 'm'
      }
    },
    {
      stepNumber: 4,
      stepName: 'Deck Slab',
      stepType: 'slab',
      primaryStock: 'Concrete',
      secondaryStock: 'Reinforcement',
      defaultDimensions: {
        length: 0,
        breadth: 0,
        thickness: 0.25,
        unit: 'm'
      }
    }
  ],
  
  DRAINAGE: [
    {
      stepNumber: 1,
      stepName: 'Excavation',
      stepType: 'drainage',
      primaryStock: 'Excavation Equipment',
      secondaryStock: 'Survey Equipment',
      defaultDimensions: {
        length: 0,
        breadth: 0,
        height: 0,
        unit: 'm'
      }
    },
    {
      stepNumber: 2,
      stepName: 'Pipe Installation',
      stepType: 'drainage',
      primaryStock: 'Drainage Pipes',
      secondaryStock: 'Pipe Fittings',
      defaultDimensions: {
        length: 0,
        breadth: 0.6,
        height: 0.6,
        unit: 'm'
      }
    },
    {
      stepNumber: 3,
      stepName: 'Backfilling',
      stepType: 'drainage',
      primaryStock: 'Soil',
      secondaryStock: 'Compaction Equipment',
      defaultDimensions: {
        length: 0,
        breadth: 0,
        height: 0,
        unit: 'm'
      }
    },
    {
      stepNumber: 4,
      stepName: 'Surface Restoration',
      stepType: 'custom',
      primaryStock: 'Asphalt/Concrete',
      secondaryStock: 'Compaction Equipment',
      defaultDimensions: {
        length: 0,
        breadth: 0,
        thickness: 0.1,
        unit: 'm'
      }
    }
  ]
};

// Function to create steps for a site based on site type
const createStepsForSite = async (siteId, siteType, estimatedVolumeM3) => {
  const Step = require('../models/Step');
  const stepConfig = stepConfigurations[siteType];
  
  if (!stepConfig) {
    throw new Error(`No step configuration found for site type: ${siteType}`);
  }
  
  const steps = [];
  const volumePerStep = estimatedVolumeM3 / stepConfig.length;
  
  for (let i = 0; i < stepConfig.length; i++) {
    const config = stepConfig[i];
    const stepData = {
      siteId,
      stepNumber: config.stepNumber,
      stepName: config.stepName,
      stepType: config.stepType,
      primaryStock: config.primaryStock,
      secondaryStock: config.secondaryStock,
      estimatedVolumeM3: volumePerStep,
      estimatedDimensions: {
        ...config.defaultDimensions,
        // Set default values that will be updated by user
        length: config.defaultDimensions.length || 0,
        breadth: config.defaultDimensions.breadth || 0,
        height: config.defaultDimensions.height || 0,
        thickness: config.defaultDimensions.thickness || 0,
        count: config.defaultDimensions.count || 1,
        unit: config.defaultDimensions.unit || 'm'
      },
      completedDimensions: {
        length: 0,
        breadth: 0,
        height: 0,
        thickness: 0,
        count: 0,
        unit: config.defaultDimensions.unit || 'm'
      },
      volumeCalculations: {
        estimatedVolume: 0,
        completedVolume: 0,
        volumeUnit: 'm³'
      },
      status: 'pending'
    };
    
    const step = new Step(stepData);
    await step.save();
    steps.push(step);
  }
  
  return steps;
};

// Function to get step type configuration
const getStepTypeConfig = (stepType) => {
  const stepTypeConfigs = {
    foundation: {
      name: 'Foundation',
      requiredFields: ['length', 'breadth', 'thickness'],
      optionalFields: ['depth', 'reinforcement'],
      defaultThickness: 0.5,
      unit: 'm'
    },
    wall: {
      name: 'Wall Construction',
      requiredFields: ['length', 'height', 'thickness'],
      optionalFields: ['openings', 'reinforcement'],
      defaultThickness: 0.2,
      unit: 'm'
    },
    slab: {
      name: 'Slab/Floor',
      requiredFields: ['length', 'breadth', 'thickness'],
      optionalFields: ['reinforcement', 'finishing'],
      defaultThickness: 0.15,
      unit: 'm'
    },
    column: {
      name: 'Column',
      requiredFields: ['count', 'length', 'breadth', 'height'],
      optionalFields: ['reinforcement', 'spacing'],
      defaultThickness: 0.3,
      unit: 'm'
    },
    beam: {
      name: 'Beam',
      requiredFields: ['length', 'breadth', 'height'],
      optionalFields: ['reinforcement', 'spacing'],
      defaultThickness: 0.3,
      unit: 'm'
    },
    roof: {
      name: 'Roof',
      requiredFields: ['length', 'breadth', 'thickness'],
      optionalFields: ['slope', 'insulation'],
      defaultThickness: 0.1,
      unit: 'm'
    },
    road_base: {
      name: 'Road Base',
      requiredFields: ['length', 'breadth', 'thickness'],
      optionalFields: ['material_type', 'compaction'],
      defaultThickness: 0.2,
      unit: 'm'
    },
    road_surface: {
      name: 'Road Surface',
      requiredFields: ['length', 'breadth', 'thickness'],
      optionalFields: ['material_type', 'finishing'],
      defaultThickness: 0.05,
      unit: 'm'
    },
    drainage: {
      name: 'Drainage',
      requiredFields: ['length', 'breadth', 'height'],
      optionalFields: ['pipe_diameter', 'slope'],
      defaultThickness: 0.3,
      unit: 'm'
    },
    custom: {
      name: 'Custom',
      requiredFields: ['length', 'breadth', 'height'],
      optionalFields: ['thickness', 'count'],
      defaultThickness: 0.1,
      unit: 'm'
    }
  };
  
  return stepTypeConfigs[stepType] || stepTypeConfigs.custom;
};

module.exports = {
  stepConfigurations,
  createStepsForSite,
  getStepTypeConfig
};
