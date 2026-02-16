/**
 * Syncs step assignments to Site.assignedStaff and User.assignedSites.
 * Called when users are assigned to steps via the step wizard or step APIs.
 */
const Site = require('../models/Site');
const User = require('../models/User');
const Step = require('../models/Step');

/**
 * Add users assigned to steps to Site.assignedStaff and User.assignedSites.
 * @param {string} siteId - Site ID
 * @param {string[]} userIds - Array of user ObjectIds (or strings)
 */
async function syncStepAssignmentsToSite(siteId, userIds) {
  if (!siteId || !userIds || userIds.length === 0) return;

  const site = await Site.findById(siteId);
  if (!site) return;

  const uniqueIds = [...new Set(userIds.map(id => id && id.toString()).filter(Boolean))];
  if (uniqueIds.length === 0) return;

  for (const uid of uniqueIds) {
    const existing = site.assignedStaff?.some(
      s => s.user && s.user.toString() === uid
    );
    if (!existing) {
      site.assignedStaff = site.assignedStaff || [];
      site.assignedStaff.push({
        user: uid,
        role: 'worker',
        assignedDate: new Date(),
        isActive: true
      });
    }
    await User.findByIdAndUpdate(uid, { $addToSet: { assignedSites: siteId } });
  }
  await site.save();
}

/**
 * Remove user from Site.assignedStaff and User.assignedSites if they are no longer
 * assigned to any step of the site.
 * @param {string} siteId - Site ID
 * @param {string} userId - User ID
 */
async function syncRemoveUserFromSite(siteId, userId) {
  if (!siteId || !userId) return;

  const steps = await Step.find({ siteId, isActive: true });
  const stillAssigned = steps.some(
    s => s.assignedUsers?.some(
      a => a.user && a.user.toString() === userId.toString()
    )
  );
  if (stillAssigned) return;

  const site = await Site.findById(siteId);
  if (site) {
    site.assignedStaff = (site.assignedStaff || []).filter(
      s => s.user && s.user.toString() !== userId.toString()
    );
    await site.save();
  }
  await User.findByIdAndUpdate(userId, { $pull: { assignedSites: siteId } });
}

module.exports = { syncStepAssignmentsToSite, syncRemoveUserFromSite };
