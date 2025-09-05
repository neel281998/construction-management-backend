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
    stepCount: 4
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
      stepName: 'Site Preparation',
      primaryStock: 'Excavation Equipment',
      secondaryStock: 'Survey Equipment',
      defaultVolumeM3: 100
    },
    {
      stepNumber: 2,
      stepName: 'Subgrade Preparation',
      primaryStock: 'Soil',
      secondaryStock: 'Compaction Equipment',
      defaultVolumeM3: 80
    },
    {
      stepNumber: 3,
      stepName: 'Base Course',
      primaryStock: 'Aggregate',
      secondaryStock: 'Bitumen',
      defaultVolumeM3: 120
    },
    {
      stepNumber: 4,
      stepName: 'Prime Coat',
      primaryStock: 'Bitumen',
      secondaryStock: 'Aggregate',
      defaultVolumeM3: 60
    },
    {
      stepNumber: 5,
      stepName: 'Tack Coat',
      primaryStock: 'Bitumen',
      secondaryStock: 'Aggregate',
      defaultVolumeM3: 40
    },
    {
      stepNumber: 6,
      stepName: 'Bituminous Surface',
      primaryStock: 'Bitumen',
      secondaryStock: 'Aggregate',
      defaultVolumeM3: 80
    }
  ],
  
  CC_ROAD: [
    {
      stepNumber: 1,
      stepName: 'Site Preparation',
      primaryStock: 'Excavation Equipment',
      secondaryStock: 'Survey Equipment',
      defaultVolumeM3: 100
    },
    {
      stepNumber: 2,
      stepName: 'Subgrade Preparation',
      primaryStock: 'Soil',
      secondaryStock: 'Compaction Equipment',
      defaultVolumeM3: 80
    },
    {
      stepNumber: 3,
      stepName: 'Base Course',
      primaryStock: 'Aggregate',
      secondaryStock: 'Cement',
      defaultVolumeM3: 120
    },
    {
      stepNumber: 4,
      stepName: 'Reinforcement Placement',
      primaryStock: 'Reinforcement',
      secondaryStock: 'Concrete',
      defaultVolumeM3: 50
    },
    {
      stepNumber: 5,
      stepName: 'Concrete Surface',
      primaryStock: 'Concrete',
      secondaryStock: 'Reinforcement',
      defaultVolumeM3: 150
    }
  ],
  
  BRIDGE: [
    {
      stepNumber: 1,
      stepName: 'Foundation',
      primaryStock: 'Concrete',
      secondaryStock: 'Reinforcement',
      defaultVolumeM3: 200
    },
    {
      stepNumber: 2,
      stepName: 'Piers/Columns',
      primaryStock: 'Concrete',
      secondaryStock: 'Reinforcement',
      defaultVolumeM3: 150
    },
    {
      stepNumber: 3,
      stepName: 'Beams',
      primaryStock: 'Concrete',
      secondaryStock: 'Reinforcement',
      defaultVolumeM3: 180
    },
    {
      stepNumber: 4,
      stepName: 'Deck Slab',
      primaryStock: 'Concrete',
      secondaryStock: 'Reinforcement',
      defaultVolumeM3: 160
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
