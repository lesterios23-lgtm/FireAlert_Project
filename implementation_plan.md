# Implementation Plan

## [Overview]

Redesign the FireAlert frontend UI/UX by removing the existing "old design" (the current Incident operations dashboard) and replacing it with a modern, responsive emergency management platform. The redesign covers six screens across two portals:

1. **Resident Portal** (mobile-first): Emergency Fire Reporting, Real-Time Response Tracking, Resident Submission History
2. **BFP Personnel Portal** (desktop-first): Emergency Command Center (three-column layout), Incident Records (two-column layout), High-Risk Location Prediction

The design follows the MASTER UI/UX DESIGN PROMPT with navy #14283F navigation, emergency red #D93636 for critical actions, success green #239B70, warning amber #E9A23B, white cards, and light gray #F3F5F7 backgrounds. The backend API (Laravel) remains unchanged — only the React frontend is modified.

## [Types]

No TypeScript is used; the project is plain JavaScript/React. No type system changes are required. The existing React component structure in `App.js` will be reorganized into modular components.

### Design System (CSS Custom Properties)

| Token | Value | Usage |
|-------|-------|-------|
| `--navy` | `#14283F` | Navigation bar, header backgrounds |
| `--navy-dark` | `#0E1C2B` | Active nav items, deep shadows |
| `--red` | `#D93636` | Emergency actions, submit buttons, critical alerts |
| `--red-dark` | `#B5121F` | Red hover states |
| `--green` | `#239B70` | Resolved/success statuses |
| `--green-dark` | `#1A7A5A` | Green hover states |
| `--amber` | `#E9A23B` | Pending/warning statuses |
| `--amber-dark` | `#C18A2E` | Amber hover states |
| `--bg` | `#F3F5F7` | Page background |
| `--surface` | `#FFFFFF` | Card backgrounds |
| `--border` | `#DDE4EC` | Card borders, dividers |
| `--text` | `#263445` | Primary text |
| `--text-2` | `#77818D` | Secondary text |
| `--text-3` | `#AAB7C4` | Muted text |
| `--radius` | `8px` | Card rounding |
| `--radius-lg` | `12px` | Large card/panel rounding |
| `--shadow` | `0 1px 3px rgb(20 40 63 / 0.08), 0 1px 2px rgb(20 40 63 / 0.06)` | Card shadows |
| `--shadow-lg` | `0 12px 32px rgb(20 40 63 / 0.12)` | Modal/panel shadows |
| `--transition` | `all 0.18s ease` | Interactive transitions |
| `--font` | `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif` | Body typography |

### Status → Color Mapping

| Status | Badge Color | Badge Text | Timeline Label |
|--------|------------|------------|----------------|
| `pending` | Amber | Pending / Report Submitted | Report Submitted |
| `accepted` | Green | Accepted / Report Received | Report Received |
| `responding` | Blue | Responding / Firetruck Dispatched | Firetruck Dispatched |
| `resolved` | Green | Resolved / Incident Resolved | Incident Resolved |
| `rejected` | Red | Rejected | Rejected |

### Data shape for UI (from backend API)

FireReport resource (JSON:API envelope):
```js
{
  type: 'fire_report',
  id: number,
  attributes: {
    incidentDescription: string,
    incidentAddress: string | null,
    latitude: number | null,
    longitude: number | null,
    locationSource: string | null, // 'device' | 'manual'
    status: 'pending' | 'accepted' | 'responding' | 'resolved' | 'rejected',
    reportedAt: string | null,
    createdAt: string,
    updatedAt: string,
  },
  relationships: {
    resident: { data: { type: 'user', id: number } },
  },
  includes?: {
    resident: { type: 'user', id: number, attributes: { name: string } },
  },
  links: { self: string },
}
```

User resource:
```js
{
  type: 'user',
  id: number,
  attributes: { name: string, email: string, role: string, createdAt: string, updatedAt: string },
}
```

### Screen Data Requirements

| Screen | Required Data | Source |
|--------|--------------|--------|
| Emergency Fire Reporting | User auth, geolocation, fire size options | Backend API + browser geolocation |
| Real-Time Response Tracking | Report details, status, assigned unit, ETA, map route | Backend API + Google Maps |
| Resident Submission History | Resident's own reports, filters | Backend API |
| Emergency Command Center | All reports, stations, trucks, map markers | Backend API + Google Maps |
| Incident Records | All reports with filters, pagination, detail panel | Backend API |
| High-Risk Location Prediction | Model output, prediction areas, availability status | Backend API (display only, no fabrication) |

## [Files]

### New files (create)

#### Design System & Styles

| Path | Purpose |
|------|---------|
| `FireAlert_Frontend/src/styles/variables.css` | CSS custom properties: navy/red/green/amber colors, radii, shadows, typography |
| `FireAlert_Frontend/src/styles/layout.css` | Page shells, navigation, grids, responsive breakpoints |
| `FireAlert_Frontend/src/styles/components.css` | Buttons, cards, badges, forms, maps, timeline, empty states |
| `FireAlert_Frontend/src/styles/resident.css` | Resident portal mobile-specific styles (bottom nav, screen containers) |
| `FireAlert_Frontend/src/styles/bfp.css` | BFP portal desktop-specific styles (three-column command center, two-column records) |

#### Resident Portal Components

| Path | Purpose |
|------|---------|
| `FireAlert_Frontend/src/components/resident/ResidentShell.jsx` | Mobile shell with header, bottom navigation, screen router |
| `FireAlert_Frontend/src/components/resident/EmergencyReportScreen.jsx` | Screen 1: Emergency fire reporting form with map pin and submit button |
| `FireAlert_Frontend/src/components/resident/ResponseTrackingScreen.jsx` | Screen 2: Real-time response tracking with timeline, map, ETA |
| `FireAlert_Frontend/src/components/resident/SubmissionHistoryScreen.jsx` | Screen 3: Report history with All/Active/Resolved filters |

#### BFP Personnel Portal Components

| Path | Purpose |
|------|---------|
| `FireAlert_Frontend/src/components/bfp/BFPShell.jsx` | Desktop shell with dark navy horizontal navigation |
| `FireAlert_Frontend/src/components/bfp/EmergencyCommandCenter.jsx` | Screen 4: Three-column layout (Alerts Feed / Map / Dispatch Panel) |
| `FireAlert_Frontend/src/components/bfp/AlertsFeed.jsx` | Left column: incoming reports list with status and actions |
| `FireAlert_Frontend/src/components/bfp/EmergencyMap.jsx` | Center column: interactive map with incident/station/truck markers and route |
| `FireAlert_Frontend/src/components/bfp/DispatchControlPanel.jsx` | Right column: selected incident details, status controls, dispatch confirmation |
| `FireAlert_Frontend/src/components/bfp/IncidentRecords.jsx` | Screen 5: Two-column layout (filters + table / detail panel) |
| `FireAlert_Frontend/src/components/bfp/IncidentRecordsTable.jsx` | Left side: search, date/status filters, paginated records table |
| `FireAlert_Frontend/src/components/bfp/IncidentDetailPanel.jsx` | Right side: selected incident details, map, response timeline |
| `FireAlert_Frontend/src/components/bfp/HighRiskPrediction.jsx` | Screen 6: High-risk location prediction display (read-only, no fabrication) |

#### Shared Components

| Path | Purpose |
|------|---------|
| `FireAlert_Frontend/src/components/shared/LoginPage.jsx` | Auth page (login/register) |
| `FireAlert_Frontend/src/components/shared/StatusBadge.jsx` | Status pill badge |
| `FireAlert_Frontend/src/components/shared/StatCard.jsx` | Single stat card |
| `FireAlert_Frontend/src/components/shared/EmptyState.jsx` | Reusable empty state component |
| `FireAlert_Frontend/src/components/shared/LoadingSpinner.jsx` | Reusable loading spinner |
| `FireAlert_Frontend/src/components/shared/TrackingTimeline.jsx` | 6-stage response progress timeline |
| `FireAlert_Frontend/src/components/shared/ReportItem.jsx` | Single report row in lists |
| `FireAlert_Frontend/src/components/shared/MapContainer.jsx` | Google Maps wrapper with markers and route polyline |

### Existing files to modify

| Path | Changes |
|------|---------|
| `FireAlert_Frontend/src/App.js` | Replace the monolithic ~1573-line file with a clean router that manages auth state and routes between `LoginPage`, `ResidentShell`, and `BFPShell`. Remove all inline component JSX and screens. |
| `FireAlert_Frontend/src/App.css` | Replace with imports to `src/styles/` files or minimal overrides. Remove all legacy "old design" styles. |
| `FireAlert_Frontend/src/index.css` | Keep base reset; add global typography aligned with design system. |
| `FireAlert_Frontend/public/index.html` | Update title/meta if needed; ensure favicon and manifest reference new branding. |

### Files to delete

| Path | Reason |
|------|--------|
| `FireAlert_Frontend/src/App.css.bak` | Legacy backup of old design styles |
| `FireAlert_Frontend/src/App.css.old` | Legacy backup of old design styles |

### Configuration updates

No configuration changes required (package.json, routes, backend unchanged).

## [Functions]

### New functions (in component files)

#### Resident Portal

| Name | File | Signature | Purpose |
|------|------|-----------|---------|
| `ResidentShell` | `components/resident/ResidentShell.jsx` | `({ user, onLogout })` | Mobile shell: header, bottom nav, screen router |
| `EmergencyReportScreen` | `components/resident/EmergencyReportScreen.jsx` | `({ onSubmit, loading })` | Screen 1: Incident description, location, map pin, fire size, red submit button |
| `ResponseTrackingScreen` | `components/resident/ResponseTrackingScreen.jsx` | `({ report })` | Screen 2: Confirmation, reference number, status, assigned unit, ETA, map, 6-stage timeline |
| `SubmissionHistoryScreen` | `components/resident/SubmissionHistoryScreen.jsx` | `({ reports, filters })` | Screen 3: My Reports with All/Active/Resolved filters, report cards, View Details |

#### BFP Personnel Portal

| Name | File | Signature | Purpose |
|------|------|-----------|---------|
| `BFPShell` | `components/bfp/BFPShell.jsx` | `({ user, onLogout })` | Desktop shell: dark navy horizontal nav, page router |
| `EmergencyCommandCenter` | `components/bfp/EmergencyCommandCenter.jsx` | `({ reports, stations, trucks })` | Screen 4: Three-column layout (Alerts Feed / Map / Dispatch Panel) |
| `AlertsFeed` | `components/bfp/AlertsFeed.jsx` | `({ reports, onSelect, loading })` | Left column: incoming reports list, reference numbers, locations, status, acknowledge actions |
| `EmergencyMap` | `components/bfp/EmergencyMap.jsx` | `({ reports, selectedReport, stations, trucks })` | Center column: large interactive map, incident/station/truck markers, suggested route, selected incident info |
| `DispatchControlPanel` | `components/bfp/DispatchControlPanel.jsx` | `({ selectedReport, onUpdateStatus, loading })` | Right column: incident details, status, station assignment, firetruck selection, response controls, dispatch confirmation, ETA |
| `IncidentRecords` | `components/bfp/IncidentRecords.jsx` | `({ reports, filters })` | Screen 5: Two-column layout (filters + table / detail panel) |
| `IncidentRecordsTable` | `components/bfp/IncidentRecordsTable.jsx` | `({ reports, onSelect, filters, pagination })` | Left side: search bar, date/status filters, records table, pagination |
| `IncidentDetailPanel` | `components/bfp/IncidentDetailPanel.jsx` | `({ report })` | Right side: incident reference, location, description, map, response timeline, actual timestamps |
| `HighRiskPrediction` | `components/bfp/HighRiskPrediction.jsx` | `({ predictions, available })` | Screen 6: High-risk locations map, model version, prediction date, risk classification, unavailable state |

#### Shared Components

| Name | File | Signature | Purpose |
|------|------|-----------|---------|
| `LoginPage` | `components/shared/LoginPage.jsx` | `({ onLogin })` | Login/register form |
| `StatusBadge` | `components/shared/StatusBadge.jsx` | `({ status })` | Status pill badge with color mapping |
| `StatCard` | `components/shared/StatCard.jsx` | `({ label, value, color, icon })` | Single stat card |
| `EmptyState` | `components/shared/EmptyState.jsx` | `({ title, description, icon, actionLabel, onAction })` | Reusable empty state |
| `LoadingSpinner` | `components/shared/LoadingSpinner.jsx` | `({ label })` | Reusable spinner |
| `TrackingTimeline` | `components/shared/TrackingTimeline.jsx` | `({ status, reportedAt })` | 6-stage: Submitted → Received → Dispatched → En Route → Arrived → Resolved |
| `ReportItem` | `components/shared/ReportItem.jsx` | `({ report, selected, onSelect })` | Single clickable report row |
| `MapContainer` | `components/shared/MapContainer.jsx` | `({ markers, route, selected, apiKey })` | Google Maps wrapper with markers and route polyline |

### Modified functions

| Name | File | Required changes |
|------|------|------------------|
| `App` | `App.js` | Rewrite as auth state provider + router. Routes: `/login` → `LoginPage`; resident role → `ResidentShell`; BFP role → `BFPShell`. Remove all inline screen JSX and sub-components. |
| `apiRequest` | `App.js` | Keep; may move to `src/utils/api.js` for shared import by components. |
| `normalizeReports` | `App.js` | Keep; move to `src/utils/normalize.js`. |
| `StatusBadge` | `App.js` | Extract to `components/shared/StatusBadge.jsx`; update colors to design system (amber/green/blue/red). |

### Removed functions

| Name | File | Migration strategy |
|------|------|-------------------|
| All inline sub-components inside `App.js` (StatCard, StatusBadge, EmptyState, LoadingSpinner, GoogleMapComponent, BFPDashboard, ResidentDashboard, LoginPage, etc.) | `App.js` | Migrated to standalone files under `src/components/` (resident/, bfp/, shared/). |
| Old dashboard screens (Incident operations with stat cards, alert feed, map panel, dispatch buttons) | `App.js` | Replaced by six new screens per design specification. |

## [Classes]

No ES6 classes are used in the frontend (functional React components only). The backend uses PHP classes which remain unchanged.

## [Dependencies]

No new dependencies. Existing dependencies remain:
- `react` ^19.3.1
- `react-dom` ^19.3.1
- `react-scripts` 5.0.1
- `@vis.gl/react-google-maps` ^1.10.1
- Testing library packages (unchanged)

## [Testing]

### Test file requirements

| Path | Purpose |
|------|---------|
| `FireAlert_Frontend/src/components/shared/__tests__/StatusBadge.test.js` | Test status badge rendering for all 5 statuses with correct colors |
| `FireAlert_Frontend/src/components/shared/__tests__/TrackingTimeline.test.js` | Test 6-stage timeline rendering (Submitted, Received, Dispatched, En Route, Arrived, Resolved) |
| `FireAlert_Frontend/src/components/resident/__tests__/EmergencyReportScreen.test.js` | Test report form validation, geolocation, submit button |
| `FireAlert_Frontend/src/components/resident/__tests__/SubmissionHistoryScreen.test.js` | Test report history filters (All/Active/Resolved) |
| `FireAlert_Frontend/src/components/bfp/__tests__/EmergencyCommandCenter.test.js` | Test three-column layout, incident selection updates map and dispatch panel |
| `FireAlert_Frontend/src/components/bfp/__tests__/IncidentRecords.test.js` | Test two-column layout, search, filters, pagination, detail panel |
| `FireAlert_Frontend/src/components/bfp/__tests__/HighRiskPrediction.test.js` | Test unavailable/pending state when no model output |

### Existing test modifications

- `FireAlert_Frontend/src/App.test.js` — Update to test new modular `App` router (auth routing, role-based shell switching).
- No backend test changes required (API unchanged).

### Validation strategy

- Run `npm test` in `FireAlert_Frontend` to ensure all component tests pass.
- Manual visual verification: resident portal on mobile widths (375px–812px), BFP portal on desktop (1024px+).
- Verify Google Maps integration loads without API errors (using existing `GOOGLE_MAPS_API_KEY` env var).
- Verify auth flow: login → redirect to correct shell based on role; logout → redirect to login.
- Verify three-column Emergency Command Center layout is preserved.
- Verify two-column Incident Records layout is preserved.
- Verify resident bottom navigation is preserved.
- Verify no fake data: predictions show unavailable state when no model output; no fabricated firetruck locations.

## [Implementation Order]

1. **Create `src/styles/variables.css`** — Design system: navy #14283F, red #D93636, green #239B70, amber #E9A23B, bg #F3F5F7, radii, shadows, typography.
2. **Create `src/styles/layout.css`** — Page shells, navigation, grids, responsive breakpoints.
3. **Create `src/styles/components.css`** — Buttons, cards, badges, forms, maps, timeline, empty states.
4. **Create `src/styles/resident.css`** — Resident mobile styles (bottom nav, screen containers).
5. **Create `src/styles/bfp.css`** — BFP desktop styles (three-column command center, two-column records).
6. **Create shared components** — StatusBadge, StatCard, EmptyState, LoadingSpinner, TrackingTimeline, ReportItem, MapContainer.
7. **Create LoginPage component** — Auth page.
8. **Create ResidentShell + three resident screens** — EmergencyReportScreen, ResponseTrackingScreen, SubmissionHistoryScreen.
9. **Create BFPShell + three BFP screens** — EmergencyCommandCenter (3-col), IncidentRecords (2-col), HighRiskPrediction.
10. **Rewrite `App.js`** — Auth provider + router; import all shells; remove monolithic inline JSX.
11. **Update `App.css`** — Replace with imports to `src/styles/`; remove all old design styles.
12. **Delete legacy files** — `App.css.bak`, `App.css.old`.
13. **Run tests** — `npm test` in frontend; verify all pass.
14. **Manual QA** — Verify six screens, responsive design, auth routing, map rendering, status workflow, three-column and two-column layouts.

The plan now reflects the complete UI/UX design specification from the MASTER UI/UX DESIGN PROMPT.