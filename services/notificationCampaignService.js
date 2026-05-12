const NotificationCampaign = require('../models/NotificationCampaign');
const BroadcastNotification = require('../models/BroadcastNotification');
const { sendPushToAllDevices } = require('./pushNotificationService');

function getIsoWeekKey(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getCycleKey(date, frequency) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  if (frequency === 'daily') return `${year}-${month}-${day}`;
  if (frequency === 'weekly') return getIsoWeekKey(date);
  return `${year}-${month}`;
}

async function createOrGetBroadcastForCurrentCycle(campaign, now = new Date()) {
  const cycleKey = getCycleKey(now, campaign.frequency);
  let notification = await BroadcastNotification.findOne({
    campaignId: campaign._id,
    cycleKey
  });

  if (!notification) {
    try {
      notification = await BroadcastNotification.create({
        campaignId: campaign._id,
        message: campaign.message,
        frequency: campaign.frequency,
        cycleKey
      });
    } catch (error) {
      if (error.code === 11000) {
        notification = await BroadcastNotification.findOne({
          campaignId: campaign._id,
          cycleKey
        });
      } else {
        throw error;
      }
    }
  }

  return notification;
}

async function sendCampaignPush(campaign, now = new Date()) {
  const notification = await createOrGetBroadcastForCurrentCycle(campaign, now);
  const push = await sendPushToAllDevices({
    title: 'Mamekubal',
    body: campaign.message,
    data: {
      type: 'campaign',
      frequency: campaign.frequency,
      notificationId: String(notification._id)
    }
  });
  return { notification, ...push };
}

async function dispatchDueCampaignPush() {
  const campaign = await NotificationCampaign.findOne({ isEnabled: true }).sort({ updatedAt: -1 });
  if (!campaign) return { sent: 0, invalidated: 0, skipped: true };
  const now = new Date();
  const cycleKey = getCycleKey(now, campaign.frequency);
  const existing = await BroadcastNotification.findOne({ campaignId: campaign._id, cycleKey }).lean();
  if (existing) {
    return { sent: 0, invalidated: 0, skipped: true, alreadySentForCycle: true };
  }
  return sendCampaignPush(campaign, now);
}

module.exports = {
  getCycleKey,
  createOrGetBroadcastForCurrentCycle,
  sendCampaignPush,
  dispatchDueCampaignPush
};
