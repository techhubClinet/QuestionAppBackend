const mongoose = require('mongoose');

const notificationCampaignSchema = new mongoose.Schema(
  {
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 280
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      required: true
    },
    isEnabled: {
      type: Boolean,
      default: false
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('NotificationCampaign', notificationCampaignSchema);
