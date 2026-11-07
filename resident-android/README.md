# FireAlert Mobile Web App (PWA)

This directory contains the **mobile web version** of FireAlert — a Progressive Web App (PWA) that works on **any device** (iPhone, Android, tablet, desktop) without needing a native app store download.

## Why PWA instead of Native Android?

A native Android APK only works on Android devices. iPhone users cannot install it. A PWA works on:
- ✅ iPhone (iOS Safari — "Add to Home Screen")
- ✅ Android (Chrome — "Install app")
- ✅ Tablets (iPad, Android tablets)
- ✅ Desktop browsers
- ✅ Any device with a modern web browser

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | PWA metadata — app name, icons, colors, install behavior |
| `service-worker.js` | Offline caching — app works without internet |
| `index.html` | Entry point — registers service worker, loads the app |
| `build.gradle` | *(legacy)* Native Android Gradle config — no longer used |
| `settings.gradle` | *(legacy)* Native Android settings — no longer used |

## How Residents Install It

### iPhone (iOS Safari)
1. Open Safari and go to the FireAlert URL
2. Tap the **Share** button (square with arrow)
3. Scroll down and tap **"Add to Home Screen"**
4. The FireAlert icon appears on the home screen like a native app

### Android (Chrome)
1. Open Chrome and go to the FireAlert URL
2. Tap the menu (three dots)
3. Tap **"Install app"** or **"Add to Home screen"**
4. The FireAlert icon appears on the home screen

### Desktop
1. Open Chrome or Edge
2. Look for the install icon in the address bar
3. Click **"Install FireAlert"**

## Backend Connection

The PWA connects to the Laravel backend API at `http://localhost:8000/api/v1` (development) or your production URL. Update the API base URL in the React frontend (`FireAlert_Frontend/src/`) to point to your deployed backend.

## Build & Deploy

1. Build the React frontend:
   ```powershell
   cd FireAlert_Frontend
   npm install
   npm run build
   ```

2. Deploy the `build/` folder to any web host (Netlify, Vercel, Firebase Hosting, Apache, Nginx, etc.)

3. Residents visit the URL and install the PWA from their browser — no app store needed.

## Notes

- No Google Play Store or Apple App Store submission required
- Updates are automatic — residents always get the latest version when they refresh
- Works offline for cached pages (service worker)
- No native device features (camera, push notifications) unless added via Web APIs