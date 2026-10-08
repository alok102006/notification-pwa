// Service Worker for Personal Scheduled Notifications PWA
const CACHE_NAME = 'personal-notify-v1';

self.addEventListener('install', (event) => {
  // Force immediate activation
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming Web Push Notifications
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push event received:', event);

  let data = {
    title: 'Personal Notification',
    body: 'Hey! What are you doing right now?',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    sound: 'default',
    tag: 'personal-schedule-notification'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/badge-72.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: data.tag || 'personal-schedule-notification',
    renotify: true,
    requireInteraction: false,
    data: data.data || { url: '/' }
  };

  // If a custom sound URL or identifier is provided, attach to options.
  // Note: Most Android browsers route notifications through the system notification channel
  if (data.sound && data.sound !== 'default') {
    options.sound = data.sound;
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle clicking on notification
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click received:', event.notification);
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
