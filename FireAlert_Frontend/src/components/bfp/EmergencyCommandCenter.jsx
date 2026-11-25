import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GoogleMap from '../shared/GoogleMap';
import { RouteNavigationPanel, useRouteNavigation } from '../shared/RouteNavigationMap';
import { suggestArrivalMinutes } from '../shared/stationLocation';
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
  const [truckId, setTruckId] = useState('');
  const [personnelId, setPersonnelId] = useState('');
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
  const [modalOpen, setModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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

  useEffect(() => {
    if (!modalOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen]);

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
        incomingIncidents = [];
      }

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
          const needsAlarm = isNewIncident
            || newest.duplicateFlag === 'possible'
            || !newestIncident;
          setSelectedId(newest.id);
          if (newestIncident) setSelectedIncidentId(newestIncident.id);
          if (needsAlarm) {
            setModalOpen(false);
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
      setSelectedIncidentId((currentIncidentId) => (
        incomingIncidents.some((incident) => String(incident.id) === String(currentIncidentId))
          ? currentIncidentId
          : incomingIncidents[0]?.id ?? null
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
  const isMainIncident = feedView === 'incidents' && Boolean(selectedIncident);
  const activeMembers = selectedIncident?.reports || [];

  const focusedReport = isMainIncident
    ? (activeMembers.find((member) => String(member.id) === String(selectedId)) || activeMembers[0] || selectedReport)
    : selectedReport;

  const dispatchInfo = (isMainIncident ? selectedIncident.dispatch : null) || focusedReport?.dispatch || null;
  const dispatchReportId = dispatchInfo?.report_id || focusedReport?.id || null;
  const responderPosition = dispatchInfo?.current_location
    ? {
      ...dispatchInfo.current_location,
      unit_name: dispatchInfo.unit_name || dispatchInfo.plate_number || null,
    }
    : null;

  const activeStatus = statusKey(
    isMainIncident ? selectedIncident?.status : focusedReport?.status
  ) || 'pending';

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

  const navigation = useRouteNavigation({
    destination: focusedReport,
    existingResponder: responderPosition,
    onShareLocation: shareResponderLocation,
  });

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

  const statusCounts = useMemo(
    () => availableStatuses.map(({ value, name }) => ({
      status: value,
      label: STATUS_LABELS[value] || name,
      count: reports.filter((report) => report.status === value).length,
    })),
    [availableStatuses, reports]
  );

  // Show all incident/report pins on the full-size map so any pin can be clicked to open the modal.
  const markers = useMemo(() => {
    if (feedView === 'incidents' && incidents.length > 0) {
      const seen = new Set();
      const list = [];
      incidents.forEach((incident) => {
        const anchor = incident.reports?.[0];
        const lat = incident.latitude ?? anchor?.latitude;
        const lng = incident.longitude ?? anchor?.longitude;
        if (lat != null && lng != null) {
          const markerId = anchor?.id ?? `incident-${incident.id}`;
          seen.add(String(markerId));
          list.push({
            id: markerId,
            incidentId: incident.id,
            reportId: anchor?.id ?? null,
            lat: Number(lat),
            lng: Number(lng),
            address: incident.incidentAddress || `${incident.code}`,
            status: incident.status,
          });
        }
      });
      return list;
    }

    return reports
      .filter((report) => report.latitude != null && report.longitude != null)
      .map((report) => ({
        id: report.id,
        reportId: report.id,
        lat: Number(report.latitude),
        lng: Number(report.longitude),
        address: report.incidentAddress || `Incident FA-${String(report.id).padStart(6, '0')}`,
        status: report.status,
      }));
  }, [feedView, incidents, reports]);

  const selectIncident = (incident, openModal = false) => {
    setFeedView('incidents');
    setSelectedIncidentId(incident.id);
    const anchor = incident.reports?.[0];
    if (anchor) {
      setSelectedId(anchor.id);
    }
    setFlyTrigger((v) => v + 1);
    if (openModal) {
      setAlarmReport(null);
      setModalOpen(true);
    }
  };

  const selectFlatReport = (report, openModal = false) => {
    setFeedView('reports');
    setSelectedId(report.id);
    setFlyTrigger((v) => v + 1);
    if (openModal) {
      setAlarmReport(null);
      setModalOpen(true);
    }
  };

  const handleMarkerClick = useCallback((marker) => {
    if (!marker) return;
    setError('');
    if (marker.incidentId != null) {
      const matchedIncident = incidents.find((item) => String(item.id) === String(marker.incidentId));
      if (matchedIncident) {
        setFeedView('incidents');
        setSelectedIncidentId(matchedIncident.id);
        const anchor = matchedIncident.reports?.[0];
        if (anchor) setSelectedId(anchor.id);
        setFlyTrigger((v) => v + 1);
        setAlarmReport(null);
        setModalOpen(true);
        return;
      }
    }

    const reportId = marker.reportId ?? marker.id;
    const matchedIncidentByReport = incidents.find((incident) =>
      incident.reports?.some((member) => String(member.id) === String(reportId))
    );
    if (feedView === 'incidents' && matchedIncidentByReport) {
      setSelectedIncidentId(matchedIncidentByReport.id);
      setSelectedId(reportId);
    } else {
      setSelectedId(reportId);
    }
    setFlyTrigger((v) => v + 1);
    setAlarmReport(null);
    setModalOpen(true);
  }, [incidents, feedView]);

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

  const updateActiveStatus = async (targetStatus) => {
    if (!focusedReport) return;
    setUpdating(true);
    setError('');
    try {
      if (isMainIncident && selectedIncident) {
        await apiRequest(`/incidents/${selectedIncident.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: targetStatus }),
        });
      } else {
        await apiRequest(`/reports/${focusedReport.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            data: {
              type: 'fire_report',
              attributes: { status: targetStatus },
            },
          }),
        });
      }
      await loadCommandCenter(false);
    } catch (requestError) {
      setError(requestError.message || 'Unable to update the incident status.');
    } finally {
      setUpdating(false);
    }
  };

  const handleReceiveReport = () => updateActiveStatus('accepted');
  const handleResolveIncident = () => updateActiveStatus('resolved');

  const dispatchResponse = async (event) => {
    event.preventDefault();
    if (!focusedReport || !truckId || !personnelId) return;

    setUpdating(true);
    setError('');
    try {
      const routeMinutes = Number(navigation.activeRoute?.durationMinutes);
      const fallbackEta = suggestArrivalMinutes(focusedReport?.latitude, focusedReport?.longitude);
      const computedEta = Number.isFinite(routeMinutes) && routeMinutes > 0
        ? Math.min(1440, Math.max(1, Math.round(routeMinutes)))
        : Math.min(1440, Math.max(1, Number(fallbackEta) || 10));

      await apiRequest(`/reports/${focusedReport.id}/dispatch`, {
        method: 'POST',
        body: JSON.stringify({
          truck_id: Number(truckId),
          personnel_id: Number(personnelId),
          estimated_eta_minutes: computedEta,
        }),
      });

      if (isMainIncident && selectedIncident) {
        await apiRequest(`/incidents/${selectedIncident.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'responding' }),
        });
      }

      setTruckId('');
      setPersonnelId('');
      await loadCommandCenter(false);
    } catch (requestError) {
      setError(requestError.message || 'Unable to dispatch the response unit.');
    } finally {
      setUpdating(false);
    }
  };

  // Determine the single modal's current workflow stage
  const modalStage = activeStatus === 'pending'
    ? 'request'
    : activeStatus === 'accepted'
      ? 'dispatch'
      : 'info';

  const renderSupportingReports = () => (
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
        const otherIncidents = incidents.filter((incident) => String(incident.id) !== String(selectedIncident?.id));
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
  );

  return (
    <div className='bfp-command-canvas'>
      {/* Full-size background map */}
      <div className='bfp-map-backdrop'>
        <GoogleMap
          markers={markers}
          selected={focusedReport}
          height='100%'
          flyTrigger={flyTrigger}
          allowFullscreen={false}
          zoomControlPosition='bottomright'
          title='Emergency Command Center Map'
          route={navigation.activeRoute?.geometry || null}
          routeDashed={navigation.activeRoute?.source === 'estimated'}
          routeFitToken={navigation.fitToken}
          responder={navigation.livePosition
            ? { ...navigation.livePosition, label: navigation.responderLabel }
            : null}
          onMarkerClick={handleMarkerClick}
        />
        {navigation.tracking && (
          <span className='route-navigation-live-badge bfp-canvas-live-badge' role='status'>
            <i aria-hidden='true' /> Live GPS
          </span>
        )}
      </div>

      {/* Floating Top HUD (Status counts + Connection) */}
      <div className={`bfp-floating-hud${sidebarOpen ? ' with-sidebar' : ''}`}>
        <div className='bfp-hud-counts' aria-label='Report counts by status'>
          {statusCounts.map(({ status, label, count }) => (
            <div className={`bfp-hud-pill status-${status}`} key={status}>
              <span className='bfp-hud-dot' aria-hidden='true' />
              <span className='bfp-hud-label'>{label}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
        <div className='bfp-hud-connection'>
          <span className='connection-indicator' />
          <span>{error ? 'Connection issue' : 'Connected'}</span>
        </div>
      </div>

      {error && (
        <div className={`bfp-floating-error${sidebarOpen ? ' with-sidebar' : ''}`} role='alert'>
          {error}
        </div>
      )}

      {/* Floating Left Sidebar: Active Alerts Feed on top layer of the map */}
      {sidebarOpen ? (
        <aside className='bfp-floating-sidebar' aria-label='Active Alerts Feed'>
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
                    setModalOpen(false);
                    setAlarmReport(target);
                    setFlyTrigger((v) => v + 1);
                    if (stopAlarmSoundRef.current) stopAlarmSoundRef.current();
                    stopAlarmSoundRef.current = playEmergencyAlarmSound();
                  }
                }}
                title='Test alarm notification & map zoom transition'
              >
                <span aria-hidden='true'>🚨</span> Test
              </button>
              <button
                type='button'
                className='bfp-icon-button'
                onClick={() => loadCommandCenter()}
                aria-label='Refresh reports'
                title='Refresh reports'
              >
                ↻
              </button>
              <button
                type='button'
                className='bfp-icon-button'
                onClick={() => setSidebarOpen(false)}
                aria-label='Collapse alerts sidebar'
                title='Hide alerts sidebar'
              >
                ◀
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
              ) : incidents.map((incident) => {
                const isSelected = String(incident.id) === String(selectedIncidentId);
                return (
                  <div
                    key={incident.id}
                    className={`bfp-alert-card bfp-incident-card${isSelected ? ' selected' : ''}`}
                    role='button'
                    tabIndex={0}
                    onClick={() => selectIncident(incident, false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        selectIncident(incident, false);
                      }
                    }}
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
                    <button
                      type='button'
                      className='bfp-card-open-btn'
                      onClick={(event) => {
                        event.stopPropagation();
                        selectIncident(incident, true);
                      }}
                    >
                      {incident.status === 'pending'
                        ? 'Inspect & Receive'
                        : incident.status === 'accepted'
                          ? 'Open Dispatch Form'
                          : 'View Dispatch Info'}
                    </button>
                  </div>
                );
              })
            ) : reports.length === 0 ? (
              <p className='bfp-empty-message'>No fire reports have been submitted.</p>
            ) : reports.map((report) => {
              const isSelected = String(report.id) === String(selectedId);
              return (
                <div
                  key={report.id}
                  className={`bfp-alert-card${isSelected ? ' selected' : ''}`}
                  role='button'
                  tabIndex={0}
                  onClick={() => selectFlatReport(report, false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectFlatReport(report, false);
                    }
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
                  <button
                    type='button'
                    className='bfp-card-open-btn'
                    onClick={(event) => {
                      event.stopPropagation();
                      selectFlatReport(report, true);
                    }}
                  >
                    {report.status === 'pending'
                      ? 'Inspect & Receive'
                      : report.status === 'accepted'
                        ? 'Open Dispatch Form'
                        : 'View Dispatch Info'}
                  </button>
                </div>
              );
            })}
          </div>
          <p className='bfp-panel-note'>Click any pin on the map to open the report &amp; dispatch modal.</p>
        </aside>
      ) : (
        <button
          type='button'
          className='bfp-sidebar-reopen-btn'
          onClick={() => setSidebarOpen(true)}
          aria-label='Show Active Alerts Feed'
        >
          ▶ Active Alerts ({feedView === 'incidents' ? incidents.length : reports.length})
        </button>
      )}

      {/* SINGLE Modal Form: transitions in-place across Report Request -> Dispatch Form -> Dispatch Info */}
      {modalOpen && focusedReport && !alarmReport && (
        <div
          className='bfp-modal-overlay'
          role='dialog'
          aria-modal='true'
          aria-labelledby='bfp-incident-modal-title'
          onClick={(event) => {
            if (event.target === event.currentTarget) setModalOpen(false);
          }}
        >
          <div className='bfp-incident-modal'>
            <div className='bfp-incident-modal-head'>
              <div className='bfp-incident-modal-title-wrap'>
                <div className='bfp-incident-modal-eyebrow-row'>
                  <p className='bfp-eyebrow'>
                    {isMainIncident
                      ? `Main Incident · ${selectedIncident.code}`
                      : `Incident Report · FA-${String(focusedReport.id).padStart(6, '0')}`}
                  </p>
                  <span className={`bfp-status-badge status-${activeStatus}`}>
                    <i /> {STATUS_LABELS[activeStatus] || activeStatus}
                  </span>
                </div>
                <h2 id='bfp-incident-modal-title'>
                  {(isMainIncident ? selectedIncident.incidentAddress : focusedReport.incidentAddress) || 'Location not provided'}
                </h2>
              </div>
              <button
                type='button'
                className='bfp-modal-close-btn'
                onClick={() => setModalOpen(false)}
                aria-label='Close modal'
              >
                ✕
              </button>
            </div>

            {/* 3-Step Flow Indicator inside the single modal */}
            <div className='bfp-modal-stepper' aria-label='Response workflow progress'>
              <div className={`bfp-step${modalStage === 'request' ? ' is-active' : ' is-done'}`}>
                <span className='bfp-step-num'>{modalStage === 'request' ? '1' : '✓'}</span>
                <span>Report Request</span>
              </div>
              <span className='bfp-step-line' aria-hidden='true' />
              <div className={`bfp-step${modalStage === 'dispatch' ? ' is-active' : modalStage === 'info' ? ' is-done' : ''}`}>
                <span className='bfp-step-num'>{modalStage === 'info' ? '✓' : '2'}</span>
                <span>Dispatch Unit</span>
              </div>
              <span className='bfp-step-line' aria-hidden='true' />
              <div className={`bfp-step${modalStage === 'info' ? ' is-active' : ''}`}>
                <span className='bfp-step-num'>3</span>
                <span>Dispatch Info</span>
              </div>
            </div>

            <div className='bfp-incident-modal-body'>
              {error && <div className='bfp-error' role='alert'>{error}</div>}

              {/* STAGE 1: Report Request Info + Receive Button */}
              {modalStage === 'request' && (
                <div className='bfp-modal-stage'>
                  <div className='bfp-incident-meta'>
                    {isMainIncident ? (
                      <>
                        <div><span>FIRST REPORT</span><strong>{formatDate(selectedIncident.firstReportedAt)}</strong></div>
                        <div><span>LATEST REPORT</span><strong>{formatDate(selectedIncident.lastReportedAt)}</strong></div>
                        <div><span>SUPPORTING REPORTS</span><strong>{selectedIncident.reportCount}</strong></div>
                      </>
                    ) : (
                      <>
                        <div><span>REPORTED</span><strong>{formatDate(focusedReport.reportedAt || focusedReport.createdAt)}</strong></div>
                        <div><span>LOCATION SOURCE</span><strong>{focusedReport.locationSource || 'Not provided'}</strong></div>
                        <div><span>COORDINATES</span><strong>{focusedReport.latitude != null && focusedReport.longitude != null ? `${focusedReport.latitude}, ${focusedReport.longitude}` : 'Unavailable'}</strong></div>
                      </>
                    )}
                  </div>

                  {!isMainIncident && (
                    <div className='bfp-request-reporter'>
                      <span>REPORTED BY</span>
                      <strong>{focusedReport.residentName || 'Resident details unavailable'}</strong>
                    </div>
                  )}

                  <div className='bfp-description'>
                    <h3>Incident information</h3>
                    <p>
                      {(isMainIncident ? selectedIncident.incidentDescription : focusedReport.incidentDescription)
                        || 'No incident description provided.'}
                    </p>
                  </div>

                  {focusedReport.hasEvidence && (
                    <EvidencePreview key={focusedReport.id} reportId={focusedReport.id} />
                  )}

                  {isMainIncident && activeMembers.length > 0 && renderSupportingReports()}

                  <div className='bfp-modal-stage-footer'>
                    <p className='bfp-modal-hint'>
                      Review and verify the report details above, then click Receive to proceed to unit dispatch.
                    </p>
                    <button
                      type='button'
                      className='bfp-primary-button bfp-receive-btn'
                      disabled={updating}
                      onClick={handleReceiveReport}
                    >
                      {updating ? 'Receiving…' : 'Receive Report'}
                    </button>
                  </div>
                </div>
              )}

              {/* STAGE 2: Dispatch Fill-up (Fire Truck + BFP Personnel + En Route Button) */}
              {modalStage === 'dispatch' && (
                <div className='bfp-modal-stage'>
                  <div className='bfp-confirmation'>
                    <span aria-hidden='true'>✓</span>
                    <div>
                      <strong>
                        {isMainIncident
                          ? `Report received · Coordinating ${selectedIncident.code} (${selectedIncident.reportCount} report${selectedIncident.reportCount === 1 ? '' : 's'})`
                          : 'Report received · Ready for dispatch'}
                      </strong>
                      <small>Submitted {formatDate(focusedReport.reportedAt || focusedReport.createdAt)}</small>
                    </div>
                  </div>

                  <div className='bfp-description'>
                    <h3>Incident summary</h3>
                    <p>
                      {(isMainIncident ? selectedIncident.incidentDescription : focusedReport.incidentDescription)
                        || 'No incident description provided.'}
                    </p>
                  </div>

                  <form className='bfp-dispatch-form bfp-modal-dispatch-form' onSubmit={dispatchResponse}>
                    <label htmlFor='dispatch-truck'>Fire truck</label>
                    <select
                      id='dispatch-truck'
                      value={truckId}
                      onChange={(event) => setTruckId(event.target.value)}
                      required
                    >
                      <option value=''>Select an available unit</option>
                      {trucks.map((truck) => (
                        <option value={truck.truck_id} key={truck.truck_id}>
                          {truck.unit_name || truck.plate_number} · {truck.status || 'Status unknown'}
                        </option>
                      ))}
                    </select>

                    <label htmlFor='dispatch-personnel'>BFP personnel</label>
                    <select
                      id='dispatch-personnel'
                      value={personnelId}
                      onChange={(event) => setPersonnelId(event.target.value)}
                      required
                    >
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

                    <div className='bfp-modal-stage-footer'>
                      <p className='bfp-modal-hint'>
                        Submitting En Route automatically notifies the resident and opens live route tracking.
                      </p>
                      <button
                        className='bfp-primary-button bfp-enroute-btn'
                        type='submit'
                        disabled={updating || !truckId || !personnelId}
                      >
                        {updating ? 'Dispatching…' : 'En Route'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* STAGE 3: Dispatch Info (Remaining Route, Meta, Incident Info, Current Response Unit, Supporting Reports) */}
              {modalStage === 'info' && (
                <div className='bfp-modal-stage'>
                  <RouteNavigationPanel
                    navigation={navigation}
                    canTrack={Boolean(dispatchInfo)}
                  />

                  <div className='bfp-incident-meta'>
                    {isMainIncident ? (
                      <>
                        <div><span>FIRST REPORT</span><strong>{formatDate(selectedIncident.firstReportedAt)}</strong></div>
                        <div><span>LATEST REPORT</span><strong>{formatDate(selectedIncident.lastReportedAt)}</strong></div>
                        <div><span>RESPONSE STATUS</span><strong>{STATUS_LABELS[selectedIncident.status] || selectedIncident.status || 'Unknown'}</strong></div>
                      </>
                    ) : (
                      <>
                        <div><span>REPORTED</span><strong>{formatDate(focusedReport.reportedAt || focusedReport.createdAt)}</strong></div>
                        <div><span>LOCATION SOURCE</span><strong>{focusedReport.locationSource || 'Not provided'}</strong></div>
                        <div><span>RESPONSE STATUS</span><strong>{STATUS_LABELS[focusedReport.status] || focusedReport.status || 'Unknown'}</strong></div>
                      </>
                    )}
                  </div>

                  <div className='bfp-description'>
                    <h3>Incident information</h3>
                    <p>
                      {(isMainIncident ? selectedIncident.incidentDescription : focusedReport.incidentDescription)
                        || 'No incident description provided.'}
                    </p>
                  </div>

                  {focusedReport.hasEvidence && (
                    <EvidencePreview key={focusedReport.id} reportId={focusedReport.id} />
                  )}

                  {dispatchInfo && (
                    <div className='bfp-assignment-note'>
                      <strong>Current response unit</strong>
                      <p>
                        {dispatchInfo.unit_name || dispatchInfo.plate_number || 'Assigned vehicle'}
                        {' · '}
                        {dispatchInfo.personnel_name || 'Assigned personnel'}
                        {dispatchInfo.estimated_eta_minutes ? ` · ETA ${dispatchInfo.estimated_eta_minutes} min` : ''}
                      </p>
                      {dispatchInfo.current_location && (
                        <p className='bfp-live-location-note'>
                          Live GPS {Number(dispatchInfo.current_location.latitude).toFixed(5)}, {Number(dispatchInfo.current_location.longitude).toFixed(5)}
                          {' · '}updated {formatDate(dispatchInfo.location_updated_at)}
                        </p>
                      )}
                    </div>
                  )}

                  {!isMainIncident && focusedReport.incidentRecord && (
                    <div className='bfp-assignment-note'>
                      <strong>Incident record</strong>
                      <p>{focusedReport.incidentRecord.resolution_summary || focusedReport.incidentRecord.damage_assessment || 'An incident record is available.'}</p>
                      <p>Casualties: {focusedReport.incidentRecord.casualties_count ?? 'Not recorded'}</p>
                    </div>
                  )}

                  {isMainIncident && (
                    <>
                      {renderSupportingReports()}

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
                  )}

                  {activeStatus === 'responding' && (
                    <div className='bfp-modal-stage-footer'>
                      <button
                        type='button'
                        className='bfp-resolve-btn'
                        disabled={updating}
                        onClick={handleResolveIncident}
                      >
                        {updating ? 'Updating…' : 'Mark Incident Resolved'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Emergency Alarm Notification */}
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
                <p className='bfp-alarm-time' style={{ color: '#b5121f', fontWeight: 600 }}>📍 Map focused to this location (auto).</p>
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
                  setModalOpen(true);
                }}
              >
                <span aria-hidden='true'>🎯</span> Zoom &amp; Inspect Report
              </button>
              <button
                type='button'
                className='btn bfp-alarm-btn-ack'
                onClick={dismissAlarm}
              >
                Acknowledge &amp; Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
