const env = require('../config/env');
const logger = require('../utils/logger');

const ENDPOINT = 'https://notify-api.line.me/api/notify';

async function send(message) {
  if (!env.LINE_NOTIFY_TOKEN) {
    logger.info(`[lineNotify:noop] ${message}`);
    return { sent: false, reason: 'LINE_NOTIFY_TOKEN ยังไม่ได้ตั้งค่า' };
  }

  try {
    const body = new URLSearchParams({ message }).toString();
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.LINE_NOTIFY_TOKEN}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.warn(`Line Notify failed ${res.status}: ${text.slice(0, 200)}`);
      return { sent: false, reason: `HTTP ${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    logger.warn(`Line Notify exception: ${err.message}`);
    return { sent: false, reason: err.message };
  }
}

module.exports = { send };
