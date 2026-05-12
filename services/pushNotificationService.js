const DeviceToken = require('../models/DeviceToken');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function isExpoToken(token) {
  return typeof token === 'string' && /^ExponentPushToken\[.+\]$/.test(token.trim());
}

async function sendPushToAllDevices({ title, body, data = {} }) {
  const tokens = await DeviceToken.find({ isActive: true }, 'token').lean();
  const validTokens = tokens.map((t) => t.token).filter(isExpoToken);
  if (!validTokens.length) return { sent: 0, invalidated: 0 };

  let sent = 0;
  let invalidated = 0;
  const chunkSize = 100;

  for (let i = 0; i < validTokens.length; i += chunkSize) {
    const chunk = validTokens.slice(i, i + chunkSize);
    const messages = chunk.map((to) => ({
      to,
      sound: 'default',
      title,
      body,
      data
    }));

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messages)
    });

    const json = await response.json();
    const results = Array.isArray(json?.data) ? json.data : [];

    for (let j = 0; j < results.length; j += 1) {
      const ticket = results[j];
      const token = chunk[j];
      if (ticket?.status === 'ok') {
        sent += 1;
        await DeviceToken.updateOne(
          { token },
          { $set: { lastSuccessAt: new Date(), lastFailure: '', isActive: true } }
        );
      } else {
        const details = ticket?.details || {};
        const errorMessage = ticket?.message || 'Push send failed';
        if (details.error === 'DeviceNotRegistered') {
          invalidated += 1;
          await DeviceToken.updateOne({ token }, { $set: { isActive: false, lastFailure: errorMessage } });
        } else {
          await DeviceToken.updateOne({ token }, { $set: { lastFailure: errorMessage } });
        }
      }
    }
  }

  return { sent, invalidated };
}

module.exports = {
  isExpoToken,
  sendPushToAllDevices
};
