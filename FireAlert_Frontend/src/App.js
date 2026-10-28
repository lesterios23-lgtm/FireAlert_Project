import { useMemo, useState } from 'react';
import './App.css';

const INITIAL_INCIDENTS = [
  {
    id: 'DEMO-001',
    location: 'Sample market area',
    area: 'Illustrative barangay',
    description: 'Sample report for layout review. This is not a real emergency.',
    status: 'pending',
    received: 'Demo entry',
    unit: 'Unassigned',
  },
  {
    id: 'DEMO-002',
    location: 'Sample residential area',
    area: 'Illustrative barangay',
    description: 'Fictional report showing an accepted status.',
    status: 'accepted',
    received: 'Demo entry',
    unit: 'Unassigned',
  },
  {
    id: 'DEMO-003',
    location: 'Sample roadside area',
    area: 'Illustrative barangay',
    description: 'Fictional report showing a response status.',
    status: 'responding',
    received: 'Demo entry',
    unit: 'Demo unit 01',
  },
  {
    id: 'DEMO-004',
    location: 'Sample storage area',
    area: 'Illustrative barangay',
    description: 'Fictional report showing a resolved status.',
    status: 'resolved',
    received: 'Demo entry',
    unit: 'Demo unit 02',
  },
  {
    id: 'DEMO-005',
    location: 'Sample roadside shop',
    area: 'Illustrative barangay',
    description: 'Fictional report included to demonstrate filtering.',
    status: 'rejected',
    received: 'Demo entry',
    unit: 'Unassigned',
  },
];

const STATUSES = ['pending', 'accepted', 'rejected', 'responding', 'resolved'];

const STATUS_LABELS = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
  responding: 'Responding',
  resolved: 'Resolved',
};

const NAV_ITEMS = [
  { id: 'command', label: 'Command Center', icon: 'CC' },
  { id: 'reports', label: 'Reports', icon: 'RP' },
  { id: 'records', label: 'Incident Records', icon: 'IR' },
  { id: 'map', label: 'Incident Map', icon: 'MP' },
  { id: 'predictions', label: 'Predictions', icon: 'PR' },
];

function StatusBadge({ status }) {
  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-dot" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      F
    </span>
  );
}

function DemoBanner() {
  return (
    <div className="demo-banner" role="note">
      <strong>Illustrative preview</strong>
      <span>
        All entries are fictional. This page is not connected to BFP records or
        live services.
      </span>
    </div>
  );
}

function MapPreview({ compact = false }) {
  return (
    <div
      className={`coverage-field${compact ? ' coverage-field-compact' : ''}`}
      role="img"
      aria-label="Illustrative coverage visualization; no live map or incident coordinates are shown"
    >
      <div className="field-grid" />
      <div className="field-cross field-cross-horizontal" />
      <div className="field-cross field-cross-vertical" />
      <div className="field-ring field-ring-outer" />
      <div className="field-ring field-ring-middle" />
      <div className="field-ring field-ring-inner" />
      <div className="field-sweep" />
      <span className="field-node field-node-base" aria-hidden="true">B</span>
      <span className="field-node field-node-report" aria-hidden="true">!</span>
      <span className="field-label field-label-base">DEMO BASE</span>
      <span className="field-label field-label-zone">SAMPLE ZONE</span>
      <span className="field-coordinate">COORDINATES UNAVAILABLE</span>
      <span className="field-caption">
        Illustrative coverage view - not live GPS or map data
      </span>
    </div>
  );
}

function SummaryCounts({ incidents }) {
  const counts = useMemo(
    () =>
      STATUSES.map((status) => ({
        status,
        count: incidents.filter((incident) => incident.status === status).length,
      })),
    [incidents],
  );

  return (
    <section className="summary-counts" aria-label="Illustrative report counts by status">
      {counts.map(({ status, count }) => (
        <div className={`summary-card summary-${status}`} key={status}>
          <span className={`summary-indicator indicator-${status}`} />
          <span className="summary-label">{STATUS_LABELS[status]}</span>
          <strong>{count}</strong>
        </div>
      ))}
    </section>
  );
}

function CommandCenter({
  incidents,
  selectedIncident,
  onSelectIncident,
  onUpdateStatus,
  onOpenReports,
  notice,
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">BFP Mansalay</p>
          <h1>Incident operations</h1>
          <p className="page-subtitle">
            Review incoming reports and coordinate response activity.
          </p>
        </div>
        <div className="connection-state">
          <span className="connection-dot" />
          Preview only - not connected
        </div>
      </div>

      <SummaryCounts incidents={incidents} />

      <div className="command-grid">
        <section className="panel alert-panel">
          <div className="panel-heading">
            <div>
              <h2>Illustrative report feed</h2>
              <p>Fictional entries for interface review</p>
            </div>
            <button className="icon-button" type="button" aria-label="Refresh preview">
              ↻
            </button>
          </div>
          <div className="alert-list">
            {incidents.slice(0, 4).map((incident) => (
              <button
                className={`alert-item${selectedIncident.id === incident.id ? ' is-selected' : ''}`}
                key={incident.id}
                onClick={() => onSelectIncident(incident.id)}
                type="button"
              >
                <span className="alert-item-top">
                  <span className="reference-code">{incident.id}</span>
                  <span className="demo-time">{incident.received}</span>
                </span>
                <strong>{incident.location}</strong>
                <span className="alert-area">{incident.area}</span>
                <StatusBadge status={incident.status} />
              </button>
            ))}
          </div>
          <button className="button button-secondary button-full" onClick={onOpenReports} type="button">
            View all illustrative reports
          </button>
          <p className="panel-footnote">
            Do not use this preview to assess or respond to an emergency.
          </p>
        </section>

        <section className="panel incident-panel">
          <div className="panel-heading incident-heading">
            <div>
              <p className="eyebrow">Selected demo entry</p>
              <h2>{selectedIncident.location}</h2>
              <p>{selectedIncident.area}</p>
            </div>
            <StatusBadge status={selectedIncident.status} />
          </div>

          <MapPreview />

          <div className="incident-meta-grid">
            <div>
              <span>Reference</span>
              <strong>{selectedIncident.id}</strong>
            </div>
            <div>
              <span>Location source</span>
              <strong>Not available in preview</strong>
            </div>
            <div>
              <span>Received</span>
              <strong>{selectedIncident.received}</strong>
            </div>
          </div>

          <div className="description-block">
            <h3>Illustrative report details</h3>
            <p>{selectedIncident.description}</p>
          </div>

          <div className="timeline-section">
            <div className="panel-heading">
              <div>
                <h3>Response progress</h3>
                <p>Example status sequence - not an event history</p>
              </div>
            </div>
            <ol className="timeline">
              {['Report submitted', 'Report reviewed', 'Response update', 'Resolved'].map(
                (step, index) => (
                  <li
                    className={index === 0 || selectedIncident.status === 'resolved' ? 'is-complete' : ''}
                    key={step}
                  >
                    <span className="timeline-marker" />
                    <span>{step}</span>
                    <span className="timeline-time">Demo</span>
                  </li>
                ),
              )}
            </ol>
          </div>
        </section>

        <section className="panel dispatch-panel">
          <div className="panel-heading">
            <div>
              <h2>Response controls</h2>
              <p>Local preview only - changes are not saved</p>
            </div>
          </div>

          <div className="preview-notice">
            <strong>No live dispatch</strong>
            <span>Vehicle assignment and status changes are not connected to BFP.</span>
          </div>

          <label className="field-label" htmlFor="demo-unit">
            Demo unit identifier
          </label>
          <input
            className="text-input"
            id="demo-unit"
            onChange={(event) => onUpdateStatus(selectedIncident.id, 'unit', event.target.value)}
            placeholder="Not assigned"
            value={selectedIncident.unit}
          />

          <label className="field-label" htmlFor="demo-status">
            Local status preview
          </label>
          <select
            className="text-input"
            id="demo-status"
            onChange={(event) => onUpdateStatus(selectedIncident.id, 'status', event.target.value)}
            value={selectedIncident.status}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>

          {notice && (
            <p className="inline-notice" role="status">
              {notice}
            </p>
          )}

          <div className="later-phase-card">
            <strong>Routes and ETA</strong>
            <p>Later phase. No route or travel-time estimate is available in this preview.</p>
          </div>
          <div className="later-phase-card muted-card">
            <strong>Google Maps</strong>
            <p>Requires approved API configuration and live service integration.</p>
          </div>
        </section>
      </div>
    </>
  );
}

function ReportTable({ incidents, onSelectIncident, search, onSearch, status, onStatus }) {
  const filteredIncidents = incidents.filter((incident) => {
    const matchesSearch = `${incident.id} ${incident.location} ${incident.area}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesStatus = status === 'all' || incident.status === status;
    return matchesSearch && matchesStatus;
  });

  return (
    <section className="panel table-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Illustrative data</p>
          <h2>Reports</h2>
          <p>Search and filter fictional entries; results are not live incidents.</p>
        </div>
      </div>
      <div className="table-filters">
        <label className="search-field">
          <span className="visually-hidden">Search reports</span>
          <span aria-hidden="true">⌕</span>
          <input
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search reference or location"
            value={search}
          />
        </label>
        <label>
          <span className="visually-hidden">Filter by status</span>
          <select onChange={(event) => onStatus(event.target.value)} value={status}>
            <option value="all">All statuses</option>
            {STATUSES.map((item) => (
              <option key={item} value={item}>
                {STATUS_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Reference</th>
              <th scope="col">Location</th>
              <th scope="col">Received</th>
              <th scope="col">Status</th>
              <th scope="col">Assigned unit</th>
              <th scope="col">
                <span className="visually-hidden">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredIncidents.map((incident) => (
              <tr key={incident.id}>
                <td>
                  <strong className="reference-code">{incident.id}</strong>
                  <span className="table-subtext">Fictional demo</span>
                </td>
                <td>
                  <strong>{incident.location}</strong>
                  <span className="table-subtext">{incident.area}</span>
                </td>
                <td>{incident.received}</td>
                <td>
                  <StatusBadge status={incident.status} />
                </td>
                <td>{incident.unit}</td>
                <td>
                  <button
                    aria-label={`Open ${incident.id}`}
                    className="table-open-button"
                    onClick={() => onSelectIncident(incident.id)}
                    type="button"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
            {filteredIncidents.length === 0 && (
              <tr>
                <td className="empty-table" colSpan="6">
                  No illustrative entries match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="panel-footnote">
        This interface preview does not fetch, save, or modify report records.
      </p>
    </section>
  );
}

function PageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-subtitle">{description}</p>
      </div>
      {action}
    </div>
  );
}

function IncidentRecords({ incidents, onSelectIncident, search, onSearch, onOpenCommand }) {
  return (
    <>
      <PageHeader
        description="Review fictional sample records and interface states."
        eyebrow="BFP Mansalay"
        title="Incident Records"
        action={
          <button className="button button-primary" disabled type="button">
            New record - later phase
          </button>
        }
      />
      <div className="record-layout">
        <div>
          <label className="search-field record-search">
            <span aria-hidden="true">⌕</span>
            <span className="visually-hidden">Search incident records</span>
            <input
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search reference or location"
              value={search}
            />
          </label>
          <div className="panel table-panel">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Incident reference</th>
                    <th scope="col">Location</th>
                    <th scope="col">Response status</th>
                    <th scope="col">Unit</th>
                    <th scope="col">
                      <span className="visually-hidden">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {incidents
                    .filter((incident) =>
                      `${incident.id} ${incident.location} ${incident.area}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .map((incident) => (
                      <tr key={incident.id}>
                        <td>
                          <strong className="reference-code">{incident.id}</strong>
                          <span className="table-subtext">Illustrative record</span>
                        </td>
                        <td>
                          <strong>{incident.location}</strong>
                          <span className="table-subtext">{incident.area}</span>
                        </td>
                        <td>
                          <StatusBadge status={incident.status} />
                        </td>
                        <td>{incident.unit}</td>
                        <td>
                          <button
                            aria-label={`Open ${incident.id}`}
                            className="table-open-button"
                            onClick={() => {
                              onSelectIncident(incident.id);
                              onOpenCommand();
                            }}
                            type="button"
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <p className="panel-footnote">
              Incident record creation, editing, and live search require a connected API.
            </p>
          </div>
        </div>
        <aside className="panel record-detail">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Data protection</p>
              <h2>Restricted BFP workspace</h2>
            </div>
            <span className="lock-mark" aria-hidden="true">LOCK</span>
          </div>
          <p>
            This page uses fictional examples only. Real resident identity and incident
            locations must be provided by the authorized backend.
          </p>
          <div className="later-phase-card">
            <strong>Search and filters</strong>
            <p>Only local preview search is available; no server records are queried.</p>
          </div>
          <div className="later-phase-card muted-card">
            <strong>Status history</strong>
            <p>Real status events will be shown after the API contract is implemented.</p>
          </div>
        </aside>
      </div>
    </>
  );
}

function IncidentMap({ incidents }) {
  return (
    <>
      <PageHeader
        description="Location display is a visual placeholder; no real coordinates are loaded."
        eyebrow="BFP Mansalay"
        title="Coverage view"
      />
      <section className="panel map-page-panel">
        <div className="panel-heading">
          <div>
            <h2>Coverage field</h2>
            <p>The graphic is symbolic and does not plot actual incidents or locations.</p>
          </div>
          <span className="phase-label">Google Maps integration - later phase</span>
        </div>
        <MapPreview />
        <div className="map-legend" aria-label="Illustrative map legend">
          <span><i className="legend-dot legend-incident" /> Demo report signal</span>
          <span><i className="legend-dot legend-station" /> Demo base</span>
        </div>
        <div className="map-entry-list">
          {incidents.slice(0, 3).map((incident) => (
            <div className="map-entry" key={incident.id}>
              <span className="map-entry-icon" aria-hidden="true">!</span>
              <span>
                <strong>{incident.location}</strong>
                <small>{incident.id} - fictional entry</small>
              </span>
              <StatusBadge status={incident.status} />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Predictions() {
  return (
    <>
      <PageHeader
        description="Predictions are advisory only and are not used to dispatch or prioritize responses."
        eyebrow="Research feature"
        title="High-risk location predictions"
      />
      <section className="panel prediction-panel">
        <div className="prediction-icon" aria-hidden="true">!</div>
        <p className="eyebrow">Model status</p>
        <h2>Not yet validated - no historical data loaded</h2>
        <p>
          No prediction is available. This system has no approved historical dataset,
          defined prediction target, or validated model connected to this preview.
        </p>
        <div className="prediction-callout">
          <strong>Advisory only</strong>
          <span>
            No risk scores, accuracy figures, or automatic dispatch actions are shown.
          </span>
        </div>
      </section>
    </>
  );
}

function LoginPreview() {
  return (
    <main className="login-page">
      <section className="panel login-panel">
        <BrandMark />
        <p className="eyebrow">Mansalay response workspace</p>
        <h1>Sign in to FireAlert</h1>
        <p className="page-subtitle">
          Authorized BFP personnel access only. Authentication is not connected in this
          interface preview.
        </p>
        <label className="field-label" htmlFor="email">Email address</label>
        <input autoComplete="username" className="text-input" id="email" type="email" />
        <label className="field-label" htmlFor="password">Password</label>
        <input autoComplete="current-password" className="text-input" id="password" type="password" />
        <button className="button button-primary button-full" disabled type="button">
          Sign in - backend required
        </button>
        <p className="panel-footnote">
          This preview does not authenticate users or grant access to restricted records.
        </p>
      </section>
    </main>
  );
}

function App() {
  const [page, setPage] = useState('command');
  const [incidents, setIncidents] = useState(INITIAL_INCIDENTS);
  const [selectedId, setSelectedId] = useState(INITIAL_INCIDENTS[0].id);
  const [notice, setNotice] = useState('');
  const [reportSearch, setReportSearch] = useState('');
  const [recordSearch, setRecordSearch] = useState('');
  const [reportStatus, setReportStatus] = useState('all');

  const selectedIncident =
    incidents.find((incident) => incident.id === selectedId) || incidents[0];

  function updateIncident(id, field, value) {
    setIncidents((current) =>
      current.map((incident) =>
        incident.id === id ? { ...incident, [field]: value } : incident,
      ),
    );
    setNotice('Changed locally for preview only. Nothing was sent or saved.');
  }

  function selectIncident(id) {
    setSelectedId(id);
    setNotice('');
  }

  if (page === 'login') {
    return (
      <>
        <DemoBanner />
        <LoginPreview />
      </>
    );
  }

  return (
    <div className="app-shell">
      <DemoBanner />
      <header className="topbar">
        <a
          aria-label="FireAlert Command Center"
          className="brand"
          href="#command"
          onClick={(event) => {
            event.preventDefault();
            setPage('command');
          }}
        >
          <BrandMark />
          <span className="brand-name">
            FireAlert
            <small>FIELD OPERATIONS / MANSALAY</small>
          </span>
        </a>
        <nav aria-label="Main navigation" className="main-nav">
          {NAV_ITEMS.map((item) => (
            <button
              aria-current={page === item.id ? 'page' : undefined}
              className={`nav-item${page === item.id ? ' is-active' : ''}`}
              key={item.id}
              onClick={() => {
                setPage(item.id);
                setNotice('');
              }}
              type="button"
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="topbar-user">
          <span className="user-initials" aria-hidden="true">BFP</span>
          <span className="user-caption">Preview mode</span>
          <button className="topbar-login" onClick={() => setPage('login')} type="button">
            Sign in
          </button>
        </div>
      </header>

      <main className="main-content">
        {page === 'command' && (
          <CommandCenter
            incidents={incidents}
            notice={notice}
            onOpenReports={() => setPage('reports')}
            onSelectIncident={selectIncident}
            onUpdateStatus={updateIncident}
            selectedIncident={selectedIncident}
          />
        )}
        {page === 'reports' && (
          <>
            <PageHeader
              description="Search and review fictional entries. This page is not connected to live reports."
              eyebrow="BFP Mansalay"
              title="Incoming Reports"
            />
            <ReportTable
              incidents={incidents}
              onSearch={setReportSearch}
              onSelectIncident={(id) => {
                selectIncident(id);
                setPage('command');
              }}
              onStatus={setReportStatus}
              search={reportSearch}
              status={reportStatus}
            />
          </>
        )}
        {page === 'records' && (
          <IncidentRecords
            incidents={incidents}
            onOpenCommand={() => setPage('command')}
            onSearch={setRecordSearch}
            onSelectIncident={selectIncident}
            search={recordSearch}
          />
        )}
        {page === 'map' && <IncidentMap incidents={incidents} />}
        {page === 'predictions' && <Predictions />}
      </main>

      <footer className="app-footer">
        <span>FireAlert interface preview</span>
        <span>Fictional content - not for operational use</span>
      </footer>
    </div>
  );
}

export default App;
