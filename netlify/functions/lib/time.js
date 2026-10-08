/**
 * Time and Timezone calculation utilities for the Scheduler
 */

/**
 * Converts "HH:MM" string to minutes from midnight (0 to 1439).
 * If isEndTime is true and "00:00" is given, it can represent 1440 (midnight at end of day).
 */
export function timeToMinutes(timeStr, isEndTime = false) {
  if (!timeStr) return 0;
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  if (isEndTime && h === 0 && m === 0) {
    return 24 * 60; // 1440 = 24:00 (end of day)
  }
  return h * 60 + m;
}

/**
 * Get current time in minutes from midnight (0..1439) in the specified timezone
 */
export function getCurrentTimeInTimezone(timezone = 'UTC') {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(new Date());
    let hour = 0;
    let minute = 0;
    for (const part of parts) {
      if (part.type === 'hour') hour = parseInt(part.value, 10) % 24;
      if (part.type === 'minute') minute = parseInt(part.value, 10);
    }
    return {
      hour,
      minute,
      totalMinutes: hour * 60 + minute,
      timeString: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    };
  } catch (err) {
    // Fallback to UTC if timezone is invalid
    const now = new Date();
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();
    return {
      hour,
      minute,
      totalMinutes: hour * 60 + minute,
      timeString: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    };
  }
}

/**
 * Check if the given current minute falls inside the active hours window.
 * Supports standard windows (e.g. 08:00 to 20:00, 08:00 to 00:00)
 * and overnight windows (e.g. 22:00 to 08:00).
 */
export function isInsideActiveWindow(startTimeStr, endTimeStr, currentMinutes) {
  const start = timeToMinutes(startTimeStr, false);
  const end = timeToMinutes(endTimeStr, true);

  if (start === end) {
    // Equal start and end means active 24 hours
    return true;
  }

  if (start < end) {
    // Normal daytime window (e.g. 08:00 to 20:00, or 08:00 to 24:00)
    return currentMinutes >= start && currentMinutes < end;
  } else {
    // Overnight window crossing midnight (e.g. 22:00 to 08:00)
    // Active if current >= 22:00 (1320) OR current < 08:00 (480)
    const normalizedEnd = timeToMinutes(endTimeStr, false);
    return currentMinutes >= start || currentMinutes < normalizedEnd;
  }
}

/**
 * Determine if a notification is due to be sent according to interval and active window
 */
export function isNotificationDue(schedule) {
  if (!schedule || !schedule.enabled) {
    return { due: false, reason: 'Schedule is disabled' };
  }

  const { totalMinutes, timeString } = getCurrentTimeInTimezone(schedule.timezone || 'UTC');

  // 1. Check active hours
  const inWindow = isInsideActiveWindow(schedule.startTime, schedule.endTime, totalMinutes);
  if (!inWindow) {
    return {
      due: false,
      reason: `Outside active hours (${schedule.startTime} - ${schedule.endTime}). Local time: ${timeString}`
    };
  }

  // 2. Check interval elapsed
  if (!schedule.lastSentAt) {
    return { due: true, reason: 'First notification' };
  }

  const lastSentTime = new Date(schedule.lastSentAt).getTime();
  const nowTime = Date.now();
  const elapsedMinutes = (nowTime - lastSentTime) / (1000 * 60);

  // Allow a small tolerance (e.g. 30 seconds) for cron drift
  const intervalMinutes = Number(schedule.intervalMinutes) || 60;
  if (elapsedMinutes >= (intervalMinutes - 0.5)) {
    return { due: true, reason: `Interval elapsed: ${Math.round(elapsedMinutes)}m >= ${intervalMinutes}m` };
  }

  return {
    due: false,
    reason: `Interval not yet reached (${Math.round(elapsedMinutes)}m / ${intervalMinutes}m elapsed)`
  };
}

/**
 * Calculate expected next notification time string in user's timezone
 */
export function calculateNextNotification(schedule) {
  if (!schedule || !schedule.enabled) return null;

  const now = new Date();
  const intervalMs = (Number(schedule.intervalMinutes) || 60) * 60 * 1000;
  
  let nextDate;
  if (!schedule.lastSentAt) {
    nextDate = now;
  } else {
    const lastDate = new Date(schedule.lastSentAt);
    nextDate = new Date(lastDate.getTime() + intervalMs);
    if (nextDate.getTime() < now.getTime()) {
      nextDate = now;
    }
  }

  try {
    return nextDate.toLocaleTimeString([], {
      timeZone: schedule.timezone || 'UTC',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return nextDate.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
