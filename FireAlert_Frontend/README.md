# FireAlert BFP Dashboard

This React application is a custom visual preview for the FireAlert BFP
operations dashboard. The interface uses an original field-operations console
design based on the FireAlert system requirements, rather than reproducing the
supplied screenshots. It uses clearly labeled fictional entries for layout and
interaction review.

## Run locally

```powershell
npm install
npm start
```

The development server opens the dashboard at `http://localhost:3000`.

## Preview limitations

- The interface is not connected to Laravel, MySQL, BFP accounts, or live reports.
- Login is disabled; the preview does not authenticate users.
- Local status edits are temporary and are not saved.
- The map is an illustrative placeholder, not Google Maps or live GPS.
- Routes, ETA values, dispatch, and validated predictions are not available.
- The sample entries are fictional and must not be used for operational decisions.

When the Laravel API and approved Google Maps configuration are ready, connect the
screens to tested API contracts instead of treating preview data as real records.
