import { Storage } from './lib/storage.js';
import { calculateNextNotification } from './lib/time.js';

export default async (req, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  try {
    const body = await req.json();
    const { schedule, subscription } = body;

    if (!schedule) {
      return new Response(JSON.stringify({ error: 'Schedule data is required' }), { status: 400, headers });
    }

    // Input validation & sanitization
    const sanitizedSchedule = {
      id: 'default',
      message: String(schedule.message || 'Hey! What are you doing right now?').slice(0, 500),
      intervalMinutes: Math.max(1, parseInt(schedule.intervalMinutes, 10) || 60),
      startTime: String(schedule.startTime || '08:00').match(/^([01]\d|2[0-3]):([0-5]\d)$/) ? schedule.startTime : '08:00',
      endTime: String(schedule.endTime || '00:00').match(/^([01]\d|2[0-3]):([0-5]\d)$/) ? schedule.endTime : '00:00',
      timezone: String(schedule.timezone || 'UTC'),
      enabled: Boolean(schedule.enabled),
      sound: String(schedule.sound || 'default')
    };

    // Save push subscription if provided
    if (subscription && subscription.endpoint) {
      await Storage.saveSubscription({
        endpoint: subscription.endpoint,
        keys: subscription.keys || {
          p256dh: subscription.p256dh,
          auth: subscription.auth
        },
        timezone: sanitizedSchedule.timezone
      }, 'default');
    }

    const saved = await Storage.saveSchedule(sanitizedSchedule);
    const nextNotification = calculateNextNotification(saved);

    return new Response(
      JSON.stringify({
        success: true,
        schedule: saved,
        nextNotification
      }),
      { status: 200, headers }
    );
  } catch (err) {
    console.error('save-schedule error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Failed to save schedule' }),
      { status: 500, headers }
    );
  }
};
