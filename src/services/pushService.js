/**
 * Web Push and Service Worker client service
 */

// Helper to convert VAPID public key base64 URL to Uint8Array
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Register Service Worker
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Workers are not supported in this browser.');
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    console.log('[SW] Service Worker registered with scope:', registration.scope);
    await navigator.serviceWorker.ready;
    return registration;
  } catch (err) {
    console.error('[SW] Registration failed:', err);
    throw err;
  }
}

/**
 * Check if Web Push is supported
 */
export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Get current Notification permission status
 */
export function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    throw new Error('Notifications are not supported by this browser.');
  }
  return await Notification.requestPermission();
}

/**
 * Fetch VAPID Public Key from server
 */
export async function fetchVapidPublicKey() {
  const res = await fetch('/.netlify/functions/get-vapid-key');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch VAPID public key from server');
  }
  const data = await res.json();
  return data.publicKey;
}

/**
 * Subscribe browser to Web Push
 */
export async function subscribeUserToPush() {
  if (!isPushSupported()) {
    throw new Error('Push messaging is not supported in this browser.');
  }

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    throw new Error(`Notification permission ${permission}. Please allow notifications in your browser settings.`);
  }

  const registration = await registerServiceWorker();
  const existingSub = await registration.pushManager.getSubscription();

  if (existingSub) {
    return existingSub;
  }

  const publicKey = await fetchVapidPublicKey();
  const convertedKey = urlBase64ToUint8Array(publicKey);

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: convertedKey
  });

  console.log('[Push] User subscribed successfully:', subscription);
  return subscription;
}

/**
 * Unsubscribe browser from Web Push
 */
export async function unsubscribeUserFromPush() {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await subscription.unsubscribe();
    console.log('[Push] User unsubscribed.');
  }
}
