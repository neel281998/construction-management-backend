const express = require('express');
const Feedback = require('../models/Feedback');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function getUserSnapshot(user) {
  const first = user?.firstName || '';
  const last = user?.lastName || '';
  const name = (first + ' ' + last).trim();
  return {
    userName: name || user?.fullName || '',
    userEmail: user?.email || '',
    userPhone: user?.phone || ''
  };
}

// Create feedback (any authenticated user)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const categoryRaw = typeof req.body?.category === 'string' ? req.body.category.trim() : '';
    const ratingRaw = req.body?.rating;

    if (!message || message.length < 5) {
      return res.status(400).json({ success: false, message: 'Feedback message must be at least 5 characters.' });
    }

    const category = ['bug', 'feature', 'support', 'other'].includes(categoryRaw) ? categoryRaw : 'other';
    const rating = ratingRaw === undefined || ratingRaw === null || ratingRaw === '' ? undefined : Number(ratingRaw);
    if (rating !== undefined && (!Number.isFinite(rating) || rating < 1 || rating > 5)) {
      return res.status(400).json({ success: false, message: 'Rating must be a number between 1 and 5.' });
    }

    const snapshot = getUserSnapshot(req.user);

    const doc = new Feedback({
      message,
      category,
      rating,
      createdBy: req.user._id,
      ...snapshot
    });

    await doc.save();

    return res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      data: { feedback: doc }
    });
  } catch (error) {
    console.error('Create feedback error:', error);
    return res.status(500).json({ success: false, message: 'Failed to submit feedback' });
  }
});

// Admin: list feedback (paginated)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const query = {};
    if (status && ['new', 'reviewing', 'resolved'].includes(status)) query.status = status;
    if (search) {
      query.$or = [
        { userName: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } },
        { userPhone: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [items, totalCount] = await Promise.all([
      Feedback.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Feedback.countDocuments(query)
    ]);

    return res.json({
      success: true,
      data: {
        items,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasNext: skip + items.length < totalCount,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('List feedback error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch feedback' });
  }
});

// Admin: update status/adminNote
router.patch('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const status = typeof req.body?.status === 'string' ? req.body.status : undefined;
    const adminNote = typeof req.body?.adminNote === 'string' ? req.body.adminNote.trim() : undefined;

    const update = {};
    if (status && ['new', 'reviewing', 'resolved'].includes(status)) update.status = status;
    if (adminNote !== undefined) update.adminNote = adminNote;

    const doc = await Feedback.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Feedback not found' });

    return res.json({
      success: true,
      message: 'Feedback updated',
      data: { feedback: doc }
    });
  } catch (error) {
    console.error('Update feedback error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update feedback' });
  }
});

module.exports = router;

