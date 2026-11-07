import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../sharedApi';
import './AdminDashboard.css';

const SECTIONS = [
  { id: 'analytics', label: 'Incident analytics', icon: '▥' },
  { id: 'users', label: 'User management', icon: '♙' },
  { id: 'firetrucks', label: 'Firetruck management', icon: '▰' },
  { id: 'predictions', label: 'High-risk predictions', icon: '⌁' },
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

function reportFromResource(report) {
  return {
    id: report.id,
    ...report.attributes,
    residentName: report.includes?.resident?.attributes?.name || 'Unknown resident',
  };
}

export default function AdminDashboard() {
  const [section, setSection] = useState('analytics');
  const [dashboard, setDashboard] = useState({ reports: [], users: [], firetrucks: [] });
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

  const refresh = useCallback(async () => {
    setError('');
    try {
      const response = await apiRequest('/admin/dashboard');
      const data = response.data || {};
      setDashboard({
        ...data,
        reports: (data.reports || []).map(reportFromResource),
        users: data.users || [],
        firetrucks: data.firetrucks || [],
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const reports = dashboard.reports;
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

  const stats = useMemo(() => {
    const countStatus = (status) => reports.filter((report) =>
      String(report.status || '').toLowerCase() === status
    ).length;
    return {
      total: reports.length,
      pending: countStatus('pending'),
      responding: reports.filter((report) =>
        ['accepted', 'responding', 'dispatched'].includes(String(report.status || '').toLowerCase())
      ).length,
      resolved: countStatus('resolved'),
    };
  }, [reports]);

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
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function renderAnalytics() {
    return (
      <>
        <div className='admin-stat-grid'>
          <StatCard label='Total incidents' value={stats.total} tone='navy' />
          <StatCard label='Awaiting response' value={stats.pending} tone='amber' />
          <StatCard label='Active response' value={stats.responding} tone='blue' />
          <StatCard label='Resolved' value={stats.resolved} tone='green' />
        </div>
        <section className='admin-panel'>
          <div className='admin-panel-heading'>
            <div><h2>Recent incidents</h2><p>Live records from the incident database</p></div>
          </div>
          {reports.length ? (
            <div className='admin-table-wrap'>
              <table className='admin-table'>
                <thead><tr><th>Reference</th><th>Incident</th><th>Resident</th><th>Reported</th><th>Status</th></tr></thead>
                <tbody>{reports.slice(0, 10).map((report) => (
                  <tr key={report.id}>
                    <td>#{report.id}</td>
                    <td>{report.incidentAddress || report.incidentDescription || 'Location not provided'}</td>
                    <td>{report.residentName}</td>
                    <td>{formatDate(report.reportedAt || report.createdAt)}</td>
                    <td><span className={`admin-status ${statusTone(report.status)}`}>{report.status || 'Unknown'}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className='admin-empty'>No incident reports have been recorded.</p>}
        </section>
      </>
    );
  }

  function renderUsers() {
    return (
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

  return (
    <div className='admin-dashboard'>
      <aside className='admin-sidebar'>
        <div className='admin-sidebar-title'><span>ADMINISTRATION</span><strong>System workspace</strong></div>
        <nav aria-label='System administration'>
          {SECTIONS.map((item) => (
            <button key={item.id} type='button' className={section === item.id ? 'active' : ''} onClick={() => setSection(item.id)}>
              <span aria-hidden='true'>{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className='admin-sidebar-note'>Access is restricted to system administrators.</div>
      </aside>
      <section className='admin-content'>
        <header className='admin-content-heading'>
          <div><span className='admin-eyebrow'>FIREALERT · SYSTEM ADMIN</span><h1>{SECTIONS.find((item) => item.id === section)?.label}</h1><p>Manage operational records for BFP Mansalay.</p></div>
          <button type='button' className='admin-refresh' onClick={() => { setLoading(true); refresh(); }}>Refresh data</button>
        </header>
        {error && <div className='admin-alert admin-alert-error' role='alert'>{error}</div>}
        {notice && <div className='admin-alert admin-alert-success' role='status'>{notice}</div>}
        {loading ? <div className='admin-loading'>Loading database records...</div> : (
          <>
            {section === 'analytics' && renderAnalytics()}
            {section === 'users' && renderUsers()}
            {section === 'firetrucks' && renderTrucks()}
            {section === 'predictions' && <PredictionUnavailable />}
          </>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, tone }) {
  return <article className={`admin-stat-card ${tone}`}><span>{label}</span><strong>{value}</strong></article>;
}

function PredictionUnavailable() {
  return (
    <section className='admin-panel admin-prediction-state'>
      <div className='admin-prediction-icon' aria-hidden='true'>!</div>
      <h2>Prediction model unavailable</h2>
      <p>No trained high-risk prediction model is connected. This page will show predictions when verified model output becomes available; it does not generate or invent risk estimates.</p>
    </section>
  );
}

function statusTone(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'resolved') return 'resolved';
  if (normalized === 'rejected') return 'rejected';
  if (normalized === 'pending') return 'pending';
  return 'active';
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}
