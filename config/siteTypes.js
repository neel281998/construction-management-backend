// Site Types Configuration
// This file defines the different types of construction sites and their associated steps

const siteTypes = [
  {
    type: 'BT_ROAD',
    name: 'BT Road',
    description: 'Bituminous road construction with multiple layers',
    stepCount: 6
  },
  {
    type: 'CC_ROAD',
    name: 'CC Road',
    description: 'Cement concrete road construction',
    stepCount: 5
  },
  {
    type: 'BRIDGE',
    name: 'Bridge',
    description: 'Bridge construction with foundation and superstructure',
    stepCount: 7
  },
  {
    type: 'DRAINAGE',
    name: 'Drainage',
    description: 'Drainage system construction',
    stepCount: 4
  }
];

// Step configurations for each site type
const stepConfigs = {
  BT_ROAD: [
    {
      stepNumber: 1,
      stepName: 'Site Clearing',
      primaryStock: 'Excavator',
      secondaryStock: 'Dump Soil',
      defaultVolumeM3: 100
    },
    {
      stepNumber: 2,
      stepName: 'Subgrade Preparation',
      primaryStock: 'Compactor',
      secondaryStock: 'Granular Material',
      defaultVolumeM3: 80
    },
    {
      stepNumber: 3,
      stepName: 'Base Course',
      primaryStock: 'Wet Mix Plant',
      secondaryStock: 'Aggregate',
      defaultVolumeM3: 120
    },
    {
      stepNumber: 4,
      stepName: 'Prime Coat',
      primaryStock: 'Bitumen Sprayer',
      secondaryStock: 'Bitumen',
      defaultVolumeM3: 60
    },
    {
      stepNumber: 5,
      stepName: 'Tack Coat',
      primaryStock: 'Bitumen Sprayer',
      secondaryStock: 'Bitumen',
      defaultVolumeM3: 40
    },
    {
      stepNumber: 6,
      stepName: 'Wearing Course',
      primaryStock: 'Paver',
      secondaryStock: 'Bituminous Mix',
      defaultVolumeM3: 80
    }
  ],
  
  CC_ROAD: [
    {
      stepNumber: 1,
      stepName: 'Site Clearing',
      primaryStock: 'Excavator',
      secondaryStock: 'Dump Soil',
      defaultVolumeM3: 100
    },
    {
      stepNumber: 2,
      stepName: 'Subgrade Preparation',
      primaryStock: 'Compactor',
      secondaryStock: 'Granular Material',
      defaultVolumeM3: 80
    },
    {
      stepNumber: 3,
      stepName: 'Base Course',
      primaryStock: 'Concrete Mixer',
      secondaryStock: 'Aggregate',
      defaultVolumeM3: 120
    },
    {
      stepNumber: 4,
      stepName: 'Concrete Slab',
      primaryStock: 'Concrete Mixer',
      secondaryStock: 'Cement',
      defaultVolumeM3: 150
    },
    {
      stepNumber: 5,
      stepName: 'Curing',
      primaryStock: 'Water Tanker',
      secondaryStock: 'Water',
      defaultVolumeM3: 50
    }
  ],
  
  BRIDGE: [
    {
      stepNumber: 1,
      stepName: 'Foundation',
      primaryStock: 'Excavator',
      secondaryStock: 'Cement',
      defaultVolumeM3: 200
    },
    {
      stepNumber: 2,
      stepName: 'Pile Foundation',
      primaryStock: 'Pile Driver',
      secondaryStock: 'Steel',
      defaultVolumeM3: 150
    },
    {
      stepNumber: 3,
      stepName: 'Substructure',
      primaryStock: 'Concrete Mixer',
      secondaryStock: 'Reinforcement',
      defaultVolumeM3: 180
    },
    {
      stepNumber: 4,
      stepName: 'Superstructure',
      primaryStock: 'Crane',
      secondaryStock: 'Precast Beams',
      defaultVolumeM3: 220
    },
    {
      stepNumber: 5,
      stepName: 'Deck Slab',
      primaryStock: 'Concrete Mixer',
      secondaryStock: 'Cement',
      defaultVolumeM3: 160
    },
    {
      stepNumber: 6,
      stepName: 'Approach Roads',
      primaryStock: 'Paver',
      secondaryStock: 'Bituminous Mix',
      defaultVolumeM3: 100
    },
    {
      stepNumber: 7,
      stepName: 'Finishing',
      primaryStock: 'Finishing Equipment',
      secondaryStock: 'Paint',
      defaultVolumeM3: 40
    }
  ],
  
  DRAINAGE: [
    {
      stepNumber: 1,
      stepName: 'Excavation',
      primaryStock: 'Excavator',
      secondaryStock: 'Dump Soil',
      defaultVolumeM3: 80
    },
    {
      stepNumber: 2,
      stepName: 'Pipe Laying',
      primaryStock: 'Crane',
      secondaryStock: 'Pipes',
      defaultVolumeM3: 60
    },
    {
      stepNumber: 3,
      stepName: 'Backfilling',
      primaryStock: 'Compactor',
      secondaryStock: 'Granular Material',
      defaultVolumeM3: 70
    },
    {
      stepNumber: 4,
      stepName: 'Manhole Construction',
      primaryStock: 'Concrete Mixer',
      secondaryStock: 'Cement',
      defaultVolumeM3: 40
    }
  ]
};

// Helper functions
function getSiteTypes() {
  return siteTypes;
}

function getStepsForSiteType(siteType) {
  return stepConfigs[siteType] || [];
}

function getSiteTypeConfig(siteType) {
  const siteTypeData = siteTypes.find(st => st.type === siteType);
  if (!siteTypeData) {
    return null;
  }
  
  const steps = getStepsForSiteType(siteType);
  const totalVolumeM3 = steps.reduce((sum, step) => sum + step.defaultVolumeM3, 0);
  
  return {
    ...siteTypeData,
    steps,
    totalVolumeM3
  };
}

module.exports = {
  siteTypes,
  stepConfigs,
  getSiteTypes,
  getStepsForSiteType,
  getSiteTypeConfig
};
