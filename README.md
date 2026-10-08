# Personal Scheduled Notification PWA 🔔

A production-ready, lightweight **Personal Scheduled Notification Progressive Web App (PWA)** built with **React + Vite**, **Service Workers**, **Web Push API**, and **Netlify Scheduled Functions**.

Designed to be installed directly onto your Android phone via your mobile browser and send scheduled push notifications reliably even when the PWA is closed, your phone is locked, or another app is open.

---

## 🚀 Key Features

- **PWA Installable**: Mobile-first, installable directly from Chrome/Edge on Android as a standalone app.
- **True Web Push Notifications**: Uses the standard W3C Web Push & Notification APIs. Runs via a server-side Netlify cron scheduler — no unreliable frontend `setInterval()`.
- **Custom Message**: Set your reminder or check-in text (e.g. *"Hey! What are you doing right now?"*).
- **Flexible Intervals**: 5 min, 10 min, 15 min, 30 min, 1 hour, 2 hours, 3 hours, or custom minutes.
- **Active Hours & Quiet Hours**: Configurable active time window (e.g. `08:00` → `00:00`) with full support for overnight schedules crossing midnight (e.g. `22:00` → `08:00`).
- **Timezone Aware**: Automatically detects your device timezone (e.g. `Asia/Kolkata`, `America/New_York`, etc.) and evaluates active hours based on local time.
- **Instant Test Notification**: "Send Test Notification" button to verify the push pipeline immediately.
- **Sound Handling**: Select between chime sounds, upload a custom audio file for preview, and view clear platform status.
- **Zero-Fuss Storage**: Automatically uses **Netlify Blobs** in production with a local JSON file fallback for seamless local development.

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: React 18, Vite, Service Worker (`sw.js`), Web App Manifest (`manifest.json`), Web Push API.
- **Backend**: Netlify Functions (Node.js ESM)
  - `get-vapid-key`: Returns the public VAPID key to the browser for subscription.
  - `get-schedule`: Returns current user schedule & push status.
  - `save-schedule`: Persists schedule and browser push subscription.
  - `send-test`: Sends an immediate push notification on demand.
  - `cron-scheduler`: Scheduled Netlify Function running every minute (`* * * * *`) to evaluate intervals and dispatch push notifications when due.
- **Web Push**: Standard VAPID / RFC8291 payload encryption using `web-push`.
- **Storage**: `@netlify/blobs` (Netlify's native key-value blob storage).

---

## 📦 Quick Start (Local Development)

### 1. Install dependencies
```bash
npm install
```

### 2. Generate VAPID Keys
Run the included key generator:
```bash
npm run generate-keys
```
This automatically generates a fresh VAPID keypair and writes it to your local `.env` file:
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

### 3. Start Local Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:5173`.

> **Note**: Vite includes a built-in dev middleware for all `/.netlify/functions/*` endpoints, so you can test the fullstack experience with just `npm run dev`.

### 4. Test the Local Scheduler
To trigger the scheduler logic manually and test interval checks:
```bash
npm run test-scheduler
```
Or run the automated unit test suite:
```bash
node tests/scheduler.test.js
```

---

## 🌐 Netlify Deployment Guide

Deploying this app to Netlify takes under 3 minutes:

### Step 1: Push code to GitHub / GitLab
```bash
git init
git add .
git commit -m "Initial commit of Personal Notification PWA"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/personal-notification-pwa.git
git push -u origin main
```

### Step 2: Deploy to Netlify
1. Go to [Netlify App](https://app.netlify.com/) and click **"Add new site"** > **"Import an existing project"**.
2. Select your repository.
3. The build settings in `netlify.toml` are detected automatically:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Functions directory**: `netlify/functions`

### Step 3: Add Environment Variables in Netlify
In your Netlify site dashboard, go to:
**Site configuration** > **Environment variables** > **Add a variable** (or import from `.env`):

| Variable Name | Value | Description |
| :--- | :--- | :--- |
| `VAPID_PUBLIC_KEY` | *(Your public VAPID key)* | Public key for web push subscriptions |
| `VAPID_PRIVATE_KEY` | *(Your private VAPID key)* | **Never expose to frontend** |
| `VAPID_SUBJECT` | `mailto:your-email@example.com` | Contact email for push service operators |

### Step 4: Enable Netlify Blobs (Storage)
Netlify Blobs is enabled by default on all standard Netlify sites with zero extra configuration. The `@netlify/blobs` package automatically connects using Netlify's built-in runtime context.

### Step 5: Trigger Deploy
Click **"Deploy site"**. Once built, Netlify will assign your site a live URL (e.g. `https://your-app.netlify.app`).

---

## 📱 How to Install on Android Mobile Phone

1. On your Android phone, open **Google Chrome** (or Edge/Brave).
2. Navigate to your deployed Netlify URL (e.g., `https://your-app.netlify.app`).
3. Tap the **"📱 Install App"** button on the screen, or tap the browser menu (**⋮** three vertical dots) and tap **"Install App"** / **"Add to Home Screen"**.
4. Confirm installation. The app will now appear on your home screen and app drawer as an independent native-feeling app.
5. Open the installed app from your home screen.
6. Toggle **Notifications: ON** and tap **Allow** when prompted for notification permissions.
7. Click **"Send Test Notification"** to confirm your phone immediately receives the push notification in the Android system notification tray!

---

## 🔍 How the Server-Side Scheduler Works

1. Netlify's Scheduled Function runner invokes `cron-scheduler` every minute (`* * * * *`).
2. The function loads all active schedules from `@netlify/blobs`.
3. For each active schedule:
   - **Timezone check**: Converts the current UTC time to the user's configured local timezone (`Intl.DateTimeFormat`).
   - **Active Window check**: Evaluates whether the current local time is inside `startTime` → `endTime` (e.g. `08:00` → `00:00` or overnight `22:00` → `08:00`).
   - **Interval check**: Checks if `(now - lastSentAt) >= intervalMinutes`.
   - **Push Dispatch**: If all checks pass, encrypts and transmits the push payload via the Web Push protocol (`web-push`).
   - **State Update**: Updates `lastSentAt` timestamp in storage so duplicates are prevented.

---

## 🔊 Important Note on Notification Sounds (Android & Web Push)

Under standard W3C Web Notification specifications and Android OS architecture:
- Android Chrome routes all Web Push notifications directly through the **system notification channel** assigned to the browser / PWA.
- Android plays the default system notification sound or ringtone configured for browser notifications in your device's **Android Settings > Apps > Chrome / Notifier > Notifications**.
- Custom sound playback (`sound: url`) in the Push API is supported in frontend preview and passed to the Service Worker options, but Android OS controls device ringtone playback at the operating system channel level for security and battery preservation.

---

## 🧪 Testing Checklist

- [x] **Test 1 (Disabled)**: Set Notifications to OFF -> Scheduler bypasses push.
- [x] **Test 2 (Enabled)**: Click "Send Test Notification" -> Push arrives immediately in system tray.
- [x] **Test 3 (Intervals)**: 5 min interval requires 5+ minutes elapsed since previous send.
- [x] **Test 4 (Active Hours)**: `08:00` → `12:00` only sends during daytime window.
- [x] **Test 5 (Midnight Crossing)**: `22:00` → `08:00` sends between 10 PM and 8 AM across midnight.
- [x] **Test 6 (Phone Locked / Background)**: Web Push arrives via system push service without requiring an open browser tab.
- [x] **Test 7 (PWA Closed)**: Notifications delivered directly to Android notification center.
