import { Storage } from './lib/storage.js';
import { isNotificationDue } from './lib/time.js';
import { sendPushNotification } from './lib/push.js';

export const config = {
  schedule: "* * * * *" // Run every minute to evaluate intervals accurately
};

export default async (req, context) => {
  console.log('[Scheduler] Cron execution started at:', new Date().toISOString());

  const results = [];

  try {
    const schedules = await Storage.getAllSchedules();
    const activeSchedules = schedules.filter(s => s.enabled);

    console.log(`[Scheduler] Found ${activeSchedules.length} active schedule(s) out of ${schedules.length} total.`);

    for (const schedule of activeSchedules) {
      const evaluation = isNotificationDue(schedule);
      console.log(`[Scheduler] Schedule [${schedule.id}] check:`, evaluation);

      if (evaluation.due) {
        const subscription = await Storage.getSubscription(schedule.id || 'default');
        
        if (!subscription || !subscription.endpoint) {
          console.warn(`[Scheduler] Schedule [${schedule.id}] is due, but no push subscription found.`);
          results.push({
            id: schedule.id,
            status: 'skipped_no_subscription',
            reason: 'No push subscription endpoint stored'
          });
          continue;
        }

        try {
          console.log(`[Scheduler] Sending push to schedule [${schedule.id}]...`);
          await sendPushNotification(subscription, {
            title: 'Personal Reminder',
            body: schedule.message || 'Hey! What are you doing right now?',
            sound: schedule.sound || 'default',
            url: '/'
          });

          const nowIso = new Date().toISOString();
          await Storage.updateLastSentAt(schedule.id, nowIso);

          console.log(`[Scheduler] Successfully sent push and updated lastSentAt for [${schedule.id}]`);
          results.push({
            id: schedule.id,
            status: 'sent',
            sentAt: nowIso
          });
        } catch (pushErr) {
          console.error(`[Scheduler] Failed to send push to [${schedule.id}]:`, pushErr);

          // If subscription has expired / unsubscribed (HTTP 410 or 404)
          if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
            console.log(`[Scheduler] Subscription expired for [${schedule.id}], removing...`);
            await Storage.removeSubscription(schedule.id);
          }

          results.push({
            id: schedule.id,
            status: 'failed',
            error: pushErr.message,
            statusCode: pushErr.statusCode
          });
        }
      } else {
        results.push({
          id: schedule.id,
          status: 'not_due',
          reason: evaluation.reason
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        executedAt: new Date().toISOString(),
        evaluatedCount: activeSchedules.length,
        results
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[Scheduler] Cron execution failed:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
