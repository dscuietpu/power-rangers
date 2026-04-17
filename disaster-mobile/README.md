# 🚨 Power Rangers - Disaster Response (Native Android App)

A Capacitor-wrapped native Android app that loads the existing Next.js web application with **native push notification siren sound** support.

## Architecture

```
disaster/              ← Your existing Next.js web app (unchanged)
disaster-mobile/       ← This Capacitor native wrapper
  ├── android/         ← Native Android project (open in Android Studio)
  ├── www/             ← Placeholder web assets (app loads from remote URL)
  ├── capacitor.config.ts  ← Main config (server URL, plugins)
  └── generate-siren.js   ← Siren WAV generator script
```

**How it works:** The native Android app is a WebView shell that loads your web app from a remote URL (your dev server or deployed URL). It adds **native capabilities** that browsers can't provide:

- 🔊 **Siren sound on push notifications** (plays even when app is closed)
- 📳 **Native vibration** 
- 📍 **Background location access**
- 🔔 **High-priority alarm notifications** (overrides silent mode)

## Prerequisites

1. **Android Studio** — [Download here](https://developer.android.com/studio)
2. **Java JDK 17+** — Included with Android Studio
3. **Your web app running** — `npm run dev` in the `disaster/` folder

## Quick Start

### 1. Start your web app
```bash
cd ../disaster
npm run dev
```
Note the network URL (e.g., `http://10.132.145.212:3000`).

### 2. Update the server URL
Edit `capacitor.config.ts` and set the `server.url` to your network IP:
```typescript
server: {
  url: 'http://YOUR_NETWORK_IP:3000',
  cleartext: true,
}
```

### 3. Sync & Open in Android Studio
```bash
cd disaster-mobile
npx cap sync android
npx cap open android
```

### 4. Build & Run
In Android Studio:
- Connect your Android phone via USB (with USB debugging enabled)
- Or use an emulator
- Click the green **Run** ▶️ button

### 5. For production deployment
Change the `server.url` in `capacitor.config.ts` to your deployed Vercel/production URL:
```typescript
server: {
  url: 'https://your-app.vercel.app',
  // Remove cleartext: true for production
}
```

## Custom Siren Sound

The app creates a high-priority Android notification channel called `disaster_alerts` with:
- **Custom siren sound** (`res/raw/siren.wav`) — 5-second generated siren
- **USAGE_ALARM** — Plays at alarm volume, even in silent mode
- **Aggressive vibration pattern**
- **Red notification LED**

To regenerate the siren sound:
```bash
node generate-siren.js
```

## Building a Release APK

1. Open Android Studio → `android/` project
2. Menu → **Build** → **Generate Signed Bundle / APK**
3. Choose APK
4. Create or select a keystore
5. Build type: **release**
6. The APK will be in `android/app/build/outputs/apk/release/`

## Files Modified in the Web App

The following files in `disaster/` were updated to support the native app:

- `app/api/volunteers/notify/route.ts` — Added `android_channel_id: 'disaster_alerts'` to push notification payload so the native siren sound channel is used.

## Troubleshooting

### App shows blank screen
- Make sure your web app dev server is running
- Check that `server.url` in `capacitor.config.ts` matches your network IP
- Phone must be on the same WiFi network as your dev machine

### No siren sound on notifications
- Go to Android Settings → Apps → Power Rangers → Notifications → Disaster Alerts
- Make sure the channel is enabled and volume is up
- If you changed the siren.wav, you may need to uninstall and reinstall the app (Android caches notification channels)

### Push notifications not working
- The app uses web push (not FCM) — subscriptions are managed by the web app
- Make sure the volunteer has notification permissions granted in the web app
