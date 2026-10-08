import { Storage } from './lib/storage.js';
import { sendPushNotification } from './lib/push.js';

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
    let body = {};
    try {
      body = await req.json();
    } catch (e) {}

    // Allow frontend to pass custom message or fallback to stored schedule
    let subscription = body.subscription;
    if (!subscription || !subscription.endpoint) {
      subscription = await Storage.getSubscription('default');
    }

    if (!subscription || !subscription.endpoint) {
      return new Response(
        JSON.stringify({ error: 'No active push subscription found. Please enable notifications in the browser first.' }),
        { status: 400, headers }
      );
    }

    const schedule = await Storage.getSchedule('default');
    const customMessage = body.message || schedule?.message || '🔔 Test notification — your scheduler is working.';
    const sound = body.sound || schedule?.sound || 'default';

    const pushResult = await sendPushNotification(subscription, {
      title: '🔔 Test Notification',
      body: customMessage,
      sound: sound,
      url: '/'
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Test notification sent successfully',
        statusCode: pushResult.statusCode
      }),
      { status: 200, headers }
    );
  } catch (err) {
    console.error('send-test error:', err);
    return new Response(
      JSON.stringify({
        error: err.message || 'Failed to send test push notification',
        statusCode: err.statusCode
      }),
      { status: 500, headers }
    );
  }
};
