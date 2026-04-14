const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: [true, 'Question text is required'],
    trim: true,
    maxlength: [500, 'Question cannot exceed 500 characters']
  },
  is18Plus: {
    type: Boolean,
    default: false
  },
  acceptVotes: {
    type: Number,
    default: 1
  },
  rejectVotes: {
    type: Number,
    default: 1
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  createdByGuestId: {
    type: String,
    trim: true,
    index: true
  },
  approved: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

questionSchema.virtual('acceptPercentage').get(function() {
  const total = this.acceptVotes + this.rejectVotes;
  if (total === 0) return 50;
  return Math.round((this.acceptVotes / total) * 100);
});

questionSchema.virtual('rejectPercentage').get(function() {
  const total = this.acceptVotes + this.rejectVotes;
  if (total === 0) return 50;
  return Math.round((this.rejectVotes / total) * 100);
});

questionSchema.virtual('isAccepted').get(function() {
  return this.acceptPercentage >= 50;
});

questionSchema.set('toJSON', { virtuals: true });
questionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Question', questionSchema);
