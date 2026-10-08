import React, { useState, useEffect, useRef } from 'react';
import {
  isPushSupported,
  getNotificationPermission,
  subscribeUserToPush,
  unsubscribeUserFromPush
} from './services/pushService.js';

export default function App() {
  // Detected timezone
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  // Form state
  const [message, setMessage] = useState('Hey! What are you doing right now?');
  const [intervalOption, setIntervalOption] = useState('60');
  const [customInterval, setCustomInterval] = useState(45);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('00:00');
  const [enabled, setEnabled] = useState(false);
  const [sound, setSound] = useState('default');
  const [customSoundUrl, setCustomSoundUrl] = useState(null);

  // Status & UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [lastSentAt, setLastSentAt] = useState(null);
  const [nextNotification, setNextNotification] = useState(null);
  const [banner, setBanner] = useState(null); // { type: 'success'|'error'|'info'|'warning', text: string }
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState(getNotificationPermission());

  const audioRef = useRef(null);

  // Interval value in minutes
  const activeIntervalMinutes = intervalOption === 'custom' ? Number(customInterval) : Number(intervalOption);

  // 1. Initial Load: Fetch settings from backend
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch('/.netlify/functions/get-schedule');
        if (res.ok) {
          const data = await res.json();
          if (data.schedule) {
            const s = data.schedule;
            setMessage(s.message || 'Hey! What are you doing right now?');
            setStartTime(s.startTime || '08:00');
            setEndTime(s.endTime || '00:00');
            setEnabled(Boolean(s.enabled));
            setSound(s.sound || 'default');
            setLastSentAt(s.lastSentAt);

            const interval = Number(s.intervalMinutes) || 60;
            if ([5, 10, 15, 30, 60, 120, 180].includes(interval)) {
              setIntervalOption(String(interval));
            } else {
              setIntervalOption('custom');
              setCustomInterval(interval);
            }
          }
          if (data.nextNotification) {
            setNextNotification(data.nextNotification);
          }
        }
      } catch (err) {
        console.warn('Could not load existing config:', err);
      } finally {
        setLoading(false);
      }
    }

    loadConfig();

    // Check if running in standalone mode (PWA installed)
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
    }

    // Capture PWA install prompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Show banner helper
  const showBanner = (type, text, timeout = 5000) => {
    setBanner({ type, text });
    if (timeout) {
      setTimeout(() => {
        setBanner(null);
      }, timeout);
    }
  };

  // 2. Play sound preview
  const playSoundPreview = () => {
    let src = '/sounds/bell.wav';
    if (sound === 'chime') src = '/sounds/chime.wav';
    if (sound === 'custom' && customSoundUrl) src = customSoundUrl;

    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    audioRef.current.src = src;
    audioRef.current.play().catch(err => {
      console.warn('Audio preview error:', err);
    });
  };

  // Handle custom audio file upload
  const handleSoundUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomSoundUrl(url);
      setSound('custom');
      showBanner('info', `Custom sound "${file.name}" loaded.`);
    }
  };

  // 3. Toggle Enabled / Disabled and Request Permission
  const handleToggleEnabled = async (newVal) => {
    if (!isPushSupported()) {
      showBanner('error', 'Push notifications are not supported in this browser. Try Chrome on Android.');
      return;
    }

    if (newVal) {
      // User is turning ON notifications
      try {
        setSaving(true);
        const subscription = await subscribeUserToPush();
        setPermissionStatus(getNotificationPermission());

        const payload = {
          schedule: {
            message,
            intervalMinutes: activeIntervalMinutes,
            startTime,
            endTime,
            timezone: userTimezone,
            enabled: true,
            sound
          },
          subscription
        };

        const res = await fetch('/.netlify/functions/save-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to save schedule');
        }

        const data = await res.json();
        setEnabled(true);
        setNextNotification(data.nextNotification || 'Calculating...');
        showBanner('success', '🟢 Notifications enabled! Real Web Push registered.');
      } catch (err) {
        console.error('Failed to enable push:', err);
        setPermissionStatus(getNotificationPermission());
        setEnabled(false);
        showBanner('error', err.message || 'Permission denied or failed to register.');
      } finally {
        setSaving(false);
      }
    } else {
      // User is turning OFF notifications
      try {
        setSaving(true);
        await unsubscribeUserFromPush();
        const payload = {
          schedule: {
            message,
            intervalMinutes: activeIntervalMinutes,
            startTime,
            endTime,
            timezone: userTimezone,
            enabled: false,
            sound
          }
        };

        await fetch('/.netlify/functions/save-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        setEnabled(false);
        setNextNotification(null);
        showBanner('info', '🔴 Notifications disabled.');
      } catch (err) {
        console.error('Failed to disable push:', err);
      } finally {
        setSaving(false);
      }
    }
  };

  // 4. Save settings
  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);

    try {
      let subscription = null;
      if (enabled) {
        subscription = await subscribeUserToPush().catch(() => null);
      }

      const payload = {
        schedule: {
          message,
          intervalMinutes: activeIntervalMinutes,
          startTime,
          endTime,
          timezone: userTimezone,
          enabled,
          sound
        },
        subscription
      };

      const res = await fetch('/.netlify/functions/save-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save settings');
      }

      const data = await res.json();
      if (data.nextNotification) {
        setNextNotification(data.nextNotification);
      }
      showBanner('success', 'Settings saved successfully.');
    } catch (err) {
      showBanner('error', err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // 5. Send Test Notification
  const handleSendTest = async () => {
    setTesting(true);
    try {
      // Make sure user has active push subscription
      const subscription = await subscribeUserToPush();
      setPermissionStatus(getNotificationPermission());

      const res = await fetch('/.netlify/functions/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `🔔 Test notification — your scheduler is working! (${message})`,
          sound,
          subscription
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to send test push notification');
      }

      showBanner('success', '🔔 Test notification sent! Check your notification tray.');
    } catch (err) {
      console.error('Test notification failed:', err);
      showBanner('error', err.message || 'Failed to trigger test notification');
    } finally {
      setTesting(false);
    }
  };

  // 6. Handle PWA Install
  const handleInstallClick = async () => {
    if (!installPrompt) {
      showBanner('info', 'To install: Tap browser menu (⋮) and choose "Add to Home Screen" or "Install App".');
      return;
    }
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setInstallPrompt(null);
      showBanner('success', 'App installed successfully!');
    }
  };

  if (loading) {
    return (
      <div className="app-container">
        <p>Loading notification settings...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header>
        <h1>Personal Notifications</h1>
      </header>

      {banner && (
        <div className={`alert-banner alert-${banner.type}`}>
          {banner.text}
        </div>
      )}

      {permissionStatus === 'denied' && (
        <div className="alert-banner alert-error">
          ⚠️ Notification permission is blocked in your browser. Click the site settings lock icon in your browser address bar and enable Notifications.
        </div>
      )}

      <form className="card" onSubmit={handleSaveSettings}>
        {/* Message */}
        <div className="form-group">
          <label htmlFor="message">Message</label>
          <textarea
            id="message"
            rows="3"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Hey! What are you doing right now?"
            required
          />
        </div>

        {/* Interval */}
        <div className="form-group">
          <label htmlFor="interval">Notification interval</label>
          <select
            id="interval"
            value={intervalOption}
            onChange={(e) => setIntervalOption(e.target.value)}
          >
            <option value="5">Every 5 minutes</option>
            <option value="10">Every 10 minutes</option>
            <option value="15">Every 15 minutes</option>
            <option value="30">Every 30 minutes</option>
            <option value="60">Every 1 hour</option>
            <option value="120">Every 2 hours</option>
            <option value="180">Every 3 hours</option>
            <option value="custom">Custom interval...</option>
          </select>
        </div>

        {intervalOption === 'custom' && (
          <div className="form-group">
            <label htmlFor="customInterval">Custom interval (minutes)</label>
            <input
              id="customInterval"
              type="number"
              min="1"
              max="1440"
              value={customInterval}
              onChange={(e) => setCustomInterval(e.target.value)}
              required
            />
          </div>
        )}

        {/* Active Hours */}
        <div className="grid-2">
          <div className="form-group">
            <label htmlFor="startTime">Active From</label>
            <input
              id="startTime"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="endTime">Active Until</label>
            <input
              id="endTime"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </div>
        </div>

        <p className="label-hint">
          {startTime} → {endTime} ({userTimezone})
          {startTime > endTime && ' (Active overnight crossing midnight)'}
        </p>

        {/* Enable / Disable Toggle */}
        <div className="toggle-container">
          <label htmlFor="toggle-notify" style={{ cursor: 'pointer' }}>
            Notifications: <strong>{enabled ? 'ON' : 'OFF'}</strong>
          </label>
          <label className="toggle-switch">
            <input
              id="toggle-notify"
              type="checkbox"
              checked={enabled}
              disabled={saving}
              onChange={(e) => handleToggleEnabled(e.target.checked)}
            />
            <span className="slider"></span>
          </label>
        </div>

        {/* Sound Selection */}
        <div className="form-group">
          <label htmlFor="sound">Notification Sound</label>
          <div className="sound-row">
            <select
              id="sound"
              value={sound}
              onChange={(e) => setSound(e.target.value)}
            >
              <option value="default">Default System Sound</option>
              <option value="bell">Bell Chime</option>
              <option value="chime">Soft Chime</option>
              <option value="custom">Uploaded Sound</option>
            </select>
            <button
              type="button"
              className="btn btn-secondary btn-icon"
              onClick={playSoundPreview}
              title="Preview Sound"
            >
              ▶ Play
            </button>
          </div>

          {sound === 'custom' && (
            <div style={{ marginTop: '8px' }}>
              <input
                type="file"
                accept=".mp3,.wav,.ogg,audio/*"
                onChange={handleSoundUpload}
              />
            </div>
          )}

          <p className="sound-note">
            ℹ️ Note: Android Chrome delivers web notifications via the default system notification channel and tone.
          </p>
        </div>

        {/* Action Buttons */}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleSendTest}
          disabled={testing}
        >
          {testing ? 'Sending Push...' : 'Send Test Notification'}
        </button>
      </form>

      {/* Status Section */}
      <div className="card status-box">
        <label>Status</label>
        <div>
          {enabled ? (
            <span className="status-pill enabled">🟢 Notifications enabled</span>
          ) : (
            <span className="status-pill disabled">🔴 Notifications disabled</span>
          )}
        </div>

        <div className="info-row">
          <span>Next notification:</span>
          <span className="info-val">{enabled ? (nextNotification || 'Scheduled') : 'None'}</span>
        </div>

        <div className="info-row">
          <span>Last notification:</span>
          <span className="info-val">
            {lastSentAt ? new Date(lastSentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
          </span>
        </div>

        <div className="info-row">
          <span>Device Timezone:</span>
          <span className="info-val">{userTimezone}</span>
        </div>
      </div>

      {/* PWA Install Section */}
      {!isInstalled && (
        <div className="card install-card">
          <label>Install App</label>
          <p className="label-hint">
            Install this PWA on your home screen for quick access and standalone mobile experience.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleInstallClick}
          >
            📱 Install App
          </button>
        </div>
      )}
    </div>
  );
}
