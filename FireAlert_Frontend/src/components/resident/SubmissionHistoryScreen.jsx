import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest, normalizeReports } from '../../sharedApi';

const isResolved = (report) => ['resolved', 'rejected'].includes(report.status);

function formatDate(value) {
  if (!value) return 'Time unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString();
}

export default function SubmissionHistoryScreen({ onViewReport, onReportNew, user }) {
  const [reports, setReports] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await apiRequest('/reports?sort=-reportedAt');
      setReports(normalizeReports(payload));
    } catch (requestError) {
      setError(requestError.message || 'Unable to load your reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const counts = useMemo(() => ({
    all: reports.length,
    active: reports.filter((report) => !isResolved(report)).length,
    resolved: reports.filter(isResolved).length,
  }), [reports]);

  const filteredReports = reports.filter((report) => (
    filter === 'all' || (filter === 'resolved' ? isResolved(report) : !isResolved(report))
  ));

  return (
    <div className='resident-page'>
      <div className='resident-page-heading'>
        <div>
          <p className='resident-eyebrow'>Private report history</p>
          <h1>My reports</h1>
          <p>{user?.name || 'Resident'} · Mansalay</p>
        </div>
        <button type='button' className='resident-refresh-button' onClick={loadReports}>Refresh</button>
      </div>

      <div className='resident-privacy-banner'>
        <span aria-hidden='true'>▣</span>
        <p>Only your reports appear here. Other residents cannot see your identity, location, or report history.</p>
      </div>

      <div className='resident-filter-tabs' role='tablist' aria-label='Filter reports'>
        {[
          { key: 'all', label: 'All reports' },
          { key: 'active', label: 'Active' },
          { key: 'resolved', label: 'Resolved' },
        ].map((item) => (
          <button
            type='button'
            role='tab'
            aria-selected={filter === item.key}
            className={filter === item.key ? 'active' : ''}
            key={item.key}
            onClick={() => setFilter(item.key)}
          >
            {item.label} <span>{counts[item.key]}</span>
          </button>
        ))}
      </div>

      {error && <div className='resident-form-error' role='alert'>{error}</div>}

      <div className='resident-history-list'>
        {loading ? (
          <p className='resident-empty-state'>Loading your reports…</p>
        ) : filteredReports.length === 0 ? (
          <p className='resident-empty-state'>
            {filter === 'all' ? 'You have not submitted any reports yet.' : `No ${filter} reports.`}
          </p>
        ) : filteredReports.map((report) => (
          <article className='resident-history-card' key={report.id}>
            <div className='resident-history-card-heading'>
              <span>FA-{String(report.id).padStart(6, '0')} · {formatDate(report.reportedAt || report.createdAt)}</span>
              <span className={`resident-status status-${report.status || 'pending'}`}>
                {report.status === 'resolved' ? 'Incident resolved' : report.status === 'responding' ? 'En route' : report.status === 'accepted' ? 'Report received' : report.status === 'rejected' ? 'Rejected' : 'Report submitted'}
              </span>
            </div>
            <h2>{report.incidentAddress || 'Location unavailable'}</h2>
            <p>{report.incidentDescription || 'No description provided.'}</p>
            <button type='button' className='resident-card-link' onClick={() => onViewReport(report)}>
              {isResolved(report) ? 'Review report and response' : 'Track response'}
              <span aria-hidden='true'>→</span>
            </button>
          </article>
        ))}
      </div>

      <button type='button' className='resident-submit-button resident-new-report-button' onClick={onReportNew}>
        Report a new fire
      </button>
      <p className='resident-privacy-note'>Your records are private and available only to you and authorized BFP personnel.</p>
    </div>
  );
}
