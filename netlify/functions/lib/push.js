import webpush from 'web-push';
import dotenv from 'dotenv';

dotenv.config();

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || 'mailto:notifications@example.com';

let vapidConfigured = false;
if (publicKey && privateKey) {
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
  } catch (err) {
    console.error('Failed to configure VAPID details:', err);
  }
}

export function isVapidReady() {
  return vapidConfigured && !!publicKey && !!privateKey;
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || '';
}

/**
 * Send web push notification to a subscription
 */
export async function sendPushNotification(subscription, payload) {
  if (!isVapidReady()) {
    // Recheck in case env was loaded late
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    const sub = process.env.VAPID_SUBJECT || 'mailto:notifications@example.com';
    if (pub && priv) {
      webpush.setVapidDetails(sub, pub, priv);
      vapidConfigured = true;
    } else {
      throw new Error('VAPID keys are not configured in environment variables');
    }
  }

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh || subscription.keys?.p256dh,
      auth: subscription.auth || subscription.keys?.auth
    }
  };

  const notificationPayload = JSON.stringify({
    title: payload.title || 'Personal Notification',
    body: payload.body || 'Hey! What are you doing right now?',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/badge-72.png',
    sound: payload.sound || 'default',
    vibrate: [200, 100, 200],
    data: {
      url: payload.url || '/',
      timestamp: Date.now(),
      sound: payload.sound || 'default'
    },
    tag: payload.tag || 'personal-schedule-notification',
    renotify: true
  });

  return await webpush.sendNotification(pushSubscription, notificationPayload, {
    TTL: 60 * 60 // 1 hour time-to-live
  });
}
