const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
    trim: true,
    minlength: 5,
    maxlength: 2000
  },
  category: {
    type: String,
    trim: true,
    enum: ['bug', 'feature', 'support', 'other'],
    default: 'other'
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  status: {
    type: String,
    enum: ['new', 'reviewing', 'resolved'],
    default: 'new'
  },
  adminNote: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Snapshot user details so admin can always see what was provided at submission time
  userName: { type: String, trim: true },
  userEmail: { type: String, trim: true, lowercase: true },
  userPhone: { type: String, trim: true }
}, {
  timestamps: true
});

feedbackSchema.index({ createdAt: -1 });
feedbackSchema.index({ status: 1, createdAt: -1 });
feedbackSchema.index({ userEmail: 1 });

module.exports = mongoose.model('Feedback', feedbackSchema);

