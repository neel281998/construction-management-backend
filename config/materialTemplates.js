const materialTemplates = {
  BT_ROAD: {
    name: 'BT Road Construction',
    description: 'Bituminous Road Construction Materials',
    materials: [
      {
        name: 'Bitumen',
        category: 'cement_concrete',
        materialType: 'primary',
        unit: 'tons',
        typicalQuantity: 0.15,
        specifications: {
          grade: 'VG-30',
          quality: 'Premium'
        }
      },
      {
        name: 'Aggregate (20mm)',
        category: 'aggregates',
        materialType: 'primary',
        unit: 'm³',
        typicalQuantity: 1.2,
        specifications: {
          size: '20mm',
          quality: 'Crushed Stone'
        }
      },
      {
        name: 'Aggregate (10mm)',
        category: 'aggregates',
        materialType: 'primary',
        unit: 'm³',
        typicalQuantity: 0.8,
        specifications: {
          size: '10mm',
          quality: 'Crushed Stone'
        }
      },
      {
        name: 'Stone Dust',
        category: 'aggregates',
        materialType: 'secondary',
        unit: 'm³',
        typicalQuantity: 0.3,
        specifications: {
          size: 'Fine',
          quality: 'Stone Dust'
        }
      },
      {
        name: 'Hydrated Lime',
        category: 'cement_concrete',
        materialType: 'secondary',
        unit: 'kg',
        typicalQuantity: 50,
        specifications: {
          grade: 'Class A',
          quality: 'Hydrated'
        }
      }
    ]
  },
  
  CC_ROAD: {
    name: 'CC Road Construction',
    description: 'Cement Concrete Road Construction Materials',
    materials: [
      {
        name: 'Portland Cement',
        category: 'cement_concrete',
        materialType: 'primary',
        unit: 'bags',
        typicalQuantity: 7.5,
        specifications: {
          grade: 'OPC-53',
          quality: 'Premium'
        }
      },
      {
        name: 'Coarse Aggregate (20mm)',
        category: 'aggregates',
        materialType: 'primary',
        unit: 'm³',
        typicalQuantity: 0.85,
        specifications: {
          size: '20mm',
          quality: 'Crushed Stone'
        }
      },
      {
        name: 'Fine Aggregate (Sand)',
        category: 'aggregates',
        materialType: 'primary',
        unit: 'm³',
        typicalQuantity: 0.55,
        specifications: {
          size: 'Fine',
          quality: 'River Sand'
        }
      },
      {
        name: 'Steel Reinforcement (8mm)',
        category: 'steel_reinforcement',
        materialType: 'secondary',
        unit: 'kg',
        typicalQuantity: 80,
        specifications: {
          grade: 'Fe-500',
          quality: 'TMT Bars'
        }
      },
      {
        name: 'Water',
        category: 'other',
        materialType: 'auxiliary',
        unit: 'liters',
        typicalQuantity: 200,
        specifications: {
          quality: 'Potable',
          source: 'Municipal'
        }
      }
    ]
  },
  
  BRIDGE: {
    name: 'Bridge Construction',
    description: 'Bridge Construction Materials',
    materials: [
      {
        name: 'Portland Cement',
        category: 'cement_concrete',
        materialType: 'primary',
        unit: 'bags',
        typicalQuantity: 12,
        specifications: {
          grade: 'OPC-53',
          quality: 'Premium'
        }
      },
      {
        name: 'Steel Reinforcement (16mm)',
        category: 'steel_reinforcement',
        materialType: 'primary',
        unit: 'kg',
        typicalQuantity: 150,
        specifications: {
          grade: 'Fe-500',
          quality: 'TMT Bars'
        }
      },
      {
        name: 'Coarse Aggregate (40mm)',
        category: 'aggregates',
        materialType: 'primary',
        unit: 'm³',
        typicalQuantity: 0.9,
        specifications: {
          size: '40mm',
          quality: 'Crushed Stone'
        }
      },
      {
        name: 'Fine Aggregate (Sand)',
        category: 'aggregates',
        materialType: 'primary',
        unit: 'm³',
        typicalQuantity: 0.45,
        specifications: {
          size: 'Fine',
          quality: 'River Sand'
        }
      },
      {
        name: 'Formwork Timber',
        category: 'timber_wood',
        materialType: 'auxiliary',
        unit: 'sq.m',
        typicalQuantity: 8,
        specifications: {
          grade: 'Commercial',
          quality: 'Plywood'
        }
      }
    ]
  },
  
  DRAINAGE: {
    name: 'Drainage Construction',
    description: 'Drainage System Construction Materials',
    materials: [
      {
        name: 'Portland Cement',
        category: 'cement_concrete',
        materialType: 'primary',
        unit: 'bags',
        typicalQuantity: 6,
        specifications: {
          grade: 'OPC-53',
          quality: 'Premium'
        }
      },
      {
        name: 'Coarse Aggregate (20mm)',
        category: 'aggregates',
        materialType: 'primary',
        unit: 'm³',
        typicalQuantity: 0.7,
        specifications: {
          size: '20mm',
          quality: 'Crushed Stone'
        }
      },
      {
        name: 'Fine Aggregate (Sand)',
        category: 'aggregates',
        materialType: 'primary',
        unit: 'm³',
        typicalQuantity: 0.4,
        specifications: {
          size: 'Fine',
          quality: 'River Sand'
        }
      },
      {
        name: 'Drainage Pipes (300mm)',
        category: 'other',
        materialType: 'primary',
        unit: 'linear.m',
        typicalQuantity: 10,
        specifications: {
          size: '300mm',
          quality: 'RCC Pipes'
        }
      },
      {
        name: 'Manhole Covers',
        category: 'other',
        materialType: 'auxiliary',
        unit: 'pieces',
        typicalQuantity: 2,
        specifications: {
          size: '600x600mm',
          quality: 'Cast Iron'
        }
      }
    ]
  }
};

// Helper functions
const getMaterialTemplate = (projectType) => {
  return materialTemplates[projectType] || null;
};

const getAllMaterialTemplates = () => {
  return materialTemplates;
};

const getMaterialCategories = () => {
  return [
    { value: 'aggregates', label: 'Aggregates', icon: '🔲' },
    { value: 'cement_concrete', label: 'Cement & Concrete', icon: '🧱' },
    { value: 'steel_reinforcement', label: 'Steel & Reinforcement', icon: '🔩' },
    { value: 'timber_wood', label: 'Timber & Wood', icon: '🪵' },
    { value: 'tools_equipment', label: 'Tools & Equipment', icon: '🔧' },
    { value: 'finishing_materials', label: 'Finishing Materials', icon: '🎨' },
    { value: 'other', label: 'Other Materials', icon: '📦' }
  ];
};

const getUnits = () => {
  return [
    { value: 'm³', label: 'Cubic Meters (m³)' },
    { value: 'kg', label: 'Kilograms (kg)' },
    { value: 'liters', label: 'Liters (L)' },
    { value: 'pieces', label: 'Pieces' },
    { value: 'tons', label: 'Tons' },
    { value: 'sq.m', label: 'Square Meters (m²)' },
    { value: 'linear.m', label: 'Linear Meters (m)' },
    { value: 'bags', label: 'Bags' },
    { value: 'bundles', label: 'Bundles' }
  ];
};

module.exports = {
  materialTemplates,
  getMaterialTemplate,
  getAllMaterialTemplates,
  getMaterialCategories,
  getUnits
};
