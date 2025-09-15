// Step configurations for different site types
const stepConfigurations = {
  BT_ROAD: [
    {
      stepNumber: 1,
      stepName: 'Site Clearing',
      stepType: 'custom',
      primaryStock: 'Excavation Equipment',
      secondaryStock: 'Survey Equipment',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        height: 1,
        thickness: 0,
        unit: 'm'
      }
    },
    {
      stepNumber: 2,
      stepName: 'Scarifying Existing BT',
      stepType: 'road_base',
      primaryStock: 'Scarifying Equipment',
      secondaryStock: 'Bitumen',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.05,
        unit: 'm'
      }
    },
    {
      stepNumber: 3,
      stepName: 'Embankment 1',
      stepType: 'road_base',
      primaryStock: 'Soil',
      secondaryStock: 'Compaction Equipment',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.3,
        unit: 'm'
      }
    },
    {
      stepNumber: 4,
      stepName: 'Embankment 2',
      stepType: 'road_base',
      primaryStock: 'Soil',
      secondaryStock: 'Compaction Equipment',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.3,
        unit: 'm'
      }
    },
    {
      stepNumber: 5,
      stepName: 'Earthwork',
      stepType: 'road_base',
      primaryStock: 'Earth Moving Equipment',
      secondaryStock: 'Soil',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.2,
        unit: 'm'
      }
    },
    {
      stepNumber: 6,
      stepName: 'GSB 1',
      stepType: 'road_base',
      primaryStock: 'Granular Sub Base',
      secondaryStock: 'Compaction Equipment',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.15,
        unit: 'm'
      }
    },
    {
      stepNumber: 7,
      stepName: 'GSB 2',
      stepType: 'road_base',
      primaryStock: 'Granular Sub Base',
      secondaryStock: 'Compaction Equipment',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.15,
        unit: 'm'
      }
    },
    {
      stepNumber: 8,
      stepName: 'WMM/WBM',
      stepType: 'road_base',
      primaryStock: 'Wet Mix Macadam',
      secondaryStock: 'Water',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.1,
        unit: 'm'
      }
    },
    {
      stepNumber: 9,
      stepName: 'Prime Coat',
      stepType: 'road_surface',
      primaryStock: 'Bitumen',
      secondaryStock: 'Aggregate',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.02,
        unit: 'm'
      }
    },
    {
      stepNumber: 10,
      stepName: 'Tack Coat',
      stepType: 'road_surface',
      primaryStock: 'Bitumen',
      secondaryStock: 'Aggregate',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.01,
        unit: 'm'
      }
    },
    {
      stepNumber: 11,
      stepName: 'DBM',
      stepType: 'road_surface',
      primaryStock: 'Dense Bituminous Macadam',
      secondaryStock: 'Bitumen',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.05,
        unit: 'm'
      }
    },
    {
      stepNumber: 12,
      stepName: 'BC',
      stepType: 'road_surface',
      primaryStock: 'Bituminous Concrete',
      secondaryStock: 'Bitumen',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.04,
        unit: 'm'
      }
    },
    {
      stepNumber: 13,
      stepName: 'BM',
      stepType: 'road_surface',
      primaryStock: 'Bituminous Macadam',
      secondaryStock: 'Bitumen',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.03,
        unit: 'm'
      }
    },
    {
      stepNumber: 14,
      stepName: 'PMC',
      stepType: 'road_surface',
      primaryStock: 'Pre Mix Carpet',
      secondaryStock: 'Bitumen',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.02,
        unit: 'm'
      }
    },
    {
      stepNumber: 15,
      stepName: 'Seal',
      stepType: 'road_surface',
      primaryStock: 'Seal Coat',
      secondaryStock: 'Bitumen',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.01,
        unit: 'm'
      }
    }
  ],
  
  CC_ROAD: [
    {
      stepNumber: 1,
      stepName: 'Site Clearing',
      stepType: 'custom',
      primaryStock: 'Excavation Equipment',
      secondaryStock: 'Survey Equipment',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        height: 1,
        thickness: 0,
        unit: 'm'
      }
    },
    {
      stepNumber: 2,
      stepName: 'Dismantling Existing CC',
      stepType: 'custom',
      primaryStock: 'Demolition Equipment',
      secondaryStock: 'Waste Material',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.2,
        unit: 'm'
      }
    },
    {
      stepNumber: 3,
      stepName: 'Emb 1',
      stepType: 'road_base',
      primaryStock: 'Soil',
      secondaryStock: 'Compaction Equipment',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.3,
        unit: 'm'
      }
    },
    {
      stepNumber: 4,
      stepName: 'Emb 2',
      stepType: 'road_base',
      primaryStock: 'Soil',
      secondaryStock: 'Compaction Equipment',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.3,
        unit: 'm'
      }
    },
    {
      stepNumber: 5,
      stepName: 'Earth Work',
      stepType: 'road_base',
      primaryStock: 'Earth Moving Equipment',
      secondaryStock: 'Soil',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.2,
        unit: 'm'
      }
    },
    {
      stepNumber: 6,
      stepName: 'GSB 1',
      stepType: 'road_base',
      primaryStock: 'Granular Sub Base',
      secondaryStock: 'Compaction Equipment',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.15,
        unit: 'm'
      }
    },
    {
      stepNumber: 7,
      stepName: 'GSB 2',
      stepType: 'road_base',
      primaryStock: 'Granular Sub Base',
      secondaryStock: 'Compaction Equipment',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.15,
        unit: 'm'
      }
    },
    {
      stepNumber: 8,
      stepName: 'WMM',
      stepType: 'road_base',
      primaryStock: 'Wet Mix Macadam',
      secondaryStock: 'Water',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.1,
        unit: 'm'
      }
    },
    {
      stepNumber: 9,
      stepName: 'DLC',
      stepType: 'road_base',
      primaryStock: 'Dry Lean Concrete',
      secondaryStock: 'Cement',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.1,
        unit: 'm'
      }
    },
    {
      stepNumber: 10,
      stepName: 'CC',
      stepType: 'slab',
      primaryStock: 'Cement Concrete',
      secondaryStock: 'Reinforcement',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.2,
        unit: 'm'
      }
    },
    {
      stepNumber: 11,
      stepName: 'Dowel Bar',
      stepType: 'custom',
      primaryStock: 'Dowel Bars',
      secondaryStock: 'Concrete',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        height: 0.2,
        thickness: 0,
        unit: 'm'
      }
    },
    {
      stepNumber: 12,
      stepName: 'Interblocking',
      stepType: 'custom',
      primaryStock: 'Interlocking Blocks',
      secondaryStock: 'Sand',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.08,
        unit: 'm'
      }
    }
  ],
  
  BRIDGE: [
    {
      stepNumber: 1,
      stepName: 'Earthwork',
      stepType: 'foundation',
      primaryStock: 'Excavation Equipment',
      secondaryStock: 'Soil',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        height: 2.0,
        unit: 'm'
      }
    },
    {
      stepNumber: 2,
      stepName: 'PCC',
      stepType: 'foundation',
      primaryStock: 'Plain Cement Concrete',
      secondaryStock: 'Cement',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.1,
        unit: 'm'
      }
    },
    {
      stepNumber: 3,
      stepName: 'M15',
      stepType: 'foundation',
      primaryStock: 'M15 Concrete',
      secondaryStock: 'Cement',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.15,
        unit: 'm'
      }
    },
    {
      stepNumber: 4,
      stepName: 'M20',
      stepType: 'foundation',
      primaryStock: 'M20 Concrete',
      secondaryStock: 'Cement',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.2,
        unit: 'm'
      }
    },
    {
      stepNumber: 5,
      stepName: 'M25',
      stepType: 'foundation',
      primaryStock: 'M25 Concrete',
      secondaryStock: 'Cement',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.25,
        unit: 'm'
      }
    },
    {
      stepNumber: 6,
      stepName: 'M30',
      stepType: 'foundation',
      primaryStock: 'M30 Concrete',
      secondaryStock: 'Cement',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.3,
        unit: 'm'
      }
    },
    {
      stepNumber: 7,
      stepName: 'M40',
      stepType: 'foundation',
      primaryStock: 'M40 Concrete',
      secondaryStock: 'Cement',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.4,
        unit: 'm'
      }
    },
    {
      stepNumber: 8,
      stepName: 'HYSD',
      stepType: 'custom',
      primaryStock: 'High Yield Strength Deformed Bars',
      secondaryStock: 'Concrete',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        height: 0.2,
        thickness: 0,
        unit: 'm'
      }
    },
    {
      stepNumber: 9,
      stepName: 'Stone Masonry',
      stepType: 'custom',
      primaryStock: 'Stone Blocks',
      secondaryStock: 'Cement Mortar',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        height: 1.5,
        unit: 'm'
      }
    },
    {
      stepNumber: 10,
      stepName: 'Coping',
      stepType: 'custom',
      primaryStock: 'Coping Stones',
      secondaryStock: 'Cement Mortar',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        height: 0.3,
        unit: 'm'
      }
    },
    {
      stepNumber: 11,
      stepName: 'Plaster',
      stepType: 'custom',
      primaryStock: 'Cement Plaster',
      secondaryStock: 'Sand',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.02,
        unit: 'm'
      }
    }
  ],
  
  DRAINAGE: [
    {
      stepNumber: 1,
      stepName: 'Earth Work',
      stepType: 'drainage',
      primaryStock: 'Excavation Equipment',
      secondaryStock: 'Survey Equipment',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        height: 1,
        unit: 'm'
      }
    },
    {
      stepNumber: 2,
      stepName: 'PCC',
      stepType: 'drainage',
      primaryStock: 'Plain Cement Concrete',
      secondaryStock: 'Cement',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.1,
        unit: 'm'
      }
    },
    {
      stepNumber: 3,
      stepName: 'M15',
      stepType: 'drainage',
      primaryStock: 'M15 Concrete',
      secondaryStock: 'Cement',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.15,
        unit: 'm'
      }
    },
    {
      stepNumber: 4,
      stepName: 'M20',
      stepType: 'drainage',
      primaryStock: 'M20 Concrete',
      secondaryStock: 'Cement',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.2,
        unit: 'm'
      }
    },
    {
      stepNumber: 5,
      stepName: 'M25',
      stepType: 'drainage',
      primaryStock: 'M25 Concrete',
      secondaryStock: 'Cement',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        thickness: 0.25,
        unit: 'm'
      }
    },
    {
      stepNumber: 6,
      stepName: 'HYSD',
      stepType: 'custom',
      primaryStock: 'High Yield Strength Deformed Bars',
      secondaryStock: 'Concrete',
      defaultDimensions: {
        length: 100,
        breadth: 6,
        height: 0.2,
        thickness: 0,
        unit: 'm'
      }
    }
  ]
};

// Function to create steps for a site based on site type
const createStepsForSite = async (siteId, siteType) => {
  const Step = require('../models/Step');
  const stepConfig = stepConfigurations[siteType];
  
  if (!stepConfig) {
    throw new Error(`No step configuration found for site type: ${siteType}`);
  }
  
  const steps = [];
  
  for (let i = 0; i < stepConfig.length; i++) {
    const config = stepConfig[i];
    const stepData = {
      siteId,
      stepNumber: config.stepNumber,
      stepName: config.stepName,
      stepType: config.stepType,
      primaryStock: config.primaryStock,
      secondaryStock: config.secondaryStock,
      estimatedVolumeM3: 0, // Will be calculated from user input dimensions
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
