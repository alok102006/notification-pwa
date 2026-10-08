import { Storage } from './lib/storage.js';
import { calculateNextNotification } from './lib/time.js';

export default async (req, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const schedule = await Storage.getSchedule('default');
    const subscription = await Storage.getSubscription('default');

    let nextNotification = null;
    if (schedule) {
      nextNotification = calculateNextNotification(schedule);
    }

    return new Response(
      JSON.stringify({
        schedule: schedule || {
          id: 'default',
          message: 'Hey! What are you doing right now?',
          intervalMinutes: 60,
          startTime: '08:00',
          endTime: '00:00',
          timezone: 'UTC',
          enabled: false,
          sound: 'default',
          lastSentAt: null
        },
        hasSubscription: !!subscription,
        nextNotification
      }),
      { status: 200, headers }
    );
  } catch (err) {
    console.error('get-schedule error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Failed to fetch schedule' }),
      { status: 500, headers }
    );
  }
};
