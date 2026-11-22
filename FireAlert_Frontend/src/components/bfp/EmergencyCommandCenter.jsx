import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import RouteNavigationMap from '../shared/RouteNavigationMap';
import {
  calculateStationDistanceKm,
  ESTIMATED_RESPONSE_SPEED_KMH,
  suggestArrivalMinutes,
} from '../shared/stationLocation';
import { API_BASE_URL, apiRequest, normalizeReport } from '../../sharedApi';

const STATUS_LABELS = {
  pending: 'Report submitted',
  accepted: 'Report received',
  responding: 'En route',
  resolved: 'Incident resolved',
  rejected: 'Rejected',
  merged: 'Merged into another incident',
};

const DUPLICATE_LABELS = {
  anchor: 'First report',
  grouped: 'Grouped report',
  possible: 'Possible duplicate — verify',
  separated: 'Separated by BFP',
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

function formatDate(value) {
  if (!value) return 'Time unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString();
}

function responseData(payload) {
  const data = payload?.data || {};
  const reports = Array.isArray(data.reports) ? data.reports.map((report) => {
    const normalized = normalizeReport(report);
    return {
      ...normalized,
      status: statusKey(normalized?.status),
      dispatch: report.dispatch || null,
      incidentRecord: report.incidentRecord || null,
    };
  }) : [];
  return {
    reports,
    trucks: Array.isArray(data.trucks) ? data.trucks : [],
    personnel: Array.isArray(data.personnel) ? data.personnel : [],
    statuses: Array.isArray(data.statuses) ? data.statuses : [],
  };
}

function normalizeIncident(raw) {
  if (!raw) return null;
  const attributes = raw.attributes || {};
  const memberReports = Array.isArray(attributes.reports)
    ? attributes.reports.map((report) => {
      const normalized = normalizeReport(report);
      return { ...normalized, status: statusKey(normalized?.status) };
    })
    : [];
  return {
    id: raw.id,
    code: attributes.code || `INC-${String(raw.id).padStart(3, '0')}`,
    incidentDescription: attributes.incidentDescription || '',
    incidentAddress: attributes.incidentAddress || '',
    latitude: attributes.latitude,
    longitude: attributes.longitude,
    status: statusKey(attributes.status),
    firstReportedAt: attributes.firstReportedAt || null,
    lastReportedAt: attributes.lastReportedAt || null,
    reportCount: attributes.reportCount ?? memberReports.length,
    reports: memberReports,
    possibleDuplicates: Array.isArray(attributes.possibleDuplicates) ? attributes.possibleDuplicates : [],
    dispatch: raw.dispatch || null,
  };
}

function normalizeIncidents(payload) {
  const data = payload?.data || {};
  const list = Array.isArray(data.incidents) ? data.incidents : [];
  return list.map(normalizeIncident).filter(Boolean);
}

function EvidencePreview({ reportId }) {
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  const togglePreview = async () => {
    if (imageUrl) {
      setImageUrl('');
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('firealert_token');
      const response = await fetch(`${API_BASE_URL}/reports/${reportId}/evidence`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || `Unable to load evidence (HTTP ${response.status}).`);
      }
      setImageUrl(URL.createObjectURL(await response.blob()));
    } catch (requestError) {
      setError(requestError.message || 'Unable to load incident photo evidence.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='bfp-evidence'>
      <button type='button' className='bfp-text-button' onClick={togglePreview} disabled={loading}>
        {loading ? 'Loading evidence…' : imageUrl ? 'Hide incident photo evidence' : 'View incident photo evidence'}
      </button>
      {imageUrl && <img src={imageUrl} alt='Submitted incident evidence' />}
      {error && <p className='bfp-evidence-error' role='alert'>{error}</p>}
    </div>
  );
}

function safeCloseAudioContext(audioCtx) {
  if (!audioCtx) return;
  try {
    if (audioCtx.state === 'closed' || audioCtx.state === 'closing') return;
    const closePromise = audioCtx.close();
    if (closePromise && typeof closePromise.catch === 'function') {
      closePromise.catch(() => {});
    }
  } catch {}
}

function playEmergencyAlarmSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return () => {};
    const audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    let isHigh = true;
    let beeps = 0;
    const maxBeeps = 12;

    const timer = setInterval(() => {
      if (beeps >= maxBeeps || audioCtx.state === 'closed' || audioCtx.state === 'closing') {
        clearInterval(timer);
        safeCloseAudioContext(audioCtx);
        return;
      }

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(isHigh ? 920 : 680, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.22, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.28);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);

      isHigh = !isHigh;
      beeps++;
    }, 320);

    return () => {
      clearInterval(timer);
      safeCloseAudioContext(audioCtx);
    };
  } catch {
    return () => {};
  }
}

export default function EmergencyCommandCenter() {
  const [reports, setReports] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [nextStatus, setNextStatus] = useState('');
  const [truckId, setTruckId] = useState('');
  const [personnelId, setPersonnelId] = useState('');
  const [eta, setEta] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [alarmReport, setAlarmReport] = useState(null);
  const [flyTrigger, setFlyTrigger] = useState(0);
  const [incidents, setIncidents] = useState([]);
  const [feedView, setFeedView] = useState('incidents');
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const [expandedMemberId, setExpandedMemberId] = useState(null);
  const [groupingNote, setGroupingNote] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');

  const knownReportIdsRef = useRef(null);
  const incidentsRef = useRef(new Set());
  const stopAlarmSoundRef = useRef(null);

  const dismissAlarm = useCallback(() => {
    if (stopAlarmSoundRef.current) {
      stopAlarmSoundRef.current();
      stopAlarmSoundRef.current = null;
    }
    setAlarmReport(null);
  }, []);

  useEffect(() => () => {
    if (stopAlarmSoundRef.current) {
      stopAlarmSoundRef.current();
    }
  }, []);

  const loadCommandCenter = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');

    try {
      const payload = await apiRequest('/command-center');
      const data = responseData(payload);
      const incomingReports = data.reports;

      let incomingIncidents = [];
      try {
        incomingIncidents = normalizeIncidents(await apiRequest('/incidents'));
      } catch (incidentError) {
        // Incident grouping endpoint unavailable: keep the flat report feed.
        incomingIncidents = [];
      }

      // Detect newly arrived report(s)
      if (knownReportIdsRef.current !== null) {
        const newReports = incomingReports.filter(
          (report) => !knownReportIdsRef.current.has(String(report.id))
        );

        if (newReports.length > 0) {
          const newest = newReports[0];
          const newestIncident = incomingIncidents.find(
            (incident) => incident.reports.some((member) => String(member.id) === String(newest.id))
          );
          const isNewIncident = newestIncident && !incidentsRef.current.has(String(newestIncident.id));
          // Alarm only for a brand-new Main Incident, a possible duplicate
          // needing verification, or an ungrouped new report — not for every
          // auto-attached supporting report.
          const needsAlarm = isNewIncident
            || newest.duplicateFlag === 'possible'
            || !newestIncident;
          setSelectedId(newest.id);
          if (newestIncident) setSelectedIncidentId(newestIncident.id);
          if (needsAlarm) {
            setAlarmReport({ ...newest, incidentCode: newestIncident?.code || null });
            setFlyTrigger((v) => v + 1);
            if (stopAlarmSoundRef.current) {
              stopAlarmSoundRef.current();
            }
            stopAlarmSoundRef.current = playEmergencyAlarmSound();
          }
        }
      }

      knownReportIdsRef.current = new Set(incomingReports.map((r) => String(r.id)));
      incidentsRef.current = new Set(incomingIncidents.map((incident) => String(incident.id)));

      setIncidents(incomingIncidents);
      setReports(incomingReports);
      setTrucks(data.trucks);
      setPersonnel(data.personnel);
      setStatuses(data.statuses);
      setSelectedId((currentId) => (
        incomingReports.some((report) => String(report.id) === String(currentId))
          ? currentId
          : incomingReports[0]?.id ?? null
      ));
    } catch (requestError) {
      setError(requestError.message || 'Unable to load command center data.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCommandCenter();
    const refreshTimer = window.setInterval(() => loadCommandCenter(false), 12000);
    return () => window.clearInterval(refreshTimer);
  }, [loadCommandCenter]);

  const selectedReport = reports.find((report) => String(report.id) === String(selectedId)) || null;
  const selectedIncident = incidents.find((incident) => String(incident.id) === String(selectedIncidentId)) || null;
  const activeMembers = selectedIncident?.reports || [];
  // Dispatch + detail operate on the anchor (first) member of the open Main
  // Incident so grouped reports share one coordinated response.
  const focusedReport = feedView === 'incidents' && selectedIncident
    ? (activeMembers.find((member) => String(member.id) === String(selectedId)) || activeMembers[0] || selectedReport)
    : selectedReport;
  const dispatchInfo = (
    feedView === 'incidents' && selectedIncident ? selectedIncident.dispatch : null
  ) || focusedReport?.dispatch || null;
  const dispatchReportId = dispatchInfo?.report_id || focusedReport?.id || null;
  const responderPosition = dispatchInfo?.current_location
    ? {
      ...dispatchInfo.current_location,
      unit_name: dispatchInfo.unit_name || dispatchInfo.plate_number || null,
    }
    : null;

  const shareResponderLocation = useCallback(async (position) => {
    if (!dispatchReportId) return;
    await apiRequest(`/reports/${dispatchReportId}/dispatch-location`, {
      method: 'POST',
      body: JSON.stringify({
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy_meters: Number.isFinite(position.accuracy) ? position.accuracy : undefined,
      }),
    });
  }, [dispatchReportId]);

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

  useEffect(() => {
    setNextStatus(focusedReport?.status || '');
  }, [focusedReport?.id, focusedReport?.status]);

  useEffect(() => {
    const suggestedEta = suggestArrivalMinutes(focusedReport?.latitude, focusedReport?.longitude);
    setEta(suggestedEta === null ? '' : String(suggestedEta));
  }, [focusedReport?.id, focusedReport?.latitude, focusedReport?.longitude]);

  const statusCounts = useMemo(
    () => availableStatuses.map(({ value, name }) => ({
      status: value,
      label: STATUS_LABELS[value] || name,
      count: reports.filter((report) => report.status === value).length,
    })),
    [availableStatuses, reports]
  );
  const stationDistanceKm = focusedReport
    ? calculateStationDistanceKm(focusedReport.latitude, focusedReport.longitude)
    : null;
  const incidentMarkers = (selectedIncident?.reports || [])
    .filter((member) => member.latitude != null && member.longitude != null)
    .map((member) => ({
      id: member.id,
      lat: Number(member.latitude),
      lng: Number(member.longitude),
      address: member.incidentAddress || `Report FA-${String(member.id).padStart(6, '0')}`,
    }));
  const markers = feedView === 'incidents' && selectedIncident && incidentMarkers.length > 0
    ? incidentMarkers
    : reports
    .filter((report) => report.latitude != null && report.longitude != null)
    .map((report) => ({
      id: report.id,
      lat: Number(report.latitude),
      lng: Number(report.longitude),
      address: report.incidentAddress || `Incident FA-${String(report.id).padStart(6, '0')}`,
    }));

  const selectIncident = (incident) => {
    setFeedView('incidents');
    setSelectedIncidentId(incident.id);
    const anchor = incident.reports?.[0];
    if (anchor) {
      setSelectedId(anchor.id);
      setFlyTrigger((v) => v + 1);
    }
  };

  const runGroupingAction = async (actionLabel, requestFn) => {
    setUpdating(true);
    setError('');
    try {
      await requestFn();
      setGroupingNote('');
      setMergeTargetId('');
      await loadCommandCenter(false);
    } catch (requestError) {
      setError(requestError.message || `Unable to ${actionLabel}.`);
    } finally {
      setUpdating(false);
    }
  };

  const attachMemberToIncident = (memberId, targetIncidentId) => runGroupingAction('attach the report', () =>
    apiRequest(`/incidents/${targetIncidentId}/reports/${memberId}/attach`, {
      method: 'POST',
      body: JSON.stringify({ reason: groupingNote.trim() || undefined }),
    }));

  const detachMember = (memberId) => runGroupingAction('separate the report', () =>
    apiRequest(`/reports/${memberId}/detach`, {
      method: 'POST',
      body: JSON.stringify({ reason: groupingNote.trim() || undefined }),
    }));

  const mergeSelectedIncident = (event) => {
    event.preventDefault();
    if (!selectedIncident || !mergeTargetId || String(mergeTargetId) === String(selectedIncident.id)) return;
    return runGroupingAction('merge the incidents', () =>
      apiRequest(`/incidents/${selectedIncident.id}/merge`, {
        method: 'POST',
        body: JSON.stringify({
          into_incident_id: Number(mergeTargetId),
          reason: groupingNote.trim() || undefined,
        }),
      }));
  };

  const updateIncidentStatus = (event) => {
    event.preventDefault();
    if (!selectedIncident || !nextStatus || nextStatus === selectedIncident.status) return;
    return runGroupingAction('update the incident status', () =>
      apiRequest(`/incidents/${selectedIncident.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      }));
  };

  const updateStatus = async (event) => {
    event.preventDefault();
    if (!focusedReport || !nextStatus || nextStatus === focusedReport.status) return;

    setUpdating(true);
    setError('');
    try {
      await apiRequest(`/reports/${selectedReport.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          data: {
            type: 'fire_report',
            attributes: { status: nextStatus },
          },
        }),
      });
      await loadCommandCenter(false);
    } catch (requestError) {
      setError(requestError.message || 'Unable to update the report status.');
    } finally {
      setUpdating(false);
    }
  };

  const dispatchResponse = async (event) => {
    event.preventDefault();
    if (!focusedReport) return;

    setUpdating(true);
    setError('');
    try {
      await apiRequest(`/reports/${focusedReport.id}/dispatch`, {
        method: 'POST',
        body: JSON.stringify({
          truck_id: Number(truckId),
          personnel_id: Number(personnelId),
          estimated_eta_minutes: Number(eta),
        }),
      });
      await loadCommandCenter(false);
    } catch (requestError) {
      setError(requestError.message || 'Unable to dispatch the response unit.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className='bfp-page'>
      <div className='bfp-page-heading'>
        <div>
          <p className='bfp-eyebrow'>BFP Mansalay</p>
          <h1>Emergency Command Center</h1>
          <p>Receive, verify, and coordinate fire emergency response.</p>
        </div>
        <div className='bfp-connection'>
          <span className='connection-indicator' />
          {error ? 'Connection issue' : 'Connected to report service'}
          <span className='bfp-current-time'>{new Date().toLocaleString()}</span>
        </div>
      </div>

      <section className='bfp-status-counts' aria-label='Report counts by status'>
        {statusCounts.map(({ status, label, count }) => (
          <div className={`bfp-count-card status-${status}`} key={status}>
            <span className='count-status'>{label}</span>
            <strong>{count}</strong>
          </div>
        ))}
      </section>

      {error && <div className='bfp-error' role='alert'>{error}</div>}

      <div className='bfp-command-grid'>
        <section className='bfp-panel alerts-panel'>
          <div className='bfp-panel-heading'>
            <div>
              <h2>Active Alerts Feed</h2>
              <p>
                {feedView === 'incidents'
                  ? `${incidents.length} main incidents · ${reports.length} resident reports`
                  : `${reports.length} reports · newest first`}
              </p>
            </div>
            <div className='bfp-panel-heading-actions'>
              <button
                type='button'
                className='bfp-alarm-test-btn'
                onClick={() => {
                  if (reports.length > 0) {
                    const target = focusedReport || reports[0];
                    setSelectedId(target.id);
                    setAlarmReport(target);
                    setFlyTrigger((v) => v + 1);
                    if (stopAlarmSoundRef.current) stopAlarmSoundRef.current();
                    stopAlarmSoundRef.current = playEmergencyAlarmSound();
                  }
                }}
                title='Test alarm notification & map zoom transition'
              >
                <span aria-hidden='true'>🚨</span> Test Alarm
              </button>
              <button type='button' className='bfp-icon-button' onClick={() => loadCommandCenter()} aria-label='Refresh reports'>
                ↻
              </button>
            </div>
          </div>

          <div className='bfp-feed-tabs' role='tablist' aria-label='Alerts feed view'>
            <button
              type='button'
              role='tab'
              aria-selected={feedView === 'incidents'}
              className={feedView === 'incidents' ? 'active' : ''}
              onClick={() => setFeedView('incidents')}
            >
              Main Incidents ({incidents.length})
            </button>
            <button
              type='button'
              role='tab'
              aria-selected={feedView === 'reports'}
              className={feedView === 'reports' ? 'active' : ''}
              onClick={() => setFeedView('reports')}
            >
              All Reports ({reports.length})
            </button>
          </div>

          <div className='bfp-alert-list'>
            {loading ? (
              <p className='bfp-empty-message'>Loading reports…</p>
            ) : feedView === 'incidents' ? (
              incidents.length === 0 ? (
                <p className='bfp-empty-message'>No fire incidents yet. Switch to All Reports to review incoming submissions.</p>
              ) : incidents.map((incident) => (
                <button
                  type='button'
                  key={incident.id}
                  className={`bfp-alert-card bfp-incident-card${String(incident.id) === String(selectedIncidentId) ? ' selected' : ''}`}
                  onClick={() => selectIncident(incident)}
                >
                  <span className='alert-card-top'>
                    <span className='reference-id'>{incident.code}</span>
                    <time>{formatDate(incident.lastReportedAt || incident.firstReportedAt)}</time>
                  </span>
                  <strong>{incident.incidentAddress || 'Location not provided'}</strong>
                  <span className='alert-description'>{incident.incidentDescription || 'No description provided.'}</span>
                  <span className='bfp-incident-card-foot'>
                    <span className={`bfp-status-badge status-${incident.status || 'pending'}`}>
                      <i /> {STATUS_LABELS[incident.status] || incident.status || 'Unknown'}
                    </span>
                    <span className='bfp-report-count' title='Total supporting reports'>
                      📄 {incident.reportCount} report{incident.reportCount === 1 ? '' : 's'}
                    </span>
                  </span>
                  {incident.possibleDuplicates.length > 0 && (
                    <span className='bfp-verify-flag' role='note'>
                      ⚠ {incident.possibleDuplicates.length} possible duplicate{incident.possibleDuplicates.length === 1 ? '' : 's'} need verification
                    </span>
                  )}
                </button>
              ))
            ) : reports.length === 0 ? (
              <p className='bfp-empty-message'>No fire reports have been submitted.</p>
            ) : reports.map((report) => (
              <button
                type='button'
                key={report.id}
                className={`bfp-alert-card${String(report.id) === String(selectedId) ? ' selected' : ''}`}
                onClick={() => {
                  setFeedView('reports');
                  setSelectedId(report.id);
                  setFlyTrigger((v) => v + 1);
                }}
              >
                <span className='alert-card-top'>
                  <span className='reference-id'>FA-{String(report.id).padStart(6, '0')}</span>
                  <time>{formatDate(report.reportedAt || report.createdAt)}</time>
                </span>
                <strong>{report.incidentAddress || 'Location not provided'}</strong>
                <span className='alert-description'>{report.incidentDescription || 'No description provided.'}</span>
                <span className={`bfp-status-badge status-${report.status || 'pending'}`}>
                  <i /> {STATUS_LABELS[report.status] || report.status || 'Unknown'}
                </span>
              </button>
            ))}
          </div>
          <p className='bfp-panel-note'>Verify incident details before coordinating a response.</p>
        </section>

        <section className='bfp-panel incident-panel'>
          {feedView === 'incidents' ? (
            selectedIncident ? (
              <>
                <div className='bfp-incident-heading'>
                  <div>
                    <p className='bfp-eyebrow'>Main Incident · {selectedIncident.code}</p>
                    <h2>{selectedIncident.incidentAddress || 'Location not provided'}</h2>
                    <p>
                      {selectedIncident.reportCount} supporting report{selectedIncident.reportCount === 1 ? '' : 's'}
                      {' · '}first {formatDate(selectedIncident.firstReportedAt)}
                    </p>
                  </div>
                  <span className={`bfp-status-badge status-${selectedIncident.status || 'pending'}`}>
                    <i /> {STATUS_LABELS[selectedIncident.status] || selectedIncident.status || 'Unknown'}
                  </span>
                </div>

                <RouteNavigationMap
                  destination={focusedReport}
                  markers={markers}
                  selected={focusedReport}
                  height='300px'
                  flyTrigger={flyTrigger}
                  canTrack={Boolean(dispatchInfo)}
                  existingResponder={responderPosition}
                  onShareLocation={shareResponderLocation}
                  title='Response route map'
                />

                <div className='bfp-incident-meta'>
                  <div><span>FIRST REPORT</span><strong>{formatDate(selectedIncident.firstReportedAt)}</strong></div>
                  <div><span>LATEST REPORT</span><strong>{formatDate(selectedIncident.lastReportedAt)}</strong></div>
                  <div><span>RESPONSE STATUS</span><strong>{STATUS_LABELS[selectedIncident.status] || selectedIncident.status || 'Unknown'}</strong></div>
                </div>

                <div className='bfp-description'>
                  <h3>Incident information</h3>
                  <p>{selectedIncident.incidentDescription || 'No incident description provided.'}</p>
                </div>
                {dispatchInfo && (
                  <div className='bfp-assignment-note'>
                    <strong>Current response unit</strong>
                    <p>{dispatchInfo.unit_name || dispatchInfo.plate_number || 'Assigned vehicle'} · {dispatchInfo.personnel_name || 'Assigned personnel'} · ETA {dispatchInfo.estimated_eta_minutes} min</p>
                    {dispatchInfo.current_location && (
                      <p className='bfp-live-location-note'>
                        Live GPS {Number(dispatchInfo.current_location.latitude).toFixed(5)}, {Number(dispatchInfo.current_location.longitude).toFixed(5)}
                        {' · '}updated {formatDate(dispatchInfo.location_updated_at)}
                      </p>
                    )}
                  </div>
                )}

                <div className='bfp-members'>
                  <h3>Supporting reports ({activeMembers.length})</h3>
                  <label className='bfp-grouping-note-label' htmlFor='grouping-note'>
                    Note for attach / separate / merge actions (recorded in the audit log)
                  </label>
                  <input
                    id='grouping-note'
                    type='text'
                    className='bfp-grouping-note'
                    value={groupingNote}
                    onChange={(event) => setGroupingNote(event.target.value)}
                    placeholder='e.g. Confirmed same fire on site'
                  />
                  {activeMembers.map((member) => {
                    const expanded = String(member.id) === String(expandedMemberId);
                    const otherIncidents = incidents.filter((incident) => String(incident.id) !== String(selectedIncident.id));
                    return (
                      <article key={member.id} className={`bfp-member-card${member.duplicateFlag === 'possible' ? ' needs-verify' : ''}`}>
                        <button
                          type='button'
                          className='bfp-member-head'
                          onClick={() => {
                            setSelectedId(member.id);
                            setExpandedMemberId(expanded ? null : member.id);
                            setFlyTrigger((v) => v + 1);
                          }}
                          aria-expanded={expanded}
                        >
                          <span className='reference-id'>FA-{String(member.id).padStart(6, '0')}</span>
                          <span className='bfp-member-title'>{member.incidentAddress || member.incidentDescription || 'Report'}</span>
                          <time>{formatDate(member.reportedAt || member.createdAt)}</time>
                        </button>
                        <div className='bfp-member-tags'>
                          {member.duplicateFlag && (
                            <span className={`bfp-duplicate-flag flag-${member.duplicateFlag}`}>
                              {DUPLICATE_LABELS[member.duplicateFlag] || member.duplicateFlag}
                            </span>
                          )}
                          <span className={`bfp-status-badge status-${member.status || 'pending'}`}>
                            <i /> {STATUS_LABELS[member.status] || member.status || 'Unknown'}
                          </span>
                        </div>
                        {expanded && (
                          <div className='bfp-member-body'>
                            <p><strong>Reported by:</strong> {member.residentName || 'Resident details unavailable'}</p>
                            <p>{member.incidentDescription || 'No description provided.'}</p>
                            <p className='bfp-member-meta'>
                              {member.latitude != null && member.longitude != null
                                ? `GPS: ${member.latitude}, ${member.longitude} · `
                                : ''}
                              {member.locationSource || 'Source unavailable'}
                            </p>
                            {member.hasEvidence && <EvidencePreview key={member.id} reportId={member.id} />}
                            <div className='bfp-member-actions'>
                              <button
                                type='button'
                                className='bfp-text-button'
                                disabled={updating}
                                onClick={() => detachMember(member.id)}
                                title='Separate this report into its own Main Incident'
                              >
                                ⤴ Separate
                              </button>
                              {otherIncidents.length > 0 && (
                                <label className='bfp-attach-control'>
                                  <span>Attach to</span>
                                  <select
                                    defaultValue=''
                                    disabled={updating}
                                    onChange={(event) => {
                                      if (event.target.value) attachMemberToIncident(member.id, event.target.value);
                                      event.target.value = '';
                                    }}
                                    aria-label={`Attach report FA-${String(member.id).padStart(6, '0')} to another incident`}
                                  >
                                    <option value=''>Select incident…</option>
                                    {otherIncidents.map((incident) => (
                                      <option key={incident.id} value={incident.id}>
                                        {incident.code} · {incident.incidentAddress || 'No address'} ({incident.reportCount})
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              )}
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>

                <form className='bfp-merge-form' onSubmit={mergeSelectedIncident}>
                  <label htmlFor='merge-target'>Merge this incident into</label>
                  <select
                    id='merge-target'
                    value={mergeTargetId}
                    onChange={(event) => setMergeTargetId(event.target.value)}
                    required
                  >
                    <option value=''>Select target incident…</option>
                    {incidents
                      .filter((incident) => String(incident.id) !== String(selectedIncident.id))
                      .map((incident) => (
                        <option key={incident.id} value={incident.id}>
                          {incident.code} · {incident.incidentAddress || 'No address'} ({incident.reportCount})
                        </option>
                      ))}
                  </select>
                  <button className='bfp-primary-button' type='submit' disabled={updating || !mergeTargetId}>
                    {updating ? 'Merging…' : 'Confirm merge'}
                  </button>
                </form>
              </>
            ) : (
              <div className='bfp-no-selection'>
                <span aria-hidden='true'>⌖</span>
                <h2>{loading ? 'Loading incidents…' : 'Select a Main Incident'}</h2>
                <p>Select a Main Incident from the feed to view all its supporting reports.</p>
              </div>
            )
          ) : selectedReport ? (
            <>
              <div className='bfp-incident-heading'>
                <div>
                  <p className='bfp-eyebrow'>Selected incident · FA-{String(selectedReport.id).padStart(6, '0')}</p>
                  <h2>{selectedReport.incidentAddress || 'Location not provided'}</h2>
                  <p>{selectedReport.residentName ? `Reported by ${selectedReport.residentName}` : 'Resident details unavailable'}</p>
                </div>
                <span className={`bfp-status-badge status-${selectedReport.status || 'pending'}`}>
                  <i /> {STATUS_LABELS[selectedReport.status] || selectedReport.status || 'Unknown'}
                </span>
              </div>

              <RouteNavigationMap
                destination={focusedReport}
                markers={markers}
                selected={selectedReport}
                height='340px'
                flyTrigger={flyTrigger}
                canTrack={Boolean(dispatchInfo)}
                existingResponder={responderPosition}
                onShareLocation={shareResponderLocation}
                title='Response route map'
              />

              <div className='bfp-incident-meta'>
                <div><span>REPORTED</span><strong>{formatDate(selectedReport.reportedAt || selectedReport.createdAt)}</strong></div>
                <div><span>LOCATION SOURCE</span><strong>{selectedReport.locationSource || 'Not provided'}</strong></div>
                <div><span>COORDINATES</span><strong>{selectedReport.latitude != null && selectedReport.longitude != null ? `${selectedReport.latitude}, ${selectedReport.longitude}` : 'Unavailable'}</strong></div>
              </div>

              <div className='bfp-description'>
                <h3>Incident information</h3>
                <p>{selectedReport.incidentDescription || 'No incident description provided.'}</p>
              </div>
              {focusedReport.hasEvidence && (
                <EvidencePreview key={focusedReport.id} reportId={focusedReport.id} />
              )}
              {dispatchInfo && (
                  <div className='bfp-assignment-note'>
                    <strong>Current response unit</strong>
                    <p>{dispatchInfo.unit_name || dispatchInfo.plate_number || 'Assigned vehicle'} · {dispatchInfo.personnel_name || 'Assigned personnel'} · ETA {dispatchInfo.estimated_eta_minutes} min</p>
                    {dispatchInfo.current_location && (
                      <p className='bfp-live-location-note'>
                        Live GPS {Number(dispatchInfo.current_location.latitude).toFixed(5)}, {Number(dispatchInfo.current_location.longitude).toFixed(5)}
                        {' · '}updated {formatDate(dispatchInfo.location_updated_at)}
                      </p>
                    )}
                  </div>
                )}
              {selectedReport.incidentRecord && (
                <div className='bfp-assignment-note'>
                  <strong>Incident record</strong>
                  <p>{selectedReport.incidentRecord.resolution_summary || selectedReport.incidentRecord.damage_assessment || 'An incident record is available.'}</p>
                  <p>Casualties: {selectedReport.incidentRecord.casualties_count ?? 'Not recorded'}</p>
                </div>
              )}
            </>
          ) : (
            <div className='bfp-no-selection'>
              <span aria-hidden='true'>⌖</span>
              <h2>{loading ? 'Loading incidents…' : 'Select an incident'}</h2>
              <p>Select a report from the alerts feed to view its location and details.</p>
            </div>
          )}
        </section>

        <section className='bfp-panel dispatch-panel'>
          <div className='bfp-panel-heading'>
            <div>
              <h2>Dispatch Control Panel</h2>
              <p>Assign a response unit, personnel, and ETA</p>
            </div>
          </div>

          {focusedReport ? (
            <div className='bfp-dispatch-form'>
              <div className='bfp-confirmation'>
                <span aria-hidden='true'>✓</span>
                <div>
                  <strong>
                    {feedView === 'incidents' && selectedIncident
                      ? `Coordinating ${selectedIncident.code} (${selectedIncident.reportCount} reports)`
                      : 'Report received'}
                  </strong>
                  <small>Submitted {formatDate(focusedReport.reportedAt || focusedReport.createdAt)}</small>
                </div>
              </div>
              <form onSubmit={feedView === 'incidents' && selectedIncident ? updateIncidentStatus : updateStatus}>
                <label htmlFor='bfp-status'>Response status{feedView === 'incidents' && selectedIncident ? ' — applies to the whole Main Incident' : ''}</label>
                <select id='bfp-status' value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>
                  {availableStatuses.map(({ value, name }) => (
                    <option value={value} key={name}>{STATUS_LABELS[value] || name}</option>
                  ))}
                </select>
                <button
                  className='bfp-primary-button'
                  type='submit'
                  disabled={updating || !nextStatus || nextStatus === (feedView === 'incidents' && selectedIncident ? selectedIncident.status : focusedReport.status)}
                >
                  {updating ? 'Saving…' : 'Update response status'}
                </button>
              </form>

              <form className='bfp-assignment-form' onSubmit={dispatchResponse}>
                <label htmlFor='dispatch-truck'>Fire truck</label>
                <select id='dispatch-truck' value={truckId} onChange={(event) => setTruckId(event.target.value)} required>
                  <option value=''>Select an available unit</option>
                  {trucks.map((truck) => (
                    <option value={truck.truck_id} key={truck.truck_id}>
                      {truck.unit_name || truck.plate_number} · {truck.status || 'Status unknown'}
                    </option>
                  ))}
                </select>
                <label htmlFor='dispatch-personnel'>BFP personnel</label>
                <select id='dispatch-personnel' value={personnelId} onChange={(event) => setPersonnelId(event.target.value)} required>
                  <option value=''>Select personnel</option>
                  {personnel.map((member) => (
                    <option
                      value={member.personnel_id || ''}
                      key={member.user_id || member.personnel_id}
                      disabled={!member.personnel_id}
                    >
                      {member.rank_position ? `${member.rank_position} · ` : ''}{member.full_name}
                      {!member.personnel_id ? ' · Complete personnel profile in User Management' : ''}
                    </option>
                  ))}
                </select>
                {personnel.some((member) => !member.personnel_id) && (
                  <p className='bfp-eta-help'>
                    BFP accounts without a personnel profile are listed but cannot be dispatched. Add their badge and rank in System Admin &gt; User Management.
                  </p>
                )}
                <label htmlFor='dispatch-eta'>Suggested arrival time (minutes)</label>
                <input id='dispatch-eta' type='number' min='1' max='1440' value={eta} onChange={(event) => setEta(event.target.value)} required />
                <p className='bfp-eta-help'>
                  {stationDistanceKm === null
                    ? 'Add an incident map pin to calculate an ETA. You can enter the estimate manually.'
                    : `Auto-estimated from ${stationDistanceKm.toFixed(1)} km straight-line distance at ${ESTIMATED_RESPONSE_SPEED_KMH} km/h. Actual road distance and traffic may increase travel time; adjust as needed.`}
                </p>
                <button
                  className='bfp-primary-button'
                  type='submit'
                  disabled={updating || !truckId || !personnelId || !eta}
                >
                  {updating ? 'Dispatching…' : 'Confirm dispatch'}
                </button>
              </form>
              <div className='bfp-security-note'>
                <strong>Authorized personnel only</strong>
                <p>Dispatch and status changes are recorded against the selected fire report.</p>
              </div>
            </div>
          ) : (
            <p className='bfp-empty-message'>Select an incident to manage its response.</p>
          )}
        </section>
      </div>

      {alarmReport && (
        <div className='bfp-alarm-popup-overlay' role='dialog' aria-modal='true' aria-labelledby='alarm-dialog-title'>
          <div className='bfp-alarm-popup'>
            <div className='bfp-alarm-header'>
              <div className='bfp-alarm-badge'>
                <span className='bfp-alarm-siren-icon' aria-hidden='true'>🚨</span>
                <span className='bfp-alarm-pulse-dot' aria-hidden='true' />
                <h2 id='alarm-dialog-title'>EMERGENCY ALARM: NEW INCIDENT REPORT</h2>
              </div>
              <button
                type='button'
                className='bfp-alarm-close'
                onClick={dismissAlarm}
                aria-label='Close alarm notification'
              >
                ✕
              </button>
            </div>

            <div className='bfp-alarm-body'>
              <div className='bfp-alarm-hero'>
                <span className='bfp-alarm-ref'>FA-{String(alarmReport.id).padStart(6, '0')}{alarmReport.incidentCode ? ` · ${alarmReport.incidentCode}` : ''}</span>
                <h3 className='bfp-alarm-location'>{alarmReport.incidentAddress || 'Location not specified'}</h3>
                <p className='bfp-alarm-time'>
                  Reported: {formatDate(alarmReport.reportedAt || alarmReport.createdAt)}
                </p>
                <p className='bfp-alarm-time' style={{color:'#b5121f', fontWeight:600}}>📍 Map focused to this location (auto).</p>
                {alarmReport.duplicateFlag === 'possible' && (
                  <p className='bfp-alarm-verify' role='note'>⚠ Possible duplicate — verify against {alarmReport.incidentCode || 'the open incident'} before dispatching a second unit.</p>
                )}
              </div>

              <div className='bfp-alarm-meta-grid'>
                {alarmReport.residentName && (
                  <div>
                    <span>REPORTED BY</span>
                    <strong>{alarmReport.residentName}</strong>
                  </div>
                )}
                {alarmReport.contact_number && (
                  <div>
                    <span>CONTACT</span>
                    <strong>{alarmReport.contact_number}</strong>
                  </div>
                )}
                <div>
                  <span>STATUS</span>
                  <span className={`bfp-status-badge status-${alarmReport.status || 'pending'}`}>
                    <i /> {STATUS_LABELS[alarmReport.status] || alarmReport.status}
                  </span>
                </div>
                {alarmReport.latitude != null && alarmReport.longitude != null && (
                  <div>
                    <span>COORDINATES</span>
                    <strong>{alarmReport.latitude}, {alarmReport.longitude}</strong>
                  </div>
                )}
              </div>

              {alarmReport.incidentDescription && (
                <div className='bfp-alarm-desc'>
                  <span>INCIDENT DESCRIPTION</span>
                  <p>{alarmReport.incidentDescription}</p>
                </div>
              )}
            </div>

            <div className='bfp-alarm-actions'>
              <button
                type='button'
                className='btn bfp-alarm-btn-focus'
                onClick={() => {
                  setSelectedId(alarmReport.id);
                  setFlyTrigger((v) => v + 1);
                  dismissAlarm();
                }}
              >
                <span aria-hidden='true'>🎯</span> Zoom to Location Pin
              </button>
              <button
                type='button'
                className='btn bfp-alarm-btn-ack'
                onClick={dismissAlarm}
              >
                Acknowledge & Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
