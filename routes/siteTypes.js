const express = require('express');
const router = express.Router();
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { getSiteTypes, getStepsForSiteType } = require('../config/siteTypes');

// Get all available site types
router.get('/', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const siteTypes = getSiteTypes();
    
    res.json({
      success: true,
      data: {
        siteTypes
      }
    });
  } catch (error) {
    console.error('Get site types error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch site types'
    });
  }
});

// Get configuration for a specific site type
router.get('/:siteType', authenticateToken, requirePermission('site.read'), async (req, res) => {
  try {
    const { siteType } = req.params;
    
    // Validate site type
    if (!['BT_ROAD', 'CC_ROAD', 'BRIDGE', 'DRAINAGE'].includes(siteType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid site type'
      });
    }
    
    const steps = getStepsForSiteType(siteType);
    const totalVolumeM3 = steps.reduce((sum, step) => sum + step.defaultVolumeM3, 0);
    
    const config = {
      name: siteType.replace('_', ' '),
      description: `Configuration for ${siteType.replace('_', ' ')} construction`,
      steps,
      totalVolumeM3
    };
    
    res.json({
      success: true,
      data: {
        config
      }
    });
  } catch (error) {
    console.error('Get site type config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch site type configuration'
    });
  }
});

module.exports = router;
