import React, { useCallback, useEffect, useState } from 'react';
import TrackingTimeline from '../shared/TrackingTimeline';
import MapContainer from '../shared/MapContainer';
import { apiRequest, normalizeReport, normalizeReports } from '../../sharedApi';

const STATUS_LABELS = {
  pending: 'Report submitted',
  accepted: 'Report received',
  responding: 'En route',
  resolved: 'Incident resolved',
  rejected: 'Report rejected',
};

function formatDate(value) {
  if (!value) return 'Unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unavailable' : date.toLocaleString();
}

export default function ResponseTrackingScreen({ report }) {
  const [trackingReport, setTrackingReport] = useState(report || null);
  const [error, setError] = useState('');

  useEffect(() => {
    setTrackingReport(report || null);
    setError('');
  }, [report]);

  const refreshReport = useCallback(async () => {
    try {
      if (report?.id) {
        const payload = await apiRequest(`/reports/${report.id}`);
        setTrackingReport(normalizeReport(payload));
        return;
      }

      const payload = await apiRequest('/reports?sort=-reportedAt');
      const reports = normalizeReports(payload);
      setTrackingReport(reports.find((item) => !['resolved', 'rejected'].includes(item.status)) || reports[0] || null);
    } catch (requestError) {
      setError(requestError.message || 'Unable to refresh your response status.');
    }
  }, [report]);

  useEffect(() => {
    refreshReport();
    const timer = window.setInterval(refreshReport, 30000);
    return () => window.clearInterval(timer);
  }, [refreshReport]);

  if (!trackingReport) {
    return (
      <div className='resident-page'>
        <div className='resident-page-heading'>
          <div><p className='resident-eyebrow'>Response tracking</p><h1>Your emergency report</h1></div>
        </div>
        {error && <div className='resident-form-error' role='alert'>{error}</div>}
        <div className='resident-empty-card'>
          <span aria-hidden='true'>⌖</span>
          <h2>No active report</h2>
          <p>Submit a fire emergency report to follow its response status here.</p>
        </div>
      </div>
    );
  }

  const markers = trackingReport.latitude != null && trackingReport.longitude != null
    ? [{ id: trackingReport.id, lat: trackingReport.latitude, lng: trackingReport.longitude }]
    : [];
  const submittedAt = trackingReport.reportedAt || trackingReport.createdAt;

  return (
    <div className='resident-page'>
      <div className='resident-page-heading'>
        <div>
          <p className='resident-eyebrow'>Response tracking · FA-{String(trackingReport.id).padStart(6, '0')}</p>
          <h1>Your emergency report</h1>
        </div>
        <span className={`resident-status status-${trackingReport.status || 'pending'}`}>
          {STATUS_LABELS[trackingReport.status] || trackingReport.status}
        </span>
      </div>

      <div className='resident-success-banner'>
        <span aria-hidden='true'>✓</span>
        <div><strong>Report submitted successfully</strong><small>Received {formatDate(submittedAt)}</small></div>
      </div>

      <section className='resident-response-card'>
        <div>
          <span className='resident-card-kicker'>INCIDENT LOCATION</span>
          <h2>{trackingReport.incidentAddress || 'Location unavailable'}</h2>
          <p>{trackingReport.incidentDescription || 'No description provided.'}</p>
        </div>
        <div className='resident-response-unit'>
          <span aria-hidden='true'>♧</span>
          <div><strong>{trackingReport.status === 'responding' ? 'Response en route' : 'Awaiting BFP response'}</strong><small>Unit assignment and ETA are not available in the report service.</small></div>
          <b>{trackingReport.status === 'responding' ? 'En route' : '—'}</b>
        </div>
      </section>

      <section className='resident-track-section'>
        <div className='resident-section-heading'><div><h2>Incident location</h2><p>The pin is shown when coordinates were included in the report.</p></div></div>
        <MapContainer
          markers={markers}
          selected={trackingReport}
          height='210px'
        />
      </section>

      <section className='resident-track-section'>
        <div className='resident-section-heading'>
          <div><h2>Response progress</h2><p>Updated when BFP personnel change your report status.</p></div>
          <button type='button' className='resident-refresh-button' onClick={refreshReport}>Refresh</button>
        </div>
        {error && <div className='resident-form-error' role='alert'>{error}</div>}
        <TrackingTimeline status={trackingReport.status} reportedAt={submittedAt} />
      </section>

      <div className='resident-callout'>
        <strong>Stay clear of the incident area</strong>
        <p>Keep access roads open for responders. For immediate help or a new connection issue, contact local emergency services.</p>
      </div>
    </div>
  );
}
