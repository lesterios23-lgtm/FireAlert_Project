import React, { useCallback, useEffect, useMemo, useState } from 'react';
import GoogleMap from '../shared/GoogleMap';
import { apiRequest } from '../../sharedApi';
import './AdminDashboard.css';

const SECTIONS = [
  { id: 'predictions', label: 'High-risk predictions', icon: '⌁' },
  { id: 'users', label: 'User management', icon: '♙' },
  { id: 'firetrucks', label: 'Firetruck management', icon: '▰' },
];

const USER_CATEGORIES = [
  { id: 'all', label: 'All accounts' },
  { id: 'bfp', label: 'BFP personnel' },
  { id: 'admin', label: 'Admins' },
  { id: 'resident', label: 'Residents' },
];

const EMPTY_USER = {
  name: '',
  contact_number: '',
  email: '',
  password: '',
  role: 'resident',
  badge_number: '',
  rank_position: '',
};

const EMPTY_TRUCK = {
  unit_name: '',
  plate_number: '',
  status: 'Available',
};

const DEFAULT_LOGIN_ATTEMPT_SETTINGS = {
  max_attempts: 5,
  lockout_minutes: 15,
};

export default function AdminDashboard({ embeddedSection = null, onDataChanged = null } = {}) {
  const [section, setSection] = useState('predictions');
  const activeSection = embeddedSection || section;
  const [dashboard, setDashboard] = useState({ users: [], firetrucks: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState(EMPTY_USER);
  const [userSearch, setUserSearch] = useState('');
  const [userCategory, setUserCategory] = useState('all');
  const [editingTruck, setEditingTruck] = useState(null);
  const [truckForm, setTruckForm] = useState(EMPTY_TRUCK);
  const [loginAttemptSettings, setLoginAttemptSettings] = useState(DEFAULT_LOGIN_ATTEMPT_SETTINGS);
  const [savingLoginSettings, setSavingLoginSettings] = useState(false);
  const [riskAnalysis, setRiskAnalysis] = useState(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskError, setRiskError] = useState('');
  const [selectedRiskArea, setSelectedRiskArea] = useState(null);
  const [riskPeriod, setRiskPeriod] = useState('365');
  const [riskDay, setRiskDay] = useState(0);

  const refresh = useCallback(async () => {
    setError('');
    try {
      const response = await apiRequest('/admin/dashboard');
      const data = response.data || {};
      setDashboard({
        ...data,
        users: data.users || [],
        firetrucks: data.firetrucks || [],
      });
      setLoginAttemptSettings({
        ...DEFAULT_LOGIN_ATTEMPT_SETTINGS,
        ...(data.login_attempt_settings || {}),
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRiskAnalysis = useCallback(async (period = riskPeriod, day = riskDay, forceRefresh = false) => {
    setRiskLoading(true);
    setRiskError('');
    try {
      const refreshQuery = forceRefresh ? '&refresh=1' : '';
      const response = await apiRequest(
        `/admin/high-risk-areas?period=${encodeURIComponent(period)}&day=${encodeURIComponent(day)}${refreshQuery}`
      );
      setRiskAnalysis(response.data || null);
      setSelectedRiskArea(null);
    } catch (requestError) {
      setRiskError(requestError.message || 'Unable to load high-risk analysis.');
    } finally {
      setRiskLoading(false);
    }
  }, [riskPeriod, riskDay]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (activeSection === 'predictions' && !riskAnalysis && !riskLoading && !riskError) {
      loadRiskAnalysis(riskPeriod, riskDay, false);
    }
  }, [activeSection, riskAnalysis, riskLoading, riskError, loadRiskAnalysis, riskPeriod, riskDay]);

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLocaleLowerCase();
    return dashboard.users.filter((user) => {
      const role = String(user.role_name || '').toLocaleLowerCase();
      const matchesCategory = userCategory === 'all'
        || (userCategory === 'bfp' && role === 'bfp staff')
        || (userCategory === 'admin' && role === 'system admin')
        || (userCategory === 'resident' && role === 'resident');
      const searchableText = [
        user.full_name,
        user.contact_number,
        user.email,
        user.role_name,
        user.badge_number,
        user.rank_position,
      ].filter(Boolean).join(' ').toLocaleLowerCase();

      return matchesCategory && (!query || searchableText.includes(query));
    });
  }, [dashboard.users, userCategory, userSearch]);

  async function submitUser(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    const payload = {
      name: userForm.name,
      contact_number: userForm.contact_number,
      email: userForm.email,
      role: userForm.role,
    };
    if (!editingUser) payload.password = userForm.password;
    if (userForm.role === 'bfp') {
      payload.personnel = {
        badge_number: userForm.badge_number,
        rank_position: userForm.rank_position,
      };
    }

    try {
      await apiRequest(editingUser ? `/admin/users/${editingUser.user_id}` : '/admin/users', {
        method: editingUser ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      setNotice(editingUser ? 'User account updated.' : 'User account created.');
      setEditingUser(null);
      setUserForm(EMPTY_USER);
      await refresh();
      onDataChanged?.();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function editUser(user) {
    setEditingUser(user);
    setUserForm({
      ...EMPTY_USER,
      name: user.full_name || '',
      contact_number: user.contact_number || '',
      email: user.email || '',
      role: user.role_name === 'BFP Staff' ? 'bfp' : 'resident',
      badge_number: user.badge_number || '',
      rank_position: user.rank_position || '',
    });
  }

  async function deleteUser(user) {
    if (!window.confirm(`Delete the account for ${user.full_name}?`)) return;
    setError('');
    setNotice('');
    try {
      await apiRequest(`/admin/users/${user.user_id}`, { method: 'DELETE' });
      setNotice('User account deleted.');
      await refresh();
      onDataChanged?.();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function submitTruck(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await apiRequest(editingTruck ? `/admin/firetrucks/${editingTruck.truck_id}` : '/admin/firetrucks', {
        method: editingTruck ? 'PATCH' : 'POST',
        body: JSON.stringify(truckForm),
      });
      setNotice(editingTruck ? 'Firetruck updated.' : 'Firetruck created.');
      setEditingTruck(null);
      setTruckForm(EMPTY_TRUCK);
      await refresh();
      onDataChanged?.();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteTruck(truck) {
    if (!window.confirm(`Delete ${truck.unit_name}?`)) return;
    setError('');
    setNotice('');
    try {
      await apiRequest(`/admin/firetrucks/${truck.truck_id}`, { method: 'DELETE' });
      setNotice('Firetruck deleted.');
      await refresh();
      onDataChanged?.();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function submitLoginAttemptSettings(event) {
    event.preventDefault();
    setSavingLoginSettings(true);
    setError('');
    setNotice('');
    try {
      const response = await apiRequest('/admin/login-attempt-settings', {
        method: 'PUT',
        body: JSON.stringify({
          max_attempts: Number(loginAttemptSettings.max_attempts),
          lockout_minutes: Number(loginAttemptSettings.lockout_minutes),
        }),
      });
      setLoginAttemptSettings({
        ...DEFAULT_LOGIN_ATTEMPT_SETTINGS,
        ...(response.data || {}),
      });
      setNotice('Login attempt security settings updated.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingLoginSettings(false);
    }
  }

  function renderUsers() {
    return (
      <>
      <section className='admin-panel admin-login-security-panel'>
        <div className='admin-panel-heading'>
          <div><h2>Login security</h2><p>Lock an account temporarily after repeated incorrect passwords.</p></div>
        </div>
        <form className='admin-form admin-login-security-form' onSubmit={submitLoginAttemptSettings}>
          <label>Failed attempts before lockout
            <input
              type='number'
              min='1'
              max='20'
              required
              value={loginAttemptSettings.max_attempts}
              onChange={(event) => setLoginAttemptSettings({ ...loginAttemptSettings, max_attempts: event.target.value })}
            />
          </label>
          <label>Lockout duration (minutes)
            <input
              type='number'
              min='1'
              max='1440'
              required
              value={loginAttemptSettings.lockout_minutes}
              onChange={(event) => setLoginAttemptSettings({ ...loginAttemptSettings, lockout_minutes: event.target.value })}
            />
          </label>
          <div className='admin-form-actions'>
            <button className='admin-primary-button' type='submit' disabled={savingLoginSettings}>
              {savingLoginSettings ? 'Saving...' : 'Save security settings'}
            </button>
          </div>
        </form>
      </section>
      <div className='admin-management-grid'>
        <section className='admin-panel'>
          <div className='admin-panel-heading'>
            <div><h2>{editingUser ? 'Edit account' : 'Add account'}</h2><p>Manage resident accounts and linked BFP personnel</p></div>
          </div>
          <form className='admin-form' onSubmit={submitUser}>
            <label>Full name<input required maxLength='150' value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} /></label>
            <label>Contact number<input required maxLength='20' value={userForm.contact_number} onChange={(event) => setUserForm({ ...userForm, contact_number: event.target.value })} /></label>
            <label>Email<input required type='email' value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} /></label>
            {!editingUser && <label>Password<input required type='password' minLength='8' autoComplete='new-password' value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} /></label>}
            <label>Account type
              <select value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}>
                <option value='resident'>Resident</option><option value='bfp'>BFP personnel / staff</option>
              </select>
            </label>
            {userForm.role === 'bfp' && (
              <>
                <label>Badge number<input required value={userForm.badge_number} onChange={(event) => setUserForm({ ...userForm, badge_number: event.target.value })} /></label>
                <label>Rank / position<input required value={userForm.rank_position} onChange={(event) => setUserForm({ ...userForm, rank_position: event.target.value })} /></label>
              </>
            )}
            <div className='admin-form-actions'>
              <button className='admin-primary-button' type='submit' disabled={saving}>{saving ? 'Saving...' : editingUser ? 'Save changes' : 'Create account'}</button>
              {editingUser && <button className='admin-secondary-button' type='button' onClick={() => { setEditingUser(null); setUserForm(EMPTY_USER); }}>Cancel</button>}
            </div>
          </form>
        </section>
        <section className='admin-panel'>
          <div className='admin-panel-heading'>
            <div><h2>Accounts</h2><p>{filteredUsers.length} of {dashboard.users.length} accounts</p></div>
          </div>
          <div className='admin-user-tools'>
            <label className='admin-user-search'>
              <span className='admin-sr-only'>Search accounts</span>
              <input
                type='search'
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder='Search name, email, badge, or contact'
              />
            </label>
            <div className='admin-user-categories' role='group' aria-label='Filter accounts by category'>
              {USER_CATEGORIES.map((category) => (
                <button
                  type='button'
                  key={category.id}
                  className={userCategory === category.id ? 'active' : ''}
                  aria-pressed={userCategory === category.id}
                  onClick={() => setUserCategory(category.id)}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>
          <div className='admin-table-wrap'>
            <table className='admin-table'>
              <thead><tr><th>Name</th><th>Role / personnel</th><th>Email</th><th>Actions</th></tr></thead>
              <tbody>{filteredUsers.map((user) => (
                <tr key={user.user_id}>
                  <td>{user.full_name}<small>{user.contact_number}</small></td>
                  <td>{user.role_name || 'Unknown'}{user.badge_number && <small>{user.rank_position} · {user.badge_number}</small>}</td>
                  <td>{user.email}</td>
                  <td className='admin-row-actions'>
                    {user.role_name !== 'System Admin' && <>
                      <button type='button' onClick={() => editUser(user)}>Edit</button>
                      <button className='admin-delete' type='button' onClick={() => deleteUser(user)}>Delete</button>
                    </>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
            {filteredUsers.length === 0 && (
              <p className='admin-empty'>No accounts match this search or category.</p>
            )}
          </div>
        </section>
      </div>
      </>
    );
  }

  function renderTrucks() {
    return (
      <div className='admin-management-grid'>
        <section className='admin-panel'>
          <div className='admin-panel-heading'><div><h2>{editingTruck ? 'Edit firetruck' : 'Add firetruck'}</h2><p>Manage vehicles and availability</p></div></div>
          <form className='admin-form' onSubmit={submitTruck}>
            <label>Unit name<input required value={truckForm.unit_name} onChange={(event) => setTruckForm({ ...truckForm, unit_name: event.target.value })} /></label>
            <label>Plate number<input required value={truckForm.plate_number} onChange={(event) => setTruckForm({ ...truckForm, plate_number: event.target.value })} /></label>
            <label>Status
              <select value={truckForm.status} onChange={(event) => setTruckForm({ ...truckForm, status: event.target.value })}>
                <option>Available</option><option>On Duty</option><option>Maintenance</option>
              </select>
            </label>
            <div className='admin-form-actions'>
              <button className='admin-primary-button' type='submit' disabled={saving}>{saving ? 'Saving...' : editingTruck ? 'Save changes' : 'Add firetruck'}</button>
              {editingTruck && <button className='admin-secondary-button' type='button' onClick={() => { setEditingTruck(null); setTruckForm(EMPTY_TRUCK); }}>Cancel</button>}
            </div>
          </form>
        </section>
        <section className='admin-panel'>
          <div className='admin-panel-heading'><div><h2>Firetruck fleet</h2><p>{dashboard.firetrucks.length} recorded units</p></div></div>
          <div className='admin-table-wrap'>
            <table className='admin-table'>
              <thead><tr><th>Unit</th><th>Plate</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{dashboard.firetrucks.map((truck) => (
                <tr key={truck.truck_id}>
                  <td>{truck.unit_name}</td><td>{truck.plate_number}</td><td>{truck.status}</td>
                  <td className='admin-row-actions'>
                    <button type='button' onClick={() => { setEditingTruck(truck); setTruckForm({ unit_name: truck.unit_name || '', plate_number: truck.plate_number || '', status: truck.status || 'Available' }); }}>Edit</button>
                    <button className='admin-delete' type='button' onClick={() => deleteTruck(truck)}>Delete</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  const sectionMeta = SECTIONS.find((item) => item.id === activeSection);
  const content = (
    <section className={embeddedSection ? 'admin-content admin-content-embedded' : 'admin-content'}>
      <header className='admin-content-heading'>
        <div>
          <span className='admin-eyebrow'>FIREALERT · ADMINISTRATION</span>
          <h1>{sectionMeta?.label}</h1>
          <p>
            {activeSection === 'predictions'
              ? 'Real-time daily and 7-day fire risk forecast across Mansalay barangays.'
              : 'Manage operational users, login security, and station firetrucks for BFP Mansalay.'}
          </p>
        </div>
        <button
          type='button'
          className='admin-refresh'
          onClick={() => {
            if (activeSection === 'predictions') {
              loadRiskAnalysis(riskPeriod, riskDay, true);
            } else {
              setLoading(true);
              refresh();
            }
          }}
        >
          Refresh data
        </button>
      </header>
      {error && <div className='admin-alert admin-alert-error' role='alert'>{error}</div>}
      {notice && <div className='admin-alert admin-alert-success' role='status'>{notice}</div>}
      {activeSection === 'predictions' ? (
        <HighRiskPredictionPanel
          analysis={riskAnalysis}
          loading={riskLoading}
          error={riskError}
          selectedArea={selectedRiskArea}
          onSelectArea={setSelectedRiskArea}
          period={riskPeriod}
          onPeriodChange={(value) => {
            setRiskPeriod(value);
            loadRiskAnalysis(value, riskDay, false);
          }}
          selectedDay={riskDay}
          onDayChange={(nextDay) => {
            setRiskDay(nextDay);
            loadRiskAnalysis(riskPeriod, nextDay, false);
          }}
          onRefresh={() => loadRiskAnalysis(riskPeriod, riskDay, true)}
        />
      ) : loading ? (
        <div className='admin-loading'>Loading database records...</div>
      ) : (
        <>
          {activeSection === 'users' && renderUsers()}
          {activeSection === 'firetrucks' && renderTrucks()}
        </>
      )}
    </section>
  );

  if (embeddedSection) {
    return content;
  }

  return (
    <div className='admin-dashboard'>
      <aside className='admin-sidebar'>
        <div className='admin-sidebar-title'><span>ADMINISTRATION</span><strong>System workspace</strong></div>
        <nav aria-label='System administration'>
          {SECTIONS.map((item) => (
            <button key={item.id} type='button' className={activeSection === item.id ? 'active' : ''} onClick={() => setSection(item.id)}>
              <span aria-hidden='true'>{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className='admin-sidebar-note'>Access is restricted to system administrators.</div>
      </aside>
      {content}
    </div>
  );
}

function StatCard({ label, value, tone, icon, hint }) {
  return (
    <article className={`admin-stat-card ${tone}`}>
      {icon && <span className='admin-stat-icon' aria-hidden='true'>{icon}</span>}
      <strong>{value}</strong>
      <span>{label}</span>
      {hint && <small className='admin-stat-hint'>{hint}</small>}
    </article>
  );
}

const RISK_PERIODS = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 365 days' },
  { value: 'all', label: 'All time' },
];

function riskTone(level) {
  const value = String(level || '').toLowerCase();
  if (value === 'high') return 'high';
  if (value === 'moderate') return 'moderate';
  return 'low';
}

function periodLabel(period) {
  return RISK_PERIODS.find((item) => item.value === String(period))?.label || 'Last 365 days';
}

function HighRiskPredictionPanel({
  analysis,
  loading,
  error,
  selectedArea,
  onSelectArea,
  onRefresh,
  period,
  onPeriodChange,
  selectedDay = 0,
  onDayChange,
}) {
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [heatmapSeason, setHeatmapSeason] = useState('dry');
  const [heatmapPoints, setHeatmapPoints] = useState([]);
  const [heatmapCount, setHeatmapCount] = useState(0);
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [heatmapError, setHeatmapError] = useState('');
  const [listFilter, setListFilter] = useState('high');

  useEffect(() => {
    if (!showHeatmap) {
      setHeatmapPoints([]);
      setHeatmapCount(0);
      setHeatmapError('');
      setHeatmapLoading(false);
      return undefined;
    }

    let cancelled = false;
    setHeatmapLoading(true);
    setHeatmapError('');

    apiRequest(`/admin/risk-heatmap?season=${encodeURIComponent(heatmapSeason)}`)
      .then((response) => {
        if (cancelled) return;
        const rows = Array.isArray(response?.data?.points) ? response.data.points : [];
        const mapped = rows
          .map((item) => [Number(item.latitude), Number(item.longitude), Number(item.intensity ?? 0.4)])
          .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
        setHeatmapPoints(mapped);
        setHeatmapCount(mapped.length);
      })
      .catch((requestError) => {
        if (cancelled) return;
        setHeatmapPoints([]);
        setHeatmapCount(0);
        setHeatmapError(requestError.message || 'Unable to load seasonal risk heatmap data.');
      })
      .finally(() => {
        if (!cancelled) setHeatmapLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showHeatmap, heatmapSeason, analysis?.generated_at]);

  if (loading) {
    return <div className='admin-loading'>Analyzing live weather forecast and incident records...</div>;
  }

  if (error) {
    return (
      <section className='admin-panel admin-prediction-state'>
        <div className='admin-prediction-icon' aria-hidden='true'>!</div>
        <h2>Unable to load analysis</h2>
        <p>{error}</p>
        <button type='button' className='admin-primary-button' onClick={onRefresh} style={{ marginTop: '1rem' }}>Try again</button>
      </section>
    );
  }

  const refBarangays = analysis?.reference_barangays || [];
  const dailyPredictions = Array.isArray(analysis?.daily_predictions) && analysis.daily_predictions.length > 0
    ? analysis.daily_predictions
    : refBarangays;

  if (!analysis || dailyPredictions.length === 0) {
    return (
      <section className='admin-panel admin-prediction-state'>
        <div className='admin-prediction-icon' aria-hidden='true'>!</div>
        <h2>No reference data</h2>
        <p>No barangay reference risk data is available. Run the database seeder to load the Mansalay reference barangays.</p>
      </section>
    );
  }

  const forecastDays = Array.isArray(analysis?.forecast_days) ? analysis.forecast_days : [];
  const activeDaySummary = forecastDays.find((d) => Number(d.day_index) === Number(selectedDay)) || null;
  const selectedDayLabel = activeDaySummary
    ? `${activeDaySummary.label}${activeDaySummary.date ? ` (${activeDaySummary.date})` : ''}`
    : (selectedDay === 0 ? 'Today' : `Day +${selectedDay}`);

  const highRiskLocations = Array.isArray(analysis?.high_risk_locations)
    ? analysis.high_risk_locations
    : dailyPredictions.filter((item) => (item.predicted_risk_level || item.reference_risk_level) === 'High');

  const visibleList = listFilter === 'high' ? highRiskLocations : dailyPredictions;

  const selected = (selectedArea && dailyPredictions.find((b) => b.barangay_name === selectedArea.barangay_name))
    || highRiskLocations[0]
    || dailyPredictions[0]
    || null;

  const selectedIsHighRisk = Boolean(
    selected && highRiskLocations.some((item) => item.barangay_name === selected.barangay_name)
  );
  const mapSelected = selectedIsHighRisk && selected.latitude != null && selected.longitude != null
    ? { latitude: Number(selected.latitude), longitude: Number(selected.longitude) }
    : null;

  // Map pins ONLY show predicted High-Risk zones for the selected day
  const markers = highRiskLocations
    .filter((b) => b.latitude != null && b.longitude != null)
    .map((b) => ({
      id: b.barangay_name,
      lat: Number(b.latitude),
      lng: Number(b.longitude),
      address: `${b.barangay_name} · HIGH RISK (${b.predicted_risk_score ?? '—'}/100)`,
    }));

  const liveHighRiskHeatPoints = highRiskLocations
    .filter((b) => b.latitude != null && b.longitude != null)
    .map((b) => [
      Number(b.latitude),
      Number(b.longitude),
      Math.min(1, Math.max(0.55, Number(b.predicted_risk_score || 70) / 100)),
    ]);

  const effectiveHeatPoints = showHeatmap ? heatmapPoints : liveHighRiskHeatPoints;
  const weatherReady = analysis?.weather_available !== false;
  const dayWeatherLabel = activeDaySummary && activeDaySummary.avg_temp_max != null
    ? `${activeDaySummary.avg_temp_max}°C · ${activeDaySummary.avg_precip_mm ?? 0} mm`
    : (weatherReady ? '—' : 'Offline');

  return (
    <div className='admin-risk-layout'>
      <div className='admin-stat-grid admin-risk-stats'>
        <StatCard
          label='Predicted high risk'
          value={String(highRiskLocations.length).padStart(2, '0')}
          tone={highRiskLocations.length > 0 ? 'amber' : 'navy'}
          icon='◍'
          hint={selectedDayLabel}
        />
        <StatCard
          label='Monitored areas'
          value={String(dailyPredictions.length).padStart(2, '0')}
          tone='navy'
          icon='▤'
          hint={weatherReady ? 'Live weather active' : 'Weather feed offline'}
        />
        <StatCard
          label='Historical incidents'
          value={String(analysis.total_incidents_analyzed || 0).padStart(2, '0')}
          tone='blue'
          icon='○'
          hint={periodLabel(analysis.period || period)}
        />
        <StatCard
          label='Day weather avg'
          value={dayWeatherLabel}
          tone='navy'
          icon='⌁'
          hint={activeDaySummary?.label || 'Selected forecast day'}
        />
      </div>

      <section className='admin-panel admin-risk-method'>
        <div className='admin-panel-heading admin-risk-heading'>
          <div>
            <h2>Daily &amp; 7-Day Fire Risk Prediction</h2>
            <p>
              Updated {formatDate(analysis.weather_fetched_at || analysis.generated_at)}
              {' · '}
              {analysis.weather_source || 'Open-Meteo'}
            </p>
          </div>
          <div className='admin-risk-controls'>
            <div className='admin-risk-period'>
              <label htmlFor='risk-period'>Period (historical)</label>
              <select id='risk-period' value={analysis.period || period} onChange={(event) => onPeriodChange(event.target.value)}>
                {RISK_PERIODS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <button type='button' className='admin-refresh' onClick={onRefresh}>Refresh live forecast</button>
          </div>
        </div>
        <p className='admin-risk-note'>{analysis.methodology}</p>
      </section>

      {forecastDays.length > 0 && (
        <section className='admin-panel admin-forecast-strip' aria-label='7-day fire risk forecast'>
          {forecastDays.map((dayItem) => {
            const isActive = Number(dayItem.day_index) === Number(selectedDay);
            const hasHigh = (dayItem.high_risk_count || 0) > 0;
            return (
              <button
                type='button'
                key={dayItem.day_index}
                className={`admin-forecast-day${isActive ? ' active' : ''}`}
                aria-pressed={isActive}
                onClick={() => onDayChange?.(dayItem.day_index)}
              >
                <span className='admin-forecast-day-label'>{dayItem.label}</span>
                <small className='admin-forecast-day-date'>{dayItem.date}</small>
                <span className='admin-forecast-day-weather'>
                  {dayItem.avg_temp_max != null ? `${dayItem.avg_temp_max}°C` : '—'}
                  {dayItem.avg_precip_mm != null ? ` · ${dayItem.avg_precip_mm} mm` : ''}
                </span>
                <span className={`admin-forecast-badge ${hasHigh ? 'has-high' : 'is-clear'}`}>
                  {dayItem.high_risk_count} High Risk
                </span>
              </button>
            );
          })}
        </section>
      )}

      <div className='admin-risk-grid'>
        <section className='admin-panel admin-risk-map-panel'>
          <div className='admin-panel-heading'>
            <div>
              <h2>High-risk zones map — {selectedDayLabel}</h2>
              <p>Only locations predicted as High Risk for this day are pinned on the map.</p>
            </div>
          </div>

          {highRiskLocations.length === 0 && (
            <div className='admin-risk-safe-banner' role='status'>
              <strong>No high-risk fire zones predicted for {selectedDayLabel}</strong>
              <span>Current and forecasted weather conditions keep all monitored areas below the High-Risk threshold.</span>
            </div>
          )}

          <div className='admin-heatmap-toolbar'>
            <div className='admin-heatmap-controls'>
              <label className='admin-heatmap-toggle' htmlFor='toggleRiskHeatmap'>
                <input
                  id='toggleRiskHeatmap'
                  type='checkbox'
                  checked={showHeatmap}
                  onChange={(event) => setShowHeatmap(event.target.checked)}
                />
                <span>Show Seasonal High-Risk Zones</span>
              </label>

              <select
                id='seasonFilter'
                aria-label='Seasonal heatmap filter'
                className='admin-heatmap-select'
                value={heatmapSeason}
                disabled={!showHeatmap}
                onChange={(event) => setHeatmapSeason(event.target.value)}
              >
                <option value='all'>All Seasons</option>
                <option value='dry'>Dry Season (Mar–May)</option>
                <option value='wet'>Wet Season (Jun–Nov)</option>
              </select>
            </div>

            {showHeatmap && (
              <div className='admin-heatmap-meta'>
                <div className='admin-heatmap-legend' aria-label='Seasonal heatmap risk legend'>
                  <span className='admin-heatmap-legend-title'>Risk Level:</span>
                  <span><i className='admin-heatmap-dot low' /> Low</span>
                  <span><i className='admin-heatmap-dot moderate' /> Moderate</span>
                  <span><i className='admin-heatmap-dot high' /> High Risk</span>
                </div>
                <span className={`admin-heatmap-status${heatmapError ? ' is-error' : ''}`} role='status'>
                  {heatmapLoading
                    ? 'Loading seasonal heatmap…'
                    : heatmapError
                      ? heatmapError
                      : heatmapCount === 0
                        ? 'No historical coordinates recorded for this season'
                        : `${heatmapCount} incident point${heatmapCount === 1 ? '' : 's'} plotted`}
                </span>
              </div>
            )}
          </div>
          <GoogleMap
            markers={markers}
            selected={mapSelected}
            heatmapPoints={effectiveHeatPoints}
            height='360px'
            title='High-Risk Location Prediction Map'
          />
          <div className='admin-risk-legend' aria-label='Risk level legend'>
            <span><i className='high' /> Predicted High Risk (pinned)</span>
            <span>{markers.length} high-risk pin{markers.length === 1 ? '' : 's'} shown on map</span>
          </div>
        </section>

        <section className='admin-panel admin-risk-list-panel'>
          <div className='admin-panel-heading'>
            <div>
              <h2>Predicted risk areas</h2>
              <p>Filter between High-Risk only or all monitored barangays</p>
            </div>
          </div>
          <div className='admin-risk-list-tabs' role='tablist' aria-label='Prediction list filter'>
            <button
              type='button'
              role='tab'
              aria-selected={listFilter === 'high'}
              className={listFilter === 'high' ? 'active' : ''}
              onClick={() => setListFilter('high')}
            >
              High Risk ({highRiskLocations.length})
            </button>
            <button
              type='button'
              role='tab'
              aria-selected={listFilter === 'all'}
              className={listFilter === 'all' ? 'active' : ''}
              onClick={() => setListFilter('all')}
            >
              All Monitored ({dailyPredictions.length})
            </button>
          </div>
          <div className='admin-risk-list'>
            {visibleList.length === 0 ? (
              <div className='admin-risk-empty'>
                <p>No barangays are predicted High Risk for {selectedDayLabel}.</p>
                <button type='button' className='admin-refresh' onClick={() => setListFilter('all')}>
                  View all monitored areas
                </button>
              </div>
            ) : visibleList.map((b) => {
              const hist = b.historical || { available: false };
              const level = b.predicted_risk_level || b.reference_risk_level || 'Low';
              const tone = riskTone(level);
              const weather = b.weather;
              return (
                <button
                  type='button'
                  key={b.barangay_name}
                  className={`admin-risk-item ${tone}${selected?.barangay_name === b.barangay_name ? ' selected' : ''}`}
                  onClick={() => onSelectArea(b)}
                >
                  <div className='admin-risk-item-head'>
                    <strong>{b.barangay_name}</strong>
                    <span className={`admin-risk-badge ${tone}`}>
                      {level}{b.predicted_risk_score != null ? ` · ${b.predicted_risk_score}/100` : ''}
                    </span>
                  </div>
                  <div className='admin-risk-item-meta'>
                    {weather ? (
                      <span>
                        {weather.temp_max_c != null ? `${weather.temp_max_c}°C` : '—'}
                        {' · '}
                        {weather.humidity_min_pct != null ? `${weather.humidity_min_pct}% RH` : '—'}
                        {' · '}
                        {weather.wind_max_kmh != null ? `${weather.wind_max_kmh} km/h` : '—'}
                        {' · '}
                        {weather.precipitation_mm != null ? `${weather.precipitation_mm} mm` : '0 mm'}
                      </span>
                    ) : (
                      <span>Ref: {b.reference_risk_level}</span>
                    )}
                    {hist.available && (
                      <span>{hist.incident_count} historical</span>
                    )}
                  </div>
                  <small>
                    {Array.isArray(b.reasons) && b.reasons.length > 0
                      ? b.reasons.slice(0, 2).join(' · ')
                      : (b.verification_status || 'Monitored area')}
                  </small>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {selected && (
        <section className='admin-panel' style={{ marginTop: '1rem' }}>
          <div className='admin-panel-heading'>
            <div>
              <h2>{selected.barangay_name}</h2>
              <p>
                {selectedDayLabel} · Predicted: {selected.predicted_risk_level || selected.reference_risk_level}
                {selected.predicted_risk_score != null ? ` (${selected.predicted_risk_score}/100)` : ''}
              </p>
            </div>
          </div>

          {selected.weather && (
            <div className='admin-weather-grid'>
              <div><span>Condition</span><strong>{selected.weather.condition_label}</strong></div>
              <div><span>Max Temp</span><strong>{selected.weather.temp_max_c ?? '—'}°C</strong></div>
              <div><span>Min Humidity</span><strong>{selected.weather.humidity_min_pct ?? '—'}%</strong></div>
              <div><span>Max Wind</span><strong>{selected.weather.wind_max_kmh ?? '—'} km/h</strong></div>
              <div><span>Rainfall</span><strong>{selected.weather.precipitation_mm ?? 0} mm</strong></div>
            </div>
          )}

          {Array.isArray(selected.reasons) && selected.reasons.length > 0 && (
            <div className='admin-risk-reasons'>
              <strong>Risk factors:</strong>
              <ul>
                {selected.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem', marginTop: '0.75rem' }}>
            <div><strong>Coordinates:</strong> {selected.latitude}, {selected.longitude}</div>
            <div><strong>Reference risk level:</strong> {selected.reference_risk_level}</div>
            <div><strong>Verification status:</strong> {selected.verification_status || '—'}</div>
            <div><strong>Data source:</strong> {selected.data_source || '—'}</div>
            {selected.risk_description && <div><strong>Risk description:</strong> {selected.risk_description}</div>}
            <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '0.5rem 0' }} />
            <div><strong>Historical incident analysis ({periodLabel(analysis.period || period)}):</strong></div>
            {selected.historical?.available ? (
              <>
                <div>Matched area: {selected.historical.matched_area_name || '—'}</div>
                <div>Incidents analyzed (for this match): {selected.historical.incident_count}</div>
                <div>Computed risk level: {selected.historical.risk_level || '—'} (score {selected.historical.risk_score ?? '—'})</div>
                <div>Average severity (weighted): {selected.historical.average_severity ?? '—'}</div>
                <div>Last reported incident: {formatDate(selected.historical.last_reported_at)}</div>
              </>
            ) : (
              <div>No historical incident records matched to this barangay for the selected period.</div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}
