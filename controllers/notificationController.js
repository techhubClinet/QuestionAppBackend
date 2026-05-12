const NotificationCampaign = require('../models/NotificationCampaign');
const { createOrGetBroadcastForCurrentCycle } = require('../services/notificationCampaignService');

exports.getLatestNotification = async (req, res) => {
  try {
    const campaign = await NotificationCampaign.findOne({ isEnabled: true }).sort({ updatedAt: -1 });
    if (!campaign) {
      return res.json({ notification: null });
    }

    const notification = await createOrGetBroadcastForCurrentCycle(campaign, new Date());

    res.json({ notification });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
