const DeviceToken = require('../models/DeviceToken');
const { isExpoToken } = require('../services/pushNotificationService');

/** Register device for broadcast pushes without login (any app install). */
exports.registerInstallPushToken = async (req, res) => {
  try {
    const token = String(req.body.token || '').trim();
    const platform = ['ios', 'android'].includes(req.body.platform) ? req.body.platform : 'unknown';

    if (!isExpoToken(token)) {
      return res.status(400).json({ message: 'Invalid Expo push token' });
    }

    const doc = await DeviceToken.findOneAndUpdate(
      { token },
      {
        $set: {
          token,
          platform,
          isActive: true
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    res.json({ message: 'Install push token registered', deviceTokenId: doc._id });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.registerPushToken = async (req, res) => {
  try {
    const token = String(req.body.token || '').trim();
    const platform = ['ios', 'android'].includes(req.body.platform) ? req.body.platform : 'unknown';

    if (!isExpoToken(token)) {
      return res.status(400).json({ message: 'Invalid Expo push token' });
    }

    const doc = await DeviceToken.findOneAndUpdate(
      { token },
      {
        $set: {
          userId: req.user._id,
          token,
          platform,
          isActive: true
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    res.json({ message: 'Push token registered', deviceTokenId: doc._id });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.unregisterPushToken = async (req, res) => {
  try {
    const token = String(req.body.token || '').trim();
    if (!token) {
      return res.status(400).json({ message: 'token is required' });
    }
    await DeviceToken.updateOne({ token, userId: req.user._id }, { $set: { isActive: false } });
    res.json({ message: 'Push token unregistered' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
