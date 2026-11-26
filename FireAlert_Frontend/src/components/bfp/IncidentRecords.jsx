import React, { useCallback, useEffect, useMemo, useState } from 'react';
import GoogleMap from '../shared/GoogleMap';
import { apiRequest, normalizeReport } from '../../sharedApi';

const STATUS_LABELS = {
  pending: 'Report submitted',
  accepted: 'Report received',
  responding: 'En route',
  arrived: 'Arrived',
  resolved: 'Incident resolved',
  rejected: 'Rejected',
};

const ANALYTICS_STATUS_ORDER = ['pending', 'accepted', 'responding', 'arrived', 'resolved'];

const SEVERITY_LABELS = {
  large: 'Large',
  medium: 'Medium',
  small: 'Small',
  unspecified: 'Unspecified',
};

const SEVERITY_RANK = {
  large: 3,
  medium: 2,
  small: 1,
  unspecified: 0,
};

function toLocalDateKey(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function escapeCsvCell(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

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
    case 'responding':
      return 'responding';
    case 'arrived':
      return 'arrived';
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

function formatRef(id) {
  return `FA-${String(id).padStart(6, '0')}`;
}

function extractFireSeverity(report) {
  const explicit = String(report?.fireSeverity || '').trim().toLowerCase();
  if (explicit === 'small' || explicit === 'medium' || explicit === 'large') {
    return explicit;
  }
  const match = String(report?.incidentDescription || '').match(/estimated fire size:\s*(small|medium|large)/i);
  return match ? match[1].toLowerCase() : 'unspecified';
}

function extractAreaLabel(address) {
  const clean = String(address || '').trim();
  if (!clean) return 'Unspecified location';
  const brgyMatch = clean.match(/(?:brgy\.?|barangay|bry\.?)\s+([^,]+)/i);
  if (brgyMatch && brgyMatch[1]) {
    const name = brgyMatch[1].replace(/\s+mansalay.*$/i, '').trim();
    if (name) return `Brgy. ${name}`;
  }
  return clean;
}

function responseMinutesBetween(dispatchedAt, arrivedAt) {
  if (!dispatchedAt || !arrivedAt) return null;
  const start = new Date(dispatchedAt).getTime();
  const end = new Date(arrivedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.round((end - start) / 60000);
}

function hasIncidentDocumentation(report) {
  const record = report?.incidentRecord;
  if (!record) return false;
  return Boolean(
    record.record_id != null
    || String(record.damage_assessment || '').trim()
    || String(record.resolution_summary || '').trim(),
  );
}

export default function IncidentRecords({ onOpenCommand }) {
  const [reports, setReports] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [activeSection, setActiveSection] = useState('records');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [docFilter, setDocFilter] = useState('all');
  const [tableSearch, setTableSearch] = useState('');
  const [tableLocationFilter, setTableLocationFilter] = useState('all');
  const [tableDateFrom, setTableDateFrom] = useState('');
  const [tableDateTo, setTableDateTo] = useState('');
  const [tableStatusFilter, setTableStatusFilter] = useState('all');
  const [tableSort, setTableSort] = useState({ key: 'date', direction: 'desc' });
  const [tablePageSize, setTablePageSize] = useState(10);
  const [tablePage, setTablePage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [savingRecord, setSavingRecord] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
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
          dispatch: report.dispatch || null,
        }))
        : [];
      setStatuses(Array.isArray(payload?.data?.statuses) ? payload.data.statuses : []);
      setTrucks(Array.isArray(payload?.data?.trucks) ? payload.data.trucks : []);
      setPersonnel(Array.isArray(payload?.data?.personnel) ? payload.data.personnel : []);
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
    const text = `${report.id} ${formatRef(report.id)} ${report.incidentAddress || ''} ${report.incidentDescription || ''} ${report.residentName || ''}`.toLowerCase();
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
    setSaveSuccess('');
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

  const analytics = useMemo(() => {
    const total = reports.length;
    const statusCounts = {
      pending: 0,
      accepted: 0,
      responding: 0,
      arrived: 0,
      resolved: 0,
    };
    const severityCounts = {
      large: 0,
      medium: 0,
      small: 0,
      unspecified: 0,
    };
    const areaMap = new Map();
    const monthMap = new Map();

    let documentedCount = 0;
    let totalCasualties = 0;
    let archivedCount = 0;

    reports.forEach((report) => {
      const normalizedStatus = statusKey(report.status);
      if (Object.prototype.hasOwnProperty.call(statusCounts, normalizedStatus)) {
        statusCounts[normalizedStatus] += 1;
      }

      const severity = extractFireSeverity(report);
      severityCounts[severity] = (severityCounts[severity] || 0) + 1;

      if (hasIncidentDocumentation(report)) {
        documentedCount += 1;
      }
      if (report.incidentRecord?.archived_at) {
        archivedCount += 1;
      }
      totalCasualties += Math.max(0, Number(report.incidentRecord?.casualties_count || 0) || 0);

      const areaLabel = extractAreaLabel(report.incidentAddress);
      const areaKey = areaLabel.toLowerCase();
      const existingArea = areaMap.get(areaKey);
      if (existingArea) {
        existingArea.count += 1;
      } else {
        areaMap.set(areaKey, { label: areaLabel, count: 1 });
      }

      const rawDate = report.reportedAt || report.createdAt;
      if (rawDate) {
        const parsed = new Date(rawDate);
        if (!Number.isNaN(parsed.getTime())) {
          const monthKey = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
          const existingMonth = monthMap.get(monthKey);
          if (existingMonth) {
            existingMonth.count += 1;
          } else {
            monthMap.set(monthKey, {
              key: monthKey,
              label: parsed.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
              count: 1,
            });
          }
        }
      }
    });

    const resolved = statusCounts.resolved;
    const active = statusCounts.pending + statusCounts.accepted + statusCounts.responding + statusCounts.arrived;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    const documentationRate = total > 0 ? Math.round((documentedCount / total) * 100) : 0;

    const statusBreakdown = ANALYTICS_STATUS_ORDER.map((key) => ({
      key,
      label: STATUS_LABELS[key],
      count: statusCounts[key],
      pct: total > 0 ? Math.round((statusCounts[key] / total) * 100) : 0,
    }));

    const severityBreakdown = ['large', 'medium', 'small', 'unspecified'].map((key) => ({
      key,
      label: SEVERITY_LABELS[key],
      count: severityCounts[key],
      pct: total > 0 ? Math.round((severityCounts[key] / total) * 100) : 0,
    }));

    const topAreasRaw = Array.from(areaMap.values())
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 6);
    const maxAreaCount = topAreasRaw[0]?.count || 1;
    const topAreas = topAreasRaw.map((area) => ({
      ...area,
      pct: Math.round((area.count / maxAreaCount) * 100),
    }));

    const monthlyRaw = Array.from(monthMap.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-6);
    const maxMonthCount = Math.max(1, ...monthlyRaw.map((item) => item.count));
    const monthlyTrend = monthlyRaw.map((item) => ({
      ...item,
      heightPct: Math.max(18, Math.round((item.count / maxMonthCount) * 100)),
    }));

    const dispatchedReports = reports.filter((report) => Boolean(report.dispatch));
    const arrivedCount = dispatchedReports.filter(
      (report) => Boolean(report.dispatch?.arrived_at) || report.status === 'arrived' || report.status === 'resolved',
    ).length;

    const etaValues = dispatchedReports
      .map((report) => Number(report.dispatch?.estimated_eta_minutes))
      .filter((value) => Number.isFinite(value) && value > 0);
    const avgEtaMinutes = etaValues.length > 0
      ? Math.round(etaValues.reduce((sum, val) => sum + val, 0) / etaValues.length)
      : null;

    const responseDurations = dispatchedReports
      .map((report) => responseMinutesBetween(report.dispatch?.dispatched_at, report.dispatch?.arrived_at))
      .filter((value) => value !== null);
    const avgResponseMinutes = responseDurations.length > 0
      ? Math.round(responseDurations.reduce((sum, val) => sum + val, 0) / responseDurations.length)
      : null;

    const availableTrucks = trucks.filter((truck) => {
      const value = String(truck?.status || '').toLowerCase();
      return value.includes('available') || value.includes('ready');
    }).length;

    return {
      total,
      resolved,
      active,
      resolutionRate,
      documentedCount,
      pendingDocCount: Math.max(0, total - documentedCount),
      documentationRate,
      totalCasualties,
      archivedCount,
      statusBreakdown,
      severityBreakdown,
      topAreas,
      monthlyTrend,
      dispatchedReports,
      arrivedCount,
      avgEtaMinutes,
      avgResponseMinutes,
      availableTrucks,
    };
  }, [reports, trucks]);

  const availableLocations = useMemo(() => {
    const map = new Map();
    reports.forEach((report) => {
      const area = extractAreaLabel(report.incidentAddress);
      const key = area.toLowerCase();
      if (!map.has(key)) map.set(key, area);
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [reports]);

  useEffect(() => {
    setTablePage(1);
  }, [tableSearch, tableLocationFilter, tableDateFrom, tableDateTo, tableStatusFilter, docFilter, tablePageSize]);

  const dataTableReports = useMemo(() => {
    const query = tableSearch.trim().toLowerCase();
    const filtered = reports.filter((report) => {
      if (query) {
        const haystack = [
          report.id,
          formatRef(report.id),
          report.incidentAddress,
          extractAreaLabel(report.incidentAddress),
          report.incidentDescription,
          report.residentName,
          report.dispatch?.unit_name,
          report.dispatch?.plate_number,
          report.dispatch?.personnel_name,
          report.incidentRecord?.damage_assessment,
          report.incidentRecord?.resolution_summary,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      if (tableLocationFilter !== 'all') {
        const area = extractAreaLabel(report.incidentAddress).toLowerCase();
        if (area !== tableLocationFilter.toLowerCase()) return false;
      }

      if (tableDateFrom || tableDateTo) {
        const dateKey = toLocalDateKey(report.reportedAt || report.createdAt);
        if (!dateKey) return false;
        if (tableDateFrom && dateKey < tableDateFrom) return false;
        if (tableDateTo && dateKey > tableDateTo) return false;
      }

      if (tableStatusFilter !== 'all' && statusKey(report.status) !== tableStatusFilter) {
        return false;
      }

      if (docFilter === 'documented' && !hasIncidentDocumentation(report)) return false;
      if (docFilter === 'pending' && hasIncidentDocumentation(report)) return false;

      return true;
    });

    const factor = tableSort.direction === 'asc' ? 1 : -1;
    return filtered.slice().sort((a, b) => {
      switch (tableSort.key) {
        case 'id':
          return (Number(a.id) - Number(b.id)) * factor;
        case 'location':
          return extractAreaLabel(a.incidentAddress).localeCompare(extractAreaLabel(b.incidentAddress)) * factor;
        case 'severity':
          return ((SEVERITY_RANK[extractFireSeverity(a)] || 0) - (SEVERITY_RANK[extractFireSeverity(b)] || 0)) * factor;
        case 'status':
          return (STATUS_LABELS[statusKey(a.status)] || '').localeCompare(STATUS_LABELS[statusKey(b.status)] || '') * factor;
        case 'casualties':
          return ((Number(a.incidentRecord?.casualties_count || 0) || 0) - (Number(b.incidentRecord?.casualties_count || 0) || 0)) * factor;
        case 'date':
        default: {
          const timeA = new Date(a.reportedAt || a.createdAt || 0).getTime() || 0;
          const timeB = new Date(b.reportedAt || b.createdAt || 0).getTime() || 0;
          return (timeA - timeB) * factor;
        }
      }
    });
  }, [reports, tableSearch, tableLocationFilter, tableDateFrom, tableDateTo, tableStatusFilter, docFilter, tableSort]);

  const dataTableSummary = useMemo(() => ({
    showing: dataTableReports.length,
    resolved: dataTableReports.filter((report) => statusKey(report.status) === 'resolved').length,
    documented: dataTableReports.filter((report) => hasIncidentDocumentation(report)).length,
    casualties: dataTableReports.reduce(
      (sum, report) => sum + Math.max(0, Number(report.incidentRecord?.casualties_count || 0) || 0),
      0,
    ),
  }), [dataTableReports]);

  const totalTablePages = tablePageSize === 0
    ? 1
    : Math.max(1, Math.ceil(dataTableReports.length / tablePageSize));
  const safeTablePage = Math.min(tablePage, totalTablePages);
  const paginatedTableReports = useMemo(() => {
    if (tablePageSize === 0) return dataTableReports;
    const start = (safeTablePage - 1) * tablePageSize;
    return dataTableReports.slice(start, start + tablePageSize);
  }, [dataTableReports, safeTablePage, tablePageSize]);

  const toggleTableSort = (key) => {
    setTableSort((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      const defaultDir = key === 'location' || key === 'status' ? 'asc' : 'desc';
      return { key, direction: defaultDir };
    });
  };

  const resetDataTableFilters = () => {
    setTableSearch('');
    setTableLocationFilter('all');
    setTableDateFrom('');
    setTableDateTo('');
    setTableStatusFilter('all');
    setDocFilter('all');
    setTablePage(1);
  };

  const exportDataTableCsv = () => {
    const headers = [
      'Incident Ref',
      'Date Reported',
      'Full Address',
      'Barangay / Area',
      'Reported By',
      'Description',
      'Fire Severity',
      'Response Status',
      'Fire Truck',
      'Plate Number',
      'Assigned Personnel',
      'Casualties',
      'Damage Assessment',
      'Resolution Summary',
      'Documentation Status',
      'Archived At',
    ];
    const rows = dataTableReports.map((report) => [
      formatRef(report.id),
      formatDate(report.reportedAt || report.createdAt),
      report.incidentAddress || '',
      extractAreaLabel(report.incidentAddress),
      report.residentName || '',
      report.incidentDescription || '',
      SEVERITY_LABELS[extractFireSeverity(report)] || 'Unspecified',
      STATUS_LABELS[statusKey(report.status)] || report.status || '',
      report.dispatch?.unit_name || '',
      report.dispatch?.plate_number || '',
      report.dispatch?.personnel_name || '',
      Number(report.incidentRecord?.casualties_count ?? 0),
      report.incidentRecord?.damage_assessment || '',
      report.incidentRecord?.resolution_summary || '',
      hasIncidentDocumentation(report) ? 'Documented' : 'Pending',
      report.incidentRecord?.archived_at ? formatDate(report.incidentRecord.archived_at) : '',
    ]);
    const csv = [headers, ...rows]
      .map((line) => line.map(escapeCsvCell).join(','))
      .join('\n');
    if (typeof window === 'undefined' || typeof URL.createObjectURL !== 'function') return;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'firealert-incident-records.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const saveIncidentRecord = async (event) => {
    event.preventDefault();
    if (!selectedReport) return;

    setSavingRecord(true);
    setSaveSuccess('');
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
      setSaveSuccess(`Saved record for ${formatRef(selectedReport.id)}.`);
    } catch (requestError) {
      setError(requestError.message || 'Unable to save the incident record.');
    } finally {
      setSavingRecord(false);
    }
  };

  const inspectReportInRecords = (reportId) => {
    setSelectedId(reportId);
    setSearch('');
    setStatusFilter('all');
    setActiveSection('records');
  };

  const jumpToFilteredRecords = ({ nextStatus = 'all', nextSearch = '' }) => {
    setStatusFilter(nextStatus);
    setSearch(nextSearch);
    setActiveSection('records');
  };

  const markers = selectedReport?.latitude != null && selectedReport?.longitude != null
    ? [{ id: selectedReport.id, lat: selectedReport.latitude, lng: selectedReport.longitude }]
    : [];
  const selectedSeverity = selectedReport ? extractFireSeverity(selectedReport) : 'unspecified';

  return (
    <div className='bfp-records-workspace'>
      <aside className='bfp-records-sidebar'>
        <div className='bfp-records-sidebar-title'>
          <span>BFP MANSALAY</span>
          <strong>Incident Workspace</strong>
        </div>

        <nav className='bfp-records-nav' aria-label='Incident records sections'>
          <button
            type='button'
            className={activeSection === 'records' ? 'active' : ''}
            onClick={() => setActiveSection('records')}
          >
            <span className='bfp-records-nav-icon' aria-hidden='true'>▤</span>
            <span className='bfp-records-nav-label'>Incident Records</span>
            <span className='bfp-records-nav-badge'>{analytics.total}</span>
          </button>

          <button
            type='button'
            className={activeSection === 'analytics' ? 'active' : ''}
            onClick={() => setActiveSection('analytics')}
          >
            <span className='bfp-records-nav-icon' aria-hidden='true'>◔</span>
            <span className='bfp-records-nav-label'>Analytics Dashboard</span>
            <span className='bfp-records-nav-badge'>{analytics.resolutionRate}%</span>
          </button>

          <button
            type='button'
            className={activeSection === 'documentation' ? 'active' : ''}
            onClick={() => setActiveSection('documentation')}
          >
            <span className='bfp-records-nav-icon' aria-hidden='true'>⊞</span>
            <span className='bfp-records-nav-label'>Incident Data Table</span>
            <span className='bfp-records-nav-badge'>{analytics.total}</span>
          </button>

          <button
            type='button'
            className={activeSection === 'dispatches' ? 'active' : ''}
            onClick={() => setActiveSection('dispatches')}
          >
            <span className='bfp-records-nav-icon' aria-hidden='true'>🚒</span>
            <span className='bfp-records-nav-label'>Dispatches &amp; Units</span>
            <span className='bfp-records-nav-badge'>{analytics.dispatchedReports.length}</span>
          </button>
        </nav>

        <div className='bfp-records-sidebar-summary'>
          <p className='bfp-records-sidebar-caption'>LIVE STATION SNAPSHOT</p>
          <div>
            <span>Active incidents</span>
            <strong>{analytics.active}</strong>
          </div>
          <div>
            <span>Resolved cases</span>
            <strong>{analytics.resolved}</strong>
          </div>
          <div>
            <span>Total casualties</span>
            <strong>{analytics.totalCasualties}</strong>
          </div>
          <div>
            <span>Units available</span>
            <strong>{trucks.length > 0 ? `${analytics.availableTrucks}/${trucks.length}` : '0'}</strong>
          </div>
          <div>
            <span>Duty personnel</span>
            <strong>{personnel.length}</strong>
          </div>
        </div>

        <div className='bfp-records-sidebar-footer'>
          {onOpenCommand && (
            <button type='button' className='bfp-sidebar-command-btn' onClick={onOpenCommand}>
              Open Command Center
            </button>
          )}
          <span className='bfp-sidebar-access-note'>♧ Authorized BFP access only</span>
        </div>
      </aside>

      <div className='bfp-records-content'>
        {error && <div className='bfp-error' role='alert'>{error}</div>}

        {activeSection === 'records' && (
          <>
            <div className='bfp-records-header'>
              <div>
                <p className='bfp-eyebrow'>BFP Mansalay</p>
                <h1>Incident Records</h1>
                <p>Search reports, review scene details, and archive post-incident documentation.</p>
              </div>
              <div className='bfp-records-header-actions'>
                <button
                  type='button'
                  className='bfp-secondary-button'
                  onClick={() => setActiveSection('analytics')}
                >
                  View Analytics Dashboard
                </button>
                <button type='button' className='bfp-secondary-button' onClick={loadReports}>
                  ↻ Refresh
                </button>
              </div>
            </div>

            <section className='bfp-records-kpis' aria-label='Incident summary metrics'>
              <article className='bfp-kpi-card'>
                <span>Total Incidents</span>
                <strong>{analytics.total}</strong>
                <small>{analytics.archivedCount} archived records</small>
              </article>
              <article className='bfp-kpi-card accent-green'>
                <span>Resolved</span>
                <strong>{analytics.resolved}</strong>
                <small>{analytics.resolutionRate}% resolution rate</small>
              </article>
              <article className='bfp-kpi-card accent-amber'>
                <span>Active / Ongoing</span>
                <strong>{analytics.active}</strong>
                <small>{analytics.dispatchedReports.length} dispatched</small>
              </article>
              <article className='bfp-kpi-card accent-red'>
                <span>Total Casualties</span>
                <strong>{analytics.totalCasualties}</strong>
                <small>{analytics.documentedCount} of {analytics.total} documented</small>
              </article>
            </section>

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
                  <button
                    type='button'
                    className='bfp-text-button'
                    onClick={() => { setSearch(''); setStatusFilter('all'); }}
                  >
                    Reset filters
                  </button>
                </div>

                <div className='bfp-table-heading'>
                  <div>
                    <h2>Reported incidents</h2>
                    <span>{filteredReports.length} records</span>
                  </div>
                  <button
                    type='button'
                    className='bfp-icon-button'
                    onClick={loadReports}
                    aria-label='Refresh incident records'
                  >
                    ↻
                  </button>
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
                      ) : filteredReports.map((report) => {
                        const rowSeverity = extractFireSeverity(report);
                        const isDocumented = hasIncidentDocumentation(report);
                        return (
                          <tr
                            key={report.id}
                            className={String(report.id) === String(selectedReport?.id) ? 'selected' : ''}
                            onClick={() => setSelectedId(report.id)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') setSelectedId(report.id);
                            }}
                            tabIndex={0}
                          >
                            <td className='reference-id'>
                              <span>{formatRef(report.id)}</span>
                              {isDocumented && <small className='bfp-inline-doc-tag'>Recorded</small>}
                            </td>
                            <td>
                              <strong>{report.incidentAddress || 'Location unavailable'}</strong>
                              <small>
                                {report.residentName || 'Resident details unavailable'}
                                {rowSeverity !== 'unspecified' && (
                                  <span className={`bfp-severity-tag severity-${rowSeverity}`}>
                                    {' '}· {SEVERITY_LABELS[rowSeverity]} fire
                                  </span>
                                )}
                              </small>
                            </td>
                            <td>{formatDate(report.reportedAt || report.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}</td>
                            <td>
                              <span className={`bfp-status-badge status-${report.status || 'pending'}`}>
                                <i /> {STATUS_LABELS[report.status] || report.status || 'Unknown'}
                              </span>
                            </td>
                            <td className='table-arrow'>›</td>
                          </tr>
                        );
                      })}
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
                        <h2>{formatRef(selectedReport.id)}</h2>
                        <p>{selectedReport.incidentAddress || 'Location unavailable'}</p>
                      </div>
                      <span className={`bfp-status-badge status-${selectedReport.status || 'pending'}`}>
                        <i /> {STATUS_LABELS[selectedReport.status] || selectedReport.status || 'Unknown'}
                      </span>
                    </div>

                    <GoogleMap
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
                      {selectedSeverity !== 'unspecified' && (
                        <div className='detail-info-pair'><span>Fire severity</span><strong>{SEVERITY_LABELS[selectedSeverity]}</strong></div>
                      )}
                      {selectedReport.dispatch && (
                        <>
                          <div className='detail-info-pair'>
                            <span>Response unit</span>
                            <strong>
                              {selectedReport.dispatch.unit_name || 'Assigned truck'}
                              {selectedReport.dispatch.plate_number ? ` (${selectedReport.dispatch.plate_number})` : ''}
                            </strong>
                          </div>
                          <div className='detail-info-pair'>
                            <span>Assigned personnel</span>
                            <strong>{selectedReport.dispatch.personnel_name || 'Duty officer'}</strong>
                          </div>
                        </>
                      )}
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
                      {saveSuccess && <p className='bfp-save-success' role='status'>{saveSuccess}</p>}
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
          </>
        )}

        {activeSection === 'analytics' && (
          <>
            <div className='bfp-records-header'>
              <div>
                <p className='bfp-eyebrow'>Incident Intelligence</p>
                <h1>Incident Analytics Dashboard</h1>
                <p>Operational overview of fire reports, response performance, severity, and impacted barangays.</p>
              </div>
              <div className='bfp-records-header-actions'>
                <button type='button' className='bfp-secondary-button' onClick={loadReports}>
                  ↻ Refresh data
                </button>
                <button
                  type='button'
                  className='bfp-secondary-button'
                  onClick={() => setActiveSection('records')}
                >
                  Open Records Table
                </button>
              </div>
            </div>

            <section className='bfp-analytics-kpis' aria-label='Detailed incident analytics'>
              <article className='bfp-kpi-card'>
                <span>Total Incidents</span>
                <strong>{analytics.total}</strong>
                <small>All reported incidents</small>
              </article>
              <article className='bfp-kpi-card accent-green'>
                <span>Resolution Rate</span>
                <strong>{analytics.resolutionRate}%</strong>
                <small>{analytics.resolved} resolved cases</small>
              </article>
              <article className='bfp-kpi-card accent-amber'>
                <span>Active Incidents</span>
                <strong>{analytics.active}</strong>
                <small>Pending, en route, or arrived</small>
              </article>
              <article className='bfp-kpi-card accent-red'>
                <span>Total Casualties</span>
                <strong>{analytics.totalCasualties}</strong>
                <small>Logged across incident records</small>
              </article>
              <article className='bfp-kpi-card accent-navy'>
                <span>Documentation</span>
                <strong>{analytics.documentationRate}%</strong>
                <small>{analytics.documentedCount} of {analytics.total} completed</small>
              </article>
            </section>

            <div className='bfp-analytics-grid'>
              <section className='bfp-panel bfp-analytics-card'>
                <div className='bfp-analytics-card-head'>
                  <div>
                    <h2>Response Status Distribution</h2>
                    <p>Click a stage to filter matching incident reports.</p>
                  </div>
                </div>
                <div className='bfp-bar-list'>
                  {analytics.statusBreakdown.map((item) => (
                    <button
                      type='button'
                      key={item.key}
                      className='bfp-bar-row'
                      onClick={() => jumpToFilteredRecords({ nextStatus: item.key, nextSearch: '' })}
                    >
                      <div className='bfp-bar-row-meta'>
                        <span>{item.label}</span>
                        <strong>{item.count} ({item.pct}%)</strong>
                      </div>
                      <div className='bfp-bar-track'>
                        <div
                          className={`bfp-bar-fill fill-${item.key}`}
                          style={{ width: `${item.count > 0 ? Math.max(4, item.pct) : 0}%` }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              <section className='bfp-panel bfp-analytics-card'>
                <div className='bfp-analytics-card-head'>
                  <div>
                    <h2>Monthly Incident Trend</h2>
                    <p>Recent reported volume across the last {Math.max(1, analytics.monthlyTrend.length)} active month(s).</p>
                  </div>
                </div>
                {analytics.monthlyTrend.length === 0 ? (
                  <p className='bfp-analytics-empty'>No dated incident reports available yet.</p>
                ) : (
                  <div className='bfp-month-chart' role='list' aria-label='Monthly incident counts'>
                    {analytics.monthlyTrend.map((month) => (
                      <div className='bfp-month-col' key={month.key} role='listitem'>
                        <span className='bfp-month-count'>{month.count}</span>
                        <div className='bfp-month-bar-wrap'>
                          <div className='bfp-month-bar' style={{ height: `${month.heightPct}%` }} />
                        </div>
                        <span className='bfp-month-label'>{month.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className='bfp-panel bfp-analytics-card'>
                <div className='bfp-analytics-card-head'>
                  <div>
                    <h2>Top Affected Barangays / Areas</h2>
                    <p>Click an area to filter records by location.</p>
                  </div>
                </div>
                {analytics.topAreas.length === 0 ? (
                  <p className='bfp-analytics-empty'>No location records available yet.</p>
                ) : (
                  <div className='bfp-bar-list'>
                    {analytics.topAreas.map((area) => (
                      <button
                        type='button'
                        key={area.label}
                        className='bfp-bar-row'
                        onClick={() => jumpToFilteredRecords({ nextStatus: 'all', nextSearch: area.label })}
                      >
                        <div className='bfp-bar-row-meta'>
                          <span>{area.label}</span>
                          <strong>{area.count} report{area.count === 1 ? '' : 's'}</strong>
                        </div>
                        <div className='bfp-bar-track'>
                          <div className='bfp-bar-fill fill-area' style={{ width: `${area.pct}%` }} />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className='bfp-panel bfp-analytics-card'>
                <div className='bfp-analytics-card-head'>
                  <div>
                    <h2>Fire Severity &amp; Response Performance</h2>
                    <p>Estimated fire scale and field dispatch timing metrics.</p>
                  </div>
                </div>
                <div className='bfp-severity-grid'>
                  {analytics.severityBreakdown.map((item) => (
                    <div key={item.key} className={`bfp-severity-tile severity-${item.key}`}>
                      <span>{item.label}</span>
                      <strong>{item.count}</strong>
                      <small>{item.pct}% of total</small>
                    </div>
                  ))}
                </div>
                <div className='bfp-perf-strip'>
                  <div>
                    <span>Dispatched</span>
                    <strong>{analytics.dispatchedReports.length}</strong>
                  </div>
                  <div>
                    <span>Arrived</span>
                    <strong>{analytics.arrivedCount}</strong>
                  </div>
                  <div>
                    <span>Avg ETA</span>
                    <strong>{analytics.avgEtaMinutes !== null ? `${analytics.avgEtaMinutes} min` : '—'}</strong>
                  </div>
                  <div>
                    <span>Avg response</span>
                    <strong>{analytics.avgResponseMinutes !== null ? `${analytics.avgResponseMinutes} min` : '—'}</strong>
                  </div>
                </div>
              </section>
            </div>
          </>
        )}

        {activeSection === 'documentation' && (
          <>
            <div className='bfp-records-header'>
              <div>
                <p className='bfp-eyebrow'>Complete Incident Registry</p>
                <h1>Incident Data Table</h1>
                <p>Filter, sort, and export complete fire incident records by date, location, status, and documentation.</p>
              </div>
              <div className='bfp-records-header-actions'>
                <button type='button' className='bfp-secondary-button' onClick={exportDataTableCsv}>
                  ⤓ Export CSV
                </button>
                <button type='button' className='bfp-secondary-button' onClick={loadReports}>
                  ↻ Refresh
                </button>
              </div>
            </div>

            <section className='bfp-doc-pills' aria-label='Filtered data table summary'>
              <div className='bfp-doc-stat'>
                <span>Matching records</span>
                <strong>{dataTableSummary.showing} / {analytics.total}</strong>
              </div>
              <div className='bfp-doc-stat'>
                <span>Resolved in view</span>
                <strong>{dataTableSummary.resolved}</strong>
              </div>
              <div className='bfp-doc-stat'>
                <span>Documented in view</span>
                <strong>{dataTableSummary.documented}</strong>
              </div>
              <div className='bfp-doc-stat'>
                <span>Casualties in view</span>
                <strong>{dataTableSummary.casualties}</strong>
              </div>
            </section>

            <section className='bfp-panel bfp-datatable-panel'>
              <div className='bfp-datatable-toolbar'>
                <div className='bfp-datatable-filter-row'>
                  <label className='bfp-search bfp-datatable-search'>
                    <span aria-hidden='true'>⌕</span>
                    <input
                      type='search'
                      value={tableSearch}
                      onChange={(event) => setTableSearch(event.target.value)}
                      placeholder='Search ref, location, reporter, truck, damage, or summary'
                      aria-label='Search data table'
                    />
                  </label>

                  <label className='bfp-datatable-field'>
                    <span>Location</span>
                    <select
                      aria-label='Filter by location'
                      value={tableLocationFilter}
                      onChange={(event) => setTableLocationFilter(event.target.value)}
                    >
                      <option value='all'>All locations</option>
                      {availableLocations.map((loc) => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                  </label>

                  <label className='bfp-datatable-field'>
                    <span>Date from</span>
                    <input
                      type='date'
                      aria-label='Date from'
                      value={tableDateFrom}
                      onChange={(event) => setTableDateFrom(event.target.value)}
                    />
                  </label>

                  <label className='bfp-datatable-field'>
                    <span>Date to</span>
                    <input
                      type='date'
                      aria-label='Date to'
                      value={tableDateTo}
                      onChange={(event) => setTableDateTo(event.target.value)}
                    />
                  </label>

                  <label className='bfp-datatable-field'>
                    <span>Response status</span>
                    <select
                      aria-label='Filter by response status'
                      value={tableStatusFilter}
                      onChange={(event) => setTableStatusFilter(event.target.value)}
                    >
                      <option value='all'>All statuses</option>
                      {ANALYTICS_STATUS_ORDER.map((key) => (
                        <option key={key} value={key}>{STATUS_LABELS[key]}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className='bfp-datatable-subbar'>
                  <div className='bfp-doc-filter-group' role='group' aria-label='Filter documentation status'>
                    {[
                      { id: 'all', label: `All (${analytics.total})` },
                      { id: 'documented', label: `Documented (${analytics.documentedCount})` },
                      { id: 'pending', label: `Needs record (${analytics.pendingDocCount})` },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type='button'
                        className={`bfp-filter-pill${docFilter === tab.id ? ' active' : ''}`}
                        onClick={() => setDocFilter(tab.id)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type='button'
                    className='bfp-text-button'
                    onClick={resetDataTableFilters}
                  >
                    Reset filters
                  </button>
                </div>
              </div>

              <div className='bfp-table-wrap'>
                <table className='bfp-record-table bfp-datatable-table'>
                  <thead>
                    <tr>
                      {[
                        { key: 'id', label: 'Incident ref.' },
                        { key: 'date', label: 'Date reported' },
                        { key: 'location', label: 'Location' },
                        { key: null, label: 'Reported by' },
                        { key: 'severity', label: 'Incident & severity' },
                        { key: 'status', label: 'Response status' },
                        { key: null, label: 'Unit & responder' },
                        { key: 'casualties', label: 'Casualties' },
                        { key: null, label: 'Damage & resolution' },
                        { key: null, label: 'Action' },
                      ].map((col) => (
                        <th key={col.label}>
                          {col.key ? (
                            <button
                              type='button'
                              className={`bfp-sort-btn${tableSort.key === col.key ? ' active' : ''}`}
                              onClick={() => toggleTableSort(col.key)}
                            >
                              <span>{col.label}</span>
                              {tableSort.key === col.key && (
                                <span className='bfp-sort-indicator' aria-hidden='true'>
                                  {tableSort.direction === 'asc' ? '▲' : '▼'}
                                </span>
                              )}
                            </button>
                          ) : col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan='10' className='bfp-table-empty'>Loading incident records…</td></tr>
                    ) : paginatedTableReports.length === 0 ? (
                      <tr><td colSpan='10' className='bfp-table-empty'>No incident records match your current filters.</td></tr>
                    ) : paginatedTableReports.map((report) => {
                      const isDoc = hasIncidentDocumentation(report);
                      const casualties = Number(report.incidentRecord?.casualties_count ?? 0);
                      const rowSeverity = extractFireSeverity(report);
                      const normalizedStatus = statusKey(report.status);
                      return (
                        <tr key={report.id}>
                          <td className='reference-id'>
                            <span>{formatRef(report.id)}</span>
                            {report.incidentRecord?.archived_at && (
                              <small className='bfp-inline-doc-tag'>Archived</small>
                            )}
                          </td>
                          <td>
                            <strong>{formatDate(report.reportedAt || report.createdAt, { dateStyle: 'medium' })}</strong>
                            <small>{formatDate(report.reportedAt || report.createdAt, { timeStyle: 'short' })}</small>
                          </td>
                          <td>
                            <strong>{report.incidentAddress || 'Location unavailable'}</strong>
                            <small>{extractAreaLabel(report.incidentAddress)}</small>
                          </td>
                          <td>
                            <strong>{report.residentName || 'Unavailable'}</strong>
                            <small>{report.locationSource || 'Source unavailable'}</small>
                          </td>
                          <td>
                            <div className='bfp-datatable-clip'>
                              {report.incidentDescription || 'No description provided'}
                            </div>
                            <small className={`bfp-severity-tag severity-${rowSeverity}`}>
                              {SEVERITY_LABELS[rowSeverity]} fire
                            </small>
                          </td>
                          <td>
                            <span className={`bfp-status-badge status-${normalizedStatus || 'pending'}`}>
                              <i /> {STATUS_LABELS[normalizedStatus] || report.status || 'Unknown'}
                            </span>
                          </td>
                          <td>
                            {report.dispatch ? (
                              <>
                                <strong>{report.dispatch.unit_name || 'Assigned truck'}</strong>
                                <small>{report.dispatch.personnel_name || 'Duty officer'}</small>
                              </>
                            ) : (
                              <span className='bfp-datatable-muted'>Not dispatched</span>
                            )}
                          </td>
                          <td><strong>{casualties}</strong></td>
                          <td>
                            <div className='bfp-datatable-clip'>
                              {report.incidentRecord?.damage_assessment || 'No damage notes'}
                            </div>
                            <small className='bfp-datatable-clip'>
                              {report.incidentRecord?.resolution_summary || 'Pending resolution summary'}
                            </small>
                            <span className={`bfp-doc-badge ${isDoc ? 'documented' : 'pending'}`}>
                              {isDoc ? 'Documented' : 'Pending'}
                            </span>
                          </td>
                          <td>
                            <button
                              type='button'
                              className='bfp-table-action-btn'
                              onClick={() => inspectReportInRecords(report.id)}
                            >
                              Edit record
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className='bfp-datatable-footer'>
                <span>
                  {dataTableReports.length === 0
                    ? 'Showing 0 matching incidents'
                    : `Showing ${(safeTablePage - 1) * (tablePageSize || dataTableReports.length) + 1}–${Math.min(
                      safeTablePage * (tablePageSize || dataTableReports.length),
                      dataTableReports.length,
                    )} of ${dataTableReports.length} matching incident(s)`}
                </span>

                <div className='bfp-pagination'>
                  <label className='bfp-pagination-size'>
                    <span>Rows</span>
                    <select
                      aria-label='Rows per page'
                      value={tablePageSize}
                      onChange={(event) => setTablePageSize(Number(event.target.value))}
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={0}>All</option>
                    </select>
                  </label>
                  <button
                    type='button'
                    className='bfp-table-action-btn'
                    disabled={safeTablePage <= 1}
                    onClick={() => setTablePage((page) => Math.max(1, page - 1))}
                  >
                    Previous
                  </button>
                  <span>Page {safeTablePage} of {totalTablePages}</span>
                  <button
                    type='button'
                    className='bfp-table-action-btn'
                    disabled={safeTablePage >= totalTablePages}
                    onClick={() => setTablePage((page) => Math.min(totalTablePages, page + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            </section>
          </>
        )}

        {activeSection === 'dispatches' && (
          <>
            <div className='bfp-records-header'>
              <div>
                <p className='bfp-eyebrow'>Response Operations</p>
                <h1>Dispatches &amp; Response Units</h1>
                <p>Track fire truck deployments, assigned duty officers, arrival logs, and station readiness.</p>
              </div>
              <div className='bfp-records-header-actions'>
                <button type='button' className='bfp-secondary-button' onClick={loadReports}>
                  ↻ Refresh
                </button>
              </div>
            </div>

            <section className='bfp-panel records-panel bfp-dispatches-log-panel'>
              <div className='bfp-table-heading'>
                <div>
                  <h2>Dispatch Activity Log</h2>
                  <span>{analytics.dispatchedReports.length} dispatched incident(s)</span>
                </div>
              </div>
              <div className='bfp-table-wrap'>
                <table className='bfp-record-table'>
                  <thead>
                    <tr>
                      <th>Incident ref.</th>
                      <th>Location</th>
                      <th>Fire truck</th>
                      <th>Responder</th>
                      <th>Dispatched</th>
                      <th>Arrived</th>
                      <th>ETA</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.dispatchedReports.length === 0 ? (
                      <tr><td colSpan='8' className='bfp-table-empty'>No unit dispatches recorded yet.</td></tr>
                    ) : analytics.dispatchedReports.map((report) => (
                      <tr key={report.id}>
                        <td className='reference-id'>{formatRef(report.id)}</td>
                        <td>
                          <strong>{report.incidentAddress || 'Location unavailable'}</strong>
                          <small>{STATUS_LABELS[report.status] || report.status}</small>
                        </td>
                        <td>
                          <strong>{report.dispatch?.unit_name || 'Assigned truck'}</strong>
                          <small>{report.dispatch?.plate_number || 'No plate logged'}</small>
                        </td>
                        <td>{report.dispatch?.personnel_name || 'Duty officer'}</td>
                        <td>{formatDate(report.dispatch?.dispatched_at, { dateStyle: 'medium', timeStyle: 'short' })}</td>
                        <td>{report.dispatch?.arrived_at ? formatDate(report.dispatch.arrived_at, { dateStyle: 'medium', timeStyle: 'short' }) : 'Pending'}</td>
                        <td>{report.dispatch?.estimated_eta_minutes ? `${report.dispatch.estimated_eta_minutes} min` : '—'}</td>
                        <td>
                          <button
                            type='button'
                            className='bfp-table-action-btn'
                            onClick={() => inspectReportInRecords(report.id)}
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className='bfp-roster-grid'>
              <article className='bfp-panel bfp-roster-card'>
                <div className='bfp-analytics-card-head'>
                  <div>
                    <h2>Station Fire Trucks</h2>
                    <p>{analytics.availableTrucks} of {trucks.length} unit(s) marked ready/available</p>
                  </div>
                </div>
                {trucks.length === 0 ? (
                  <p className='bfp-analytics-empty'>No fire trucks registered in command center data.</p>
                ) : (
                  <ul className='bfp-roster-list'>
                    {trucks.map((truck) => (
                      <li key={truck.truck_id || truck.unit_name}>
                        <div>
                          <strong>{truck.unit_name}</strong>
                          <small>{truck.plate_number || 'Plate unavailable'}</small>
                        </div>
                        <span className='bfp-doc-badge documented'>{truck.status || 'Unknown'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>

              <article className='bfp-panel bfp-roster-card'>
                <div className='bfp-analytics-card-head'>
                  <div>
                    <h2>Duty Personnel Roster</h2>
                    <p>{personnel.length} active BFP responder(s)</p>
                  </div>
                </div>
                {personnel.length === 0 ? (
                  <p className='bfp-analytics-empty'>No BFP personnel loaded.</p>
                ) : (
                  <ul className='bfp-roster-list'>
                    {personnel.map((person) => (
                      <li key={person.user_id || person.personnel_id || person.full_name}>
                        <div>
                          <strong>{person.full_name}</strong>
                          <small>{person.rank_position || 'BFP Staff'}</small>
                        </div>
                        <span className='bfp-badge-pill'>{person.badge_number || 'Unbadged'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
