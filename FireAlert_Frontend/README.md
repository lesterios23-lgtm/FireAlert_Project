# FireAlert

This React application provides the FireAlert resident and BFP workspaces, plus
a System Admin dashboard for operational management.

## Run locally

```powershell
npm install
npm start
```

The development server opens the application at `http://localhost:3000` and,
because `.env` sets `HOST=0.0.0.0`, is also reachable from other devices on the
local network. In development the API defaults to port `8000` on the same host
the page was opened from, so a phone can use `http://<computer-ip>:3000`
without hard-coding an address. Start Laravel with `--host=0.0.0.0` so the
phone can reach it, then see [LAN testing](../docs/LAN-Testing.md) for the
full walkthrough, firewall notes, and troubleshooting.

Set `HOST=localhost` in `.env` to restrict the development server to this
computer again. Set `REACT_APP_API_URL` only when the API runs on a different
host or port.

## Production build

The production build uses the same-origin API path `/api/v1` by default, so
configure the web server or reverse proxy to route that path to Laravel. If the
API uses a different HTTPS origin, set `REACT_APP_API_URL` to that API's
`/api/v1` URL in the build environment before running `npm run build`. Do not
use a localhost or private LAN address in a production build.

```powershell
$env:REACT_APP_API_URL = 'https://your-api-host.example/api/v1'
npm run build
```

Replace the example URL with the deployed API address. Frontend environment
variables are embedded at build time; rebuild after changing them.

## System Admin

- Accounts with the System Admin role can open the dashboard from the BFP
  navigation. It displays incident records and supports management of resident
  accounts, linked BFP personnel, and firetrucks through the authenticated API.
- High-risk predictions remain unavailable until a validated prediction model
  is connected; the interface does not fabricate prediction results.
- Deletion is blocked when an account or firetruck is referenced by incident or
  dispatch records.

The application requires the Laravel API and database to be running for login,
incident records, and management actions. Maps use Leaflet and
OpenStreetMap tiles without an API key.

OpenStreetMap tiles require an internet connection. Device geolocation requires
browser permission and a secure context (localhost is allowed).
