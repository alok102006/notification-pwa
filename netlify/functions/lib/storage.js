import fs from 'fs';
import path from 'path';
import { getStore } from '@netlify/blobs';

const LOCAL_DATA_DIR = path.resolve(process.cwd(), '.data');
const LOCAL_STORE_FILE = path.join(LOCAL_DATA_DIR, 'notifications_store.json');

// Ensure local directory exists for fallback
function ensureLocalDir() {
  if (!fs.existsSync(LOCAL_DATA_DIR)) {
    fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
  }
}

function readLocalStore() {
  ensureLocalDir();
  if (!fs.existsSync(LOCAL_STORE_FILE)) {
    return { schedules: {}, subscriptions: {} };
  }
  try {
    const raw = fs.readFileSync(LOCAL_STORE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading local store fallback:', err);
    return { schedules: {}, subscriptions: {} };
  }
}

function writeLocalStore(data) {
  ensureLocalDir();
  fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Check if Netlify Blobs is available in the current environment
 */
function isNetlifyBlobsAvailable() {
  return !!(
    process.env.NETLIFY_BLOBS_CONTEXT ||
    process.env.NETLIFY_SITE_ID ||
    process.env.SITE_ID ||
    process.env.NETLIFY_AUTH_TOKEN
  );
}

/**
 * Storage Layer with Netlify Blobs and Local JSON fallback
 */
export const Storage = {
  async getStoreData() {
    if (isNetlifyBlobsAvailable()) {
      try {
        const store = getStore({ name: 'personal-notifications', consistency: 'strong' });
        const raw = await store.get('app_state', { type: 'json' });
        if (raw) return raw;
      } catch (err) {
        console.warn('Netlify Blobs get error, falling back to local store:', err.message);
      }
    }
    return readLocalStore();
  },

  async saveStoreData(data) {
    let savedToBlobs = false;
    if (isNetlifyBlobsAvailable()) {
      try {
        const store = getStore({ name: 'personal-notifications', consistency: 'strong' });
        await store.setJSON('app_state', data);
        savedToBlobs = true;
      } catch (err) {
        console.warn('Netlify Blobs set error, saving to local store:', err.message);
      }
    }
    // Always keep local copy synced as fallback/local dev
    writeLocalStore(data);
    return { success: true, savedToBlobs };
  },

  async getSchedule(id = 'default') {
    const data = await this.getStoreData();
    return data.schedules?.[id] || null;
  },

  async getAllSchedules() {
    const data = await this.getStoreData();
    return Object.values(data.schedules || {});
  },

  async saveSchedule(schedule) {
    const data = await this.getStoreData();
    if (!data.schedules) data.schedules = {};
    const now = new Date().toISOString();
    
    const existing = data.schedules[schedule.id || 'default'] || {};
    const updated = {
      id: schedule.id || 'default',
      message: schedule.message || 'Hey! What are you doing right now?',
      intervalMinutes: Number(schedule.intervalMinutes) || 60,
      startTime: schedule.startTime || '08:00',
      endTime: schedule.endTime || '00:00',
      timezone: schedule.timezone || 'UTC',
      enabled: typeof schedule.enabled === 'boolean' ? schedule.enabled : true,
      sound: schedule.sound || 'default',
      lastSentAt: schedule.lastSentAt !== undefined ? schedule.lastSentAt : (existing.lastSentAt || null),
      createdAt: existing.createdAt || now,
      updatedAt: now
    };

    data.schedules[updated.id] = updated;
    await this.saveStoreData(data);
    return updated;
  },

  async updateLastSentAt(scheduleId, timestamp = new Date().toISOString()) {
    const data = await this.getStoreData();
    if (data.schedules && data.schedules[scheduleId]) {
      data.schedules[scheduleId].lastSentAt = timestamp;
      data.schedules[scheduleId].updatedAt = new Date().toISOString();
      await this.saveStoreData(data);
      return data.schedules[scheduleId];
    }
    return null;
  },

  async getSubscription(id = 'default') {
    const data = await this.getStoreData();
    return data.subscriptions?.[id] || null;
  },

  async saveSubscription(sub, id = 'default') {
    const data = await this.getStoreData();
    if (!data.subscriptions) data.subscriptions = {};
    const now = new Date().toISOString();
    
    data.subscriptions[id] = {
      id,
      endpoint: sub.endpoint,
      p256dh: sub.keys?.p256dh || sub.p256dh,
      auth: sub.keys?.auth || sub.auth,
      timezone: sub.timezone || 'UTC',
      createdAt: data.subscriptions[id]?.createdAt || now,
      updatedAt: now
    };

    await this.saveStoreData(data);
    return data.subscriptions[id];
  },

  async removeSubscription(id = 'default') {
    const data = await this.getStoreData();
    if (data.subscriptions && data.subscriptions[id]) {
      delete data.subscriptions[id];
      await this.saveStoreData(data);
    }
    return true;
  }
};
