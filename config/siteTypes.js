// Site Types Configuration
// This file defines the different types of construction sites and their associated steps

const siteTypes = [
  {
    type: 'BT_ROAD',
    name: 'BT Road',
    description: 'Bituminous road construction with multiple layers',
    stepCount: 15
  },
  {
    type: 'CC_ROAD',
    name: 'CC Road',
    description: 'Cement concrete road construction',
    stepCount: 12
  },
  {
    type: 'BRIDGE',
    name: 'Bridge',
    description: 'Bridge construction with foundation and superstructure',
    stepCount: 11
  },
  {
    type: 'DRAINAGE',
    name: 'Drainage',
    description: 'Drainage system construction',
    stepCount: 6
  }
];

// Step configurations for each site type
const stepConfigs = {
  BT_ROAD: [
    {
      stepNumber: 1,
      stepName: 'Site Clearing',
      primaryStock: 'Excavation Equipment',
      secondaryStock: 'Survey Equipment',
      defaultVolumeM3: 100
    },
    {
      stepNumber: 2,
      stepName: 'Scarifying Existing BT',
      primaryStock: 'Scarifying Equipment',
      secondaryStock: 'Bitumen',
      defaultVolumeM3: 60
    },
    {
      stepNumber: 3,
      stepName: 'Embankment 1',
      primaryStock: 'Soil',
      secondaryStock: 'Compaction Equipment',
      defaultVolumeM3: 80
    },
    {
      stepNumber: 4,
      stepName: 'Embankment 2',
      primaryStock: 'Soil',
      secondaryStock: 'Compaction Equipment',
      defaultVolumeM3: 80
    },
    {
      stepNumber: 5,
      stepName: 'Earthwork',
      primaryStock: 'Earth Moving Equipment',
      secondaryStock: 'Soil',
      defaultVolumeM3: 70
    },
    {
      stepNumber: 6,
      stepName: 'GSB 1',
      primaryStock: 'Granular Sub Base',
      secondaryStock: 'Compaction Equipment',
      defaultVolumeM3: 90
    },
    {
      stepNumber: 7,
      stepName: 'GSB 2',
      primaryStock: 'Granular Sub Base',
      secondaryStock: 'Compaction Equipment',
      defaultVolumeM3: 90
    },
    {
      stepNumber: 8,
      stepName: 'WMM/WBM',
      primaryStock: 'Wet Mix Macadam',
      secondaryStock: 'Water',
      defaultVolumeM3: 60
    },
    {
      stepNumber: 9,
      stepName: 'Prime Coat',
      primaryStock: 'Bitumen',
      secondaryStock: 'Aggregate',
      defaultVolumeM3: 12
    },
    {
      stepNumber: 10,
      stepName: 'Tack Coat',
      primaryStock: 'Bitumen',
      secondaryStock: 'Aggregate',
      defaultVolumeM3: 6
    },
    {
      stepNumber: 11,
      stepName: 'DBM',
      primaryStock: 'Dense Bituminous Macadam',
      secondaryStock: 'Bitumen',
      defaultVolumeM3: 30
    },
    {
      stepNumber: 12,
      stepName: 'BC',
      primaryStock: 'Bituminous Concrete',
      secondaryStock: 'Bitumen',
      defaultVolumeM3: 24
    },
    {
      stepNumber: 13,
      stepName: 'BM',
      primaryStock: 'Bituminous Macadam',
      secondaryStock: 'Bitumen',
      defaultVolumeM3: 18
    },
    {
      stepNumber: 14,
      stepName: 'PMC',
      primaryStock: 'Pre Mix Carpet',
      secondaryStock: 'Bitumen',
      defaultVolumeM3: 12
    },
    {
      stepNumber: 15,
      stepName: 'Seal',
      primaryStock: 'Seal Coat',
      secondaryStock: 'Bitumen',
      defaultVolumeM3: 6
    }
  ],
  
  CC_ROAD: [
    {
      stepNumber: 1,
      stepName: 'Site Clearing',
      primaryStock: 'Excavation Equipment',
      secondaryStock: 'Survey Equipment',
      defaultVolumeM3: 100
    },
    {
      stepNumber: 2,
      stepName: 'Dismantling Existing CC',
      primaryStock: 'Demolition Equipment',
      secondaryStock: 'Waste Material',
      defaultVolumeM3: 80
    },
    {
      stepNumber: 3,
      stepName: 'Emb 1',
      primaryStock: 'Soil',
      secondaryStock: 'Compaction Equipment',
      defaultVolumeM3: 80
    },
    {
      stepNumber: 4,
      stepName: 'Emb 2',
      primaryStock: 'Soil',
      secondaryStock: 'Compaction Equipment',
      defaultVolumeM3: 80
    },
    {
      stepNumber: 5,
      stepName: 'Earth Work',
      primaryStock: 'Earth Moving Equipment',
      secondaryStock: 'Soil',
      defaultVolumeM3: 70
    },
    {
      stepNumber: 6,
      stepName: 'GSB 1',
      primaryStock: 'Granular Sub Base',
      secondaryStock: 'Compaction Equipment',
      defaultVolumeM3: 90
    },
    {
      stepNumber: 7,
      stepName: 'GSB 2',
      primaryStock: 'Granular Sub Base',
      secondaryStock: 'Compaction Equipment',
      defaultVolumeM3: 90
    },
    {
      stepNumber: 8,
      stepName: 'WMM',
      primaryStock: 'Wet Mix Macadam',
      secondaryStock: 'Water',
      defaultVolumeM3: 60
    },
    {
      stepNumber: 9,
      stepName: 'DLC',
      primaryStock: 'Dry Lean Concrete',
      secondaryStock: 'Cement',
      defaultVolumeM3: 60
    },
    {
      stepNumber: 10,
      stepName: 'CC',
      primaryStock: 'Cement Concrete',
      secondaryStock: 'Reinforcement',
      defaultVolumeM3: 120
    },
    {
      stepNumber: 11,
      stepName: 'Dowel Bar',
      primaryStock: 'Dowel Bars',
      secondaryStock: 'Concrete',
      defaultVolumeM3: 20
    },
    {
      stepNumber: 12,
      stepName: 'Interblocking',
      primaryStock: 'Interlocking Blocks',
      secondaryStock: 'Sand',
      defaultVolumeM3: 48
    }
  ],
  
  BRIDGE: [
    {
      stepNumber: 1,
      stepName: 'Earthwork',
      primaryStock: 'Excavation Equipment',
      secondaryStock: 'Soil',
      defaultVolumeM3: 200
    },
    {
      stepNumber: 2,
      stepName: 'PCC',
      primaryStock: 'Plain Cement Concrete',
      secondaryStock: 'Cement',
      defaultVolumeM3: 60
    },
    {
      stepNumber: 3,
      stepName: 'M15',
      primaryStock: 'M15 Concrete',
      secondaryStock: 'Cement',
      defaultVolumeM3: 90
    },
    {
      stepNumber: 4,
      stepName: 'M20',
      primaryStock: 'M20 Concrete',
      secondaryStock: 'Cement',
      defaultVolumeM3: 120
    },
    {
      stepNumber: 5,
      stepName: 'M25',
      primaryStock: 'M25 Concrete',
      secondaryStock: 'Cement',
      defaultVolumeM3: 150
    },
    {
      stepNumber: 6,
      stepName: 'M30',
      primaryStock: 'M30 Concrete',
      secondaryStock: 'Cement',
      defaultVolumeM3: 180
    },
    {
      stepNumber: 7,
      stepName: 'M40',
      primaryStock: 'M40 Concrete',
      secondaryStock: 'Cement',
      defaultVolumeM3: 240
    },
    {
      stepNumber: 8,
      stepName: 'HYSD',
      primaryStock: 'High Yield Strength Deformed Bars',
      secondaryStock: 'Concrete',
      defaultVolumeM3: 20
    },
    {
      stepNumber: 9,
      stepName: 'Stone Masonry',
      primaryStock: 'Stone Blocks',
      secondaryStock: 'Cement Mortar',
      defaultVolumeM3: 90
    },
    {
      stepNumber: 10,
      stepName: 'Coping',
      primaryStock: 'Coping Stones',
      secondaryStock: 'Cement Mortar',
      defaultVolumeM3: 18
    },
    {
      stepNumber: 11,
      stepName: 'Plaster',
      primaryStock: 'Cement Plaster',
      secondaryStock: 'Sand',
      defaultVolumeM3: 12
    }
  ],
  
  DRAINAGE: [
    {
      stepNumber: 1,
      stepName: 'Earth Work',
      primaryStock: 'Excavation Equipment',
      secondaryStock: 'Survey Equipment',
      defaultVolumeM3: 80
    },
    {
      stepNumber: 2,
      stepName: 'PCC',
      primaryStock: 'Plain Cement Concrete',
      secondaryStock: 'Cement',
      defaultVolumeM3: 60
    },
    {
      stepNumber: 3,
      stepName: 'M15',
      primaryStock: 'M15 Concrete',
      secondaryStock: 'Cement',
      defaultVolumeM3: 90
    },
    {
      stepNumber: 4,
      stepName: 'M20',
      primaryStock: 'M20 Concrete',
      secondaryStock: 'Cement',
      defaultVolumeM3: 120
    },
    {
      stepNumber: 5,
      stepName: 'M25',
      primaryStock: 'M25 Concrete',
      secondaryStock: 'Cement',
      defaultVolumeM3: 150
    },
    {
      stepNumber: 6,
      stepName: 'HYSD',
      primaryStock: 'High Yield Strength Deformed Bars',
      secondaryStock: 'Concrete',
      defaultVolumeM3: 20
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
