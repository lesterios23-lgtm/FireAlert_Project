import React, { useCallback, useEffect, useState } from 'react';
import TrackingTimeline from '../shared/TrackingTimeline';
import RouteNavigationMap from '../shared/RouteNavigationMap';
import { apiRequest, normalizeReport, normalizeReports } from '../../sharedApi';
import { SkeletonTrackingScreen } from './SkeletonLoaders';

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
  const [loading, setLoading] = useState(!report);

  useEffect(() => {
    setTrackingReport(report || null);
    setError('');
  }, [report]);

  const refreshReport = useCallback(async () => {
    setLoading(true);
    try {
      if (report?.id) {
        const payload = await apiRequest(`/reports/${report.id}`);
        setTrackingReport(normalizeReport(payload));
        return;
      }

      const payload = await apiRequest('/reports?sort=-reportedAt');
      const reports = normalizeReports(payload);
      const active = reports.find((item) => !['resolved', 'rejected'].includes(item.status)) || reports[0] || null;
      if (active?.id) {
        const detail = await apiRequest(`/reports/${active.id}`);
        setTrackingReport(normalizeReport(detail));
        return;
      }
      setTrackingReport(active);
    } catch (requestError) {
      setError(requestError.message || 'Unable to refresh your response status.');
    } finally {
      setLoading(false);
    }
  }, [report]);

  useEffect(() => {
    refreshReport();
    const intervalMs = trackingReport?.status === 'responding' ? 15000 : 30000;
    const timer = window.setInterval(refreshReport, intervalMs);
    return () => window.clearInterval(timer);
  }, [refreshReport, trackingReport?.status]);

  if (loading && !trackingReport) {
    return <SkeletonTrackingScreen />;
  }

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
  const dispatch = trackingReport.dispatch || null;
  const liveLocation = dispatch?.current_location || null;
  const responder = liveLocation
    ? {
      ...liveLocation,
      unit_name: dispatch.unit_name || dispatch.plate_number || null,
    }
    : null;
  const unitName = dispatch?.unit_name || dispatch?.plate_number || 'Response unit';
  const personnelName = dispatch?.personnel_name || 'BFP personnel';

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
          <div>
            <strong>
              {dispatch
                ? `${unitName} dispatched`
                : trackingReport.status === 'responding'
                  ? 'Response en route'
                  : 'Awaiting BFP response'}
            </strong>
            <small>
              {dispatch
                ? `${personnelName} · ETA ${dispatch.estimated_eta_minutes ?? '—'} min${liveLocation ? ' · live GPS available' : ' · GPS pending'}`
                : 'BFP personnel will assign a unit and estimated arrival time after verification.'}
            </small>
          </div>
          <b>{dispatch ? `${dispatch.estimated_eta_minutes ?? '—'} min` : trackingReport.status === 'responding' ? 'En route' : '—'}</b>
        </div>
      </section>

      <section className='resident-track-section'>
        <div className='resident-section-heading'>
          <div>
            <h2>Route &amp; responder map</h2>
            <p>Suggested firetruck route, estimated arrival, and the latest live unit position.</p>
          </div>
        </div>
        <RouteNavigationMap
          destination={trackingReport}
          markers={markers}
          selected={trackingReport}
          height='230px'
          existingResponder={responder}
          readOnly
          title='Incident Tracking Map'
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
