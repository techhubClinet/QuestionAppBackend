require('dotenv').config();
const connectDB = require('../config/db');
const { dispatchDueCampaignPush } = require('../services/notificationCampaignService');

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const expectedSecret = process.env.CRON_SECRET;
  const providedSecret = req.headers['x-cron-secret'] || req.query?.secret;
  const isVercelCron = Boolean(req.headers['x-vercel-cron']);
  const hasValidSecret = expectedSecret && providedSecret === expectedSecret;
  if (!isVercelCron && !hasValidSecret) {
    return res.status(401).json({ message: 'Unauthorized cron request' });
  }

  try {
    await connectDB();
    const result = await dispatchDueCampaignPush();
    return res.status(200).json({ message: 'Cron processed', ...result });
  } catch (error) {
    return res.status(500).json({ message: 'Cron failed', error: error.message });
  }
};
