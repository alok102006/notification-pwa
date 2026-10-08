import fs from 'fs';
import path from 'path';
import os from 'os';
import { getStore } from '@netlify/blobs';

// Memory cache fallback
let memoryStore = { schedules: {}, subscriptions: {} };

// Fallback directory in /tmp (or OS temp directory) which is always writable
const TMP_DATA_DIR = path.join(os.tmpdir(), 'personal_notify_data');
const TMP_STORE_FILE = path.join(TMP_DATA_DIR, 'notifications_store.json');

function ensureFallbackDir() {
  try {
    if (!fs.existsSync(TMP_DATA_DIR)) {
      fs.mkdirSync(TMP_DATA_DIR, { recursive: true });
    }
    return true;
  } catch (err) {
    console.warn('Could not create temp directory, using in-memory store:', err.message);
    return false;
  }
}

function readFallbackStore() {
  try {
    if (ensureFallbackDir() && fs.existsSync(TMP_STORE_FILE)) {
      const raw = fs.readFileSync(TMP_STORE_FILE, 'utf-8');
      memoryStore = JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Error reading fallback store:', err.message);
  }
  return memoryStore;
}

function writeFallbackStore(data) {
  memoryStore = data;
  try {
    if (ensureFallbackDir()) {
      fs.writeFileSync(TMP_STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    }
  } catch (err) {
    console.warn('Error writing fallback store to disk, retained in memory:', err.message);
  }
}

/**
 * Storage Layer: Uses Netlify Blobs with graceful fallback
 */
export const Storage = {
  async getStoreData() {
    try {
      const store = getStore({ name: 'personal-notifications', consistency: 'strong' });
      const raw = await store.get('app_state', { type: 'json' });
      if (raw && typeof raw === 'object') {
        return raw;
      }
    } catch (err) {
      console.warn('[Storage] Netlify Blobs get not available or error:', err.message);
    }
    return readFallbackStore();
  },

  async saveStoreData(data) {
    try {
      const store = getStore({ name: 'personal-notifications', consistency: 'strong' });
      await store.setJSON('app_state', data);
      return { success: true, savedToBlobs: true };
    } catch (err) {
      console.warn('[Storage] Netlify Blobs save error, using fallback:', err.message);
      writeFallbackStore(data);
      return { success: true, savedToBlobs: false };
    }
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
