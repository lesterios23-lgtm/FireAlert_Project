# FireAlert Resident Android App

This directory contains the native Android resident app. The separate React
web/PWA frontend is in `../FireAlert_Frontend`.

## Development

Debug builds detect the development computer's current private IPv4 address
during the build — the address the operating system routes traffic through —
and use `http://<detected-ip>:8000/api/v1/`, so a phone on the same Wi-Fi or
hotspot can sign in without editing a hard-coded IP. Rebuild after changing
networks:

```powershell
.\gradlew.bat assembleDebug
```

To see the detected address without assembling the APK, run
`.\gradlew.bat :app:printDebugApiBaseUrl`.

If no LAN address is detected, or to force a specific address (for example the
emulator's host alias), set the `FIREALERT_API_BASE_URL` Gradle property or
environment variable. It must end in `/api/v1/`:

```powershell
.\gradlew.bat assembleDebug -PFIREALERT_API_BASE_URL=http://10.0.2.2:8000/api/v1/
```

Debug builds allow HTTP for a local development API; release builds do not.
See [LAN testing](../docs/LAN-Testing.md) for the backend and firewall setup.

## Release build

Set `FIREALERT_API_BASE_URL` to the deployed HTTPS API URL before building.
Release packaging fails if the value is missing, is not HTTPS, or does not end
in `/api/v1/`.

```powershell
$env:FIREALERT_API_BASE_URL = 'https://your-api-host.example/api/v1/'
.\gradlew.bat assembleRelease
```

Replace the example with the actual production API URL. Never use a localhost
or private LAN address in a release build.
