const mongoose = require('mongoose');

const broadcastNotificationSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NotificationCampaign',
      required: true,
      index: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      required: true
    },
    cycleKey: {
      type: String,
      required: true
    }
  },
  { timestamps: true }
);

broadcastNotificationSchema.index({ campaignId: 1, cycleKey: 1 }, { unique: true });

module.exports = mongoose.model('BroadcastNotification', broadcastNotificationSchema);
