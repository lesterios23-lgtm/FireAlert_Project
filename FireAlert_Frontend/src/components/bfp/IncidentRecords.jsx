import React, { useCallback, useEffect, useMemo, useState } from 'react';
import MapContainer from '../shared/MapContainer';
import { apiRequest, normalizeReport } from '../../sharedApi';

const STATUS_LABELS = {
  pending: 'Report submitted',
  accepted: 'Report received',
  responding: 'En route',
  resolved: 'Incident resolved',
  rejected: 'Rejected',
};

function statusKey(value) {
  switch (String(value || '').toLowerCase()) {
    case 'submitted':
    case 'pending':
      return 'pending';
    case 'received':
    case 'dispatched':
    case 'accepted':
      return 'accepted';
    case 'en route':
    case 'arrived':
    case 'responding':
      return 'responding';
    case 'resolved':
      return 'resolved';
    case 'rejected':
      return 'rejected';
    default:
      return String(value || '').toLowerCase();
  }
}

function formatDate(value, options = {}) {
  if (!value) return 'Unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unavailable' : date.toLocaleString(undefined, options);
}

export default function IncidentRecords({ onOpenCommand }) {
  const [reports, setReports] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [savingRecord, setSavingRecord] = useState(false);
  const [recordForm, setRecordForm] = useState({
    damage_assessment: '',
    casualties_count: '0',
    resolution_summary: '',
  });
  const [error, setError] = useState('');

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await apiRequest('/command-center');
      const nextReports = Array.isArray(payload?.data?.reports)
        ? payload.data.reports.map((report) => ({
          ...normalizeReport(report),
          incidentRecord: report.incidentRecord || null,
        }))
        : [];
      setStatuses(Array.isArray(payload?.data?.statuses) ? payload.data.statuses : []);
      setReports(nextReports);
      setSelectedId((currentId) => (
        nextReports.some((report) => String(report.id) === String(currentId))
          ? currentId
          : nextReports[0]?.id ?? null
      ));
    } catch (requestError) {
      setError(requestError.message || 'Unable to load incident records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const filteredReports = useMemo(() => reports.filter((report) => {
    const text = `${report.id} ${report.incidentAddress || ''} ${report.incidentDescription || ''} ${report.residentName || ''}`.toLowerCase();
    return text.includes(search.toLowerCase())
      && (statusFilter === 'all' || report.status === statusFilter);
  }), [reports, search, statusFilter]);
  const availableStatuses = useMemo(() => {
    const seen = new Set();
    return statuses
      .map((item) => ({ value: statusKey(item.status_name), name: item.status_name }))
      .filter((item) => {
        if (!item.value || !STATUS_LABELS[item.value] || seen.has(item.value)) return false;
        seen.add(item.value);
        return true;
      });
  }, [statuses]);

  const selectedReport = filteredReports.find((report) => String(report.id) === String(selectedId))
    || filteredReports[0]
    || null;

  useEffect(() => {
    setRecordForm({
      damage_assessment: selectedReport?.incidentRecord?.damage_assessment || '',
      casualties_count: String(selectedReport?.incidentRecord?.casualties_count ?? 0),
      resolution_summary: selectedReport?.incidentRecord?.resolution_summary || '',
    });
  }, [
    selectedReport?.id,
    selectedReport?.incidentRecord?.damage_assessment,
    selectedReport?.incidentRecord?.casualties_count,
    selectedReport?.incidentRecord?.resolution_summary,
  ]);

  const saveIncidentRecord = async (event) => {
    event.preventDefault();
    if (!selectedReport) return;

    setSavingRecord(true);
    setError('');
    try {
      await apiRequest(`/reports/${selectedReport.id}/incident-record`, {
        method: 'PUT',
        body: JSON.stringify({
          damage_assessment: recordForm.damage_assessment,
          casualties_count: Number(recordForm.casualties_count),
          resolution_summary: recordForm.resolution_summary,
        }),
      });
      await loadReports();
    } catch (requestError) {
      setError(requestError.message || 'Unable to save the incident record.');
    } finally {
      setSavingRecord(false);
    }
  };

  const markers = selectedReport?.latitude != null && selectedReport?.longitude != null
    ? [{ id: selectedReport.id, lat: selectedReport.latitude, lng: selectedReport.longitude }]
    : [];

  return (
    <div className='bfp-page'>
      <div className='bfp-page-heading'>
        <div>
          <p className='bfp-eyebrow'>BFP Mansalay</p>
          <h1>Incident Records</h1>
          <p>Search reports and review submitted incident details.</p>
        </div>
        <span className='bfp-restricted-label'>♧ Authorized BFP access only</span>
      </div>

      {error && <div className='bfp-error' role='alert'>{error}</div>}

      <div className='bfp-records-grid'>
        <section className='bfp-panel records-panel'>
          <div className='bfp-record-filters'>
            <label className='bfp-search'>
              <span aria-hidden='true'>⌕</span>
              <input
                type='search'
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder='Search incident reference, location, or details'
                aria-label='Search incident records'
              />
            </label>
            <label className='bfp-filter-select'>
              <span>Status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                {[{ value: 'all', name: 'All statuses' }, ...availableStatuses].map(({ value, name }) => (
                  <option value={value} key={value}>
                    {value === 'all' ? name : STATUS_LABELS[value] || name}
                  </option>
                ))}
              </select>
            </label>
            <button type='button' className='bfp-text-button' onClick={() => { setSearch(''); setStatusFilter('all'); }}>
              Reset filters
            </button>
          </div>

          <div className='bfp-table-heading'>
            <div>
              <h2>Reported incidents</h2>
              <span>{filteredReports.length} records</span>
            </div>
            <button type='button' className='bfp-icon-button' onClick={loadReports} aria-label='Refresh incident records'>↻</button>
          </div>

          <div className='bfp-table-wrap'>
            <table className='bfp-record-table'>
              <thead>
                <tr>
                  <th>Incident ref.</th>
                  <th>Location</th>
                  <th>Submitted</th>
                  <th>Response status</th>
                  <th aria-label='Open incident details' />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan='5' className='bfp-table-empty'>Loading incident records…</td></tr>
                ) : filteredReports.length === 0 ? (
                  <tr><td colSpan='5' className='bfp-table-empty'>No reports match your search.</td></tr>
                ) : filteredReports.map((report) => (
                  <tr
                    key={report.id}
                    className={String(report.id) === String(selectedReport?.id) ? 'selected' : ''}
                    onClick={() => setSelectedId(report.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') setSelectedId(report.id);
                    }}
                    tabIndex={0}
                  >
                    <td className='reference-id'>FA-{String(report.id).padStart(6, '0')}</td>
                    <td>
                      <strong>{report.incidentAddress || 'Location unavailable'}</strong>
                      <small>{report.residentName || 'Resident details unavailable'}</small>
                    </td>
                    <td>{formatDate(report.reportedAt || report.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}</td>
                    <td>
                      <span className={`bfp-status-badge status-${report.status || 'pending'}`}>
                        <i /> {STATUS_LABELS[report.status] || report.status || 'Unknown'}
                      </span>
                    </td>
                    <td className='table-arrow'>›</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className='bfp-table-footnote'>
            <span>Resident details and location data are visible to authorized personnel only.</span>
            <span>Showing {filteredReports.length} loaded report{filteredReports.length === 1 ? '' : 's'}</span>
          </div>
        </section>

        <aside className='bfp-panel record-detail-panel'>
          {selectedReport ? (
            <>
              <div className='detail-heading'>
                <div>
                  <p className='bfp-eyebrow'>Selected record</p>
                  <h2>FA-{String(selectedReport.id).padStart(6, '0')}</h2>
                  <p>{selectedReport.incidentAddress || 'Location unavailable'}</p>
                </div>
                <span className={`bfp-status-badge status-${selectedReport.status || 'pending'}`}>
                  <i /> {STATUS_LABELS[selectedReport.status] || selectedReport.status || 'Unknown'}
                </span>
              </div>

              <MapContainer
                markers={markers}
                selected={selectedReport}
                height='205px'
              />

              <div className='bfp-map-route-note'>Location coordinates supplied with the report</div>

              <section className='detail-info'>
                <h3>Incident information</h3>
                <p>{selectedReport.incidentDescription || 'No incident description provided.'}</p>
                <div className='detail-info-pair'><span>Submitted</span><strong>{formatDate(selectedReport.reportedAt || selectedReport.createdAt)}</strong></div>
                <div className='detail-info-pair'><span>Reported by</span><strong>{selectedReport.residentName || 'Unavailable'}</strong></div>
                <div className='detail-info-pair'><span>Location source</span><strong>{selectedReport.locationSource || 'Unavailable'}</strong></div>
              </section>

              <form className='bfp-incident-record-form' onSubmit={saveIncidentRecord}>
                <h3>Incident record</h3>
                <label htmlFor='record-damage'>Damage assessment</label>
                <textarea
                  id='record-damage'
                  rows='3'
                  maxLength='5000'
                  value={recordForm.damage_assessment}
                  onChange={(event) => setRecordForm((current) => ({ ...current, damage_assessment: event.target.value }))}
                />
                <label htmlFor='record-casualties'>Casualties count</label>
                <input
                  id='record-casualties'
                  type='number'
                  min='0'
                  value={recordForm.casualties_count}
                  onChange={(event) => setRecordForm((current) => ({ ...current, casualties_count: event.target.value }))}
                  required
                />
                <label htmlFor='record-resolution'>Resolution summary</label>
                <textarea
                  id='record-resolution'
                  rows='3'
                  maxLength='5000'
                  value={recordForm.resolution_summary}
                  onChange={(event) => setRecordForm((current) => ({ ...current, resolution_summary: event.target.value }))}
                />
                {selectedReport.incidentRecord?.archived_at && (
                  <p className='bfp-record-archived'>Archived {formatDate(selectedReport.incidentRecord.archived_at)}</p>
                )}
                <button className='bfp-primary-button' type='submit' disabled={savingRecord}>
                  {savingRecord ? 'Saving record…' : 'Save incident record'}
                </button>
              </form>

              {onOpenCommand && (
                <button type='button' className='bfp-primary-button' onClick={onOpenCommand}>
                  Open in Command Center
                </button>
              )}
            </>
          ) : (
            <div className='bfp-no-selection'>
              <span aria-hidden='true'>▤</span>
              <h2>{loading ? 'Loading records…' : 'No incident selected'}</h2>
              <p>Select a row to inspect the incident details.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
