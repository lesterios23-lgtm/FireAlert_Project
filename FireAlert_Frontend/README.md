# FireAlert

This React application provides the FireAlert resident and BFP workspaces, plus
a System Admin dashboard for operational management.

## Run locally

```powershell
npm install
npm start
```

The development server opens the application at `http://localhost:3000`. The
Laravel API defaults to `http://localhost:8000/api/v1`; set
`REACT_APP_API_URL` when the API is hosted elsewhere.

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
