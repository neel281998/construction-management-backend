const express = require('express');
const Step = require('../models/Step');
const Site = require('../models/Site');
const StepInventoryReceipt = require('../models/StepInventoryReceipt');
const { authenticateToken, requireAdminOrSupervisor } = require('../middleware/auth');

const router = express.Router();

// Construction Site Report: Part 1 - Site work updates, Part 2 - Inventory received
router.get('/', authenticateToken, requireAdminOrSupervisor, async (req, res) => {
  try {
    const { startDate, endDate, siteId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate + 'T23:59:59.999Z');

    // Resolve site IDs (filter by assigned sites for non-admin)
    let siteIds = [];
    if (siteId) {
      siteIds = [siteId];
    } else {
      const siteQuery = { status: { $in: ['active', 'on_hold', 'planning', 'completed'] } };
      if (req.user.role !== 'admin' && req.user.role !== 'supervisor') {
        siteQuery._id = { $in: req.user.assignedSites || [] };
      }
      const sites = await Site.find(siteQuery).select('_id name').lean();
      siteIds = sites.map(s => s._id);
    }

    if (siteIds.length === 0) {
      return res.json({
        success: true,
        data: {
          workUpdates: [],
          inventoryReceipts: [],
          sites: []
        }
      });
    }

    // Part 1: Site work updates (steps with progress/status changes in date range)
    const steps = await Step.find({
      siteId: { $in: siteIds },
      isActive: true
    })
      .populate('siteId', 'name')
      .lean();

    const workUpdates = [];
    for (const step of steps) {
      const ph = step.progressHistory || [];
      const entriesInRange = ph.filter(e => {
        const d = e.date ? new Date(e.date) : null;
        return d && d >= start && d <= end;
      });

      const stepUpdatedAt = step.updatedAt ? new Date(step.updatedAt) : null;
      const updatedInRange = stepUpdatedAt && stepUpdatedAt >= start && stepUpdatedAt <= end;

      if (entriesInRange.length > 0 || updatedInRange) {
        workUpdates.push({
          siteId: step.siteId?._id || step.siteId,
          siteName: step.siteId?.name || '',
          stepId: step._id,
          stepNumber: step.stepNumber,
          stepName: step.stepName,
          stepType: step.stepType,
          progressPercentage: step.progressPercentage ?? 0,
          progressM3: step.progressM3 ?? 0,
          estimatedVolumeM3: step.estimatedVolumeM3 ?? 0,
          status: step.status || 'pending',
          lastUpdatedAt: step.updatedAt,
          progressHistoryInRange: entriesInRange.map(e => ({
            date: e.date,
            progressM3: e.progressM3,
            notes: e.notes,
            dimensions: e.dimensions
          }))
        });
      }
    }

    // Part 2: Inventory received (StepInventoryReceipt in date range)
    const receipts = await StepInventoryReceipt.find({
      siteId: { $in: siteIds },
      deliveryDate: { $gte: start, $lte: end }
    })
      .populate('stepId', 'stepNumber stepName')
      .populate('siteId', 'name')
      .sort({ deliveryDate: -1 })
      .lean();

    const inventoryReceipts = receipts.map(r => ({
      _id: r._id,
      siteId: r.siteId?._id || r.siteId,
      siteName: r.siteId?.name || '',
      stepId: r.stepId?._id || r.stepId,
      stepNumber: r.stepId?.stepNumber ?? '',
      stepName: r.stepId?.stepName ?? '',
      materialName: r.materialName,
      materialCategory: r.materialCategory,
      materialType: r.materialType,
      quantity: r.quantity,
      unit: r.unit || 'm³',
      sourceType: r.sourceType,
      sourceName: r.sourceName,
      deliveryDate: r.deliveryDate,
      deliveryNotes: r.deliveryNotes,
      receivedByName: r.receivedBy ? `${r.receivedBy.firstName || ''} ${r.receivedBy.lastName || ''}`.trim() : ''
    }));

    // Sites list for filter dropdown
    const sites = await Site.find({ _id: { $in: siteIds } }).select('_id name').lean();

    res.json({
      success: true,
      data: {
        workUpdates,
        inventoryReceipts,
        sites
      }
    });
  } catch (error) {
    console.error('Construction site report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch construction site report'
    });
  }
});

module.exports = router;
