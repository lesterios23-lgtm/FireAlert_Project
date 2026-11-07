import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapContainer from '../shared/MapContainer';
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

function playEmergencyAlarmSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return () => {};
    const audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    let isHigh = true;
    let beeps = 0;
    const maxBeeps = 12;

    const timer = setInterval(() => {
      if (beeps >= maxBeeps || audioCtx.state === 'closed') {
        clearInterval(timer);
        try { audioCtx.close(); } catch {}
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
      try { audioCtx.close(); } catch {}
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

  const knownReportIdsRef = useRef(null);
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

      // Detect newly arrived report(s)
      if (knownReportIdsRef.current !== null) {
        const newReports = incomingReports.filter(
          (report) => !knownReportIdsRef.current.has(String(report.id))
        );

        if (newReports.length > 0) {
          const newest = newReports[0];
          setSelectedId(newest.id);
          setAlarmReport(newest);
          setFlyTrigger((v) => v + 1);

          if (stopAlarmSoundRef.current) {
            stopAlarmSoundRef.current();
          }
          stopAlarmSoundRef.current = playEmergencyAlarmSound();
        }
      }

      knownReportIdsRef.current = new Set(incomingReports.map((r) => String(r.id)));

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
    setNextStatus(selectedReport?.status || '');
  }, [selectedReport?.id, selectedReport?.status]);

  useEffect(() => {
    const suggestedEta = suggestArrivalMinutes(selectedReport?.latitude, selectedReport?.longitude);
    setEta(suggestedEta === null ? '' : String(suggestedEta));
  }, [selectedReport?.id, selectedReport?.latitude, selectedReport?.longitude]);

  const statusCounts = useMemo(
    () => availableStatuses.map(({ value, name }) => ({
      status: value,
      label: STATUS_LABELS[value] || name,
      count: reports.filter((report) => report.status === value).length,
    })),
    [availableStatuses, reports]
  );
  const stationDistanceKm = selectedReport
    ? calculateStationDistanceKm(selectedReport.latitude, selectedReport.longitude)
    : null;
  const markers = reports
    .filter((report) => report.latitude != null && report.longitude != null)
    .map((report) => ({
      id: report.id,
      lat: Number(report.latitude),
      lng: Number(report.longitude),
      address: report.incidentAddress || `Incident FA-${String(report.id).padStart(6, '0')}`,
    }));

  const updateStatus = async (event) => {
    event.preventDefault();
    if (!selectedReport || !nextStatus || nextStatus === selectedReport.status) return;

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
    if (!selectedReport) return;

    setUpdating(true);
    setError('');
    try {
      await apiRequest(`/reports/${selectedReport.id}/dispatch`, {
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
              <p>{reports.length} reports · newest first</p>
            </div>
            <div className='bfp-panel-heading-actions'>
              <button
                type='button'
                className='bfp-alarm-test-btn'
                onClick={() => {
                  if (reports.length > 0) {
                    const target = selectedReport || reports[0];
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

          <div className='bfp-alert-list'>
            {loading ? (
              <p className='bfp-empty-message'>Loading reports…</p>
            ) : reports.length === 0 ? (
              <p className='bfp-empty-message'>No fire reports have been submitted.</p>
            ) : reports.map((report) => (
              <button
                type='button'
                key={report.id}
                className={`bfp-alert-card${String(report.id) === String(selectedId) ? ' selected' : ''}`}
                onClick={() => {
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
          {selectedReport ? (
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

              <MapContainer markers={markers} selected={selectedReport} height='340px' flyTrigger={flyTrigger} />

              <div className='bfp-incident-meta'>
                <div><span>REPORTED</span><strong>{formatDate(selectedReport.reportedAt || selectedReport.createdAt)}</strong></div>
                <div><span>LOCATION SOURCE</span><strong>{selectedReport.locationSource || 'Not provided'}</strong></div>
                <div><span>COORDINATES</span><strong>{selectedReport.latitude != null && selectedReport.longitude != null ? `${selectedReport.latitude}, ${selectedReport.longitude}` : 'Unavailable'}</strong></div>
              </div>

              <div className='bfp-description'>
                <h3>Incident information</h3>
                <p>{selectedReport.incidentDescription || 'No incident description provided.'}</p>
              </div>
              {selectedReport.hasEvidence && (
                <EvidencePreview key={selectedReport.id} reportId={selectedReport.id} />
              )}
              {selectedReport.dispatch && (
                <div className='bfp-assignment-note'>
                  <strong>Current response unit</strong>
                  <p>{selectedReport.dispatch.unit_name || selectedReport.dispatch.plate_number || 'Assigned vehicle'} · {selectedReport.dispatch.personnel_name || 'Assigned personnel'} · ETA {selectedReport.dispatch.estimated_eta_minutes} min</p>
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

          {selectedReport ? (
            <div className='bfp-dispatch-form'>
              <div className='bfp-confirmation'>
                <span aria-hidden='true'>✓</span>
                <div>
                  <strong>Report received</strong>
                  <small>Submitted {formatDate(selectedReport.reportedAt || selectedReport.createdAt)}</small>
                </div>
              </div>
              <form onSubmit={updateStatus}>
                <label htmlFor='bfp-status'>Response status</label>
                <select id='bfp-status' value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>
                  {availableStatuses.map(({ value, name }) => (
                    <option value={value} key={name}>{STATUS_LABELS[value] || name}</option>
                  ))}
                </select>
                <button
                  className='bfp-primary-button'
                  type='submit'
                  disabled={updating || !nextStatus || nextStatus === selectedReport.status}
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
                <span className='bfp-alarm-ref'>FA-{String(alarmReport.id).padStart(6, '0')}</span>
                <h3 className='bfp-alarm-location'>{alarmReport.incidentAddress || 'Location not specified'}</h3>
                <p className='bfp-alarm-time'>
                  Reported: {formatDate(alarmReport.reportedAt || alarmReport.createdAt)}
                </p>
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
