import React, { useState } from 'react';
import EmergencyReportScreen from './EmergencyReportScreen';
import ResponseTrackingScreen from './ResponseTrackingScreen';
import SubmissionHistoryScreen from './SubmissionHistoryScreen';
import FireAlertLogoMark from '../shared/FireAlertLogoMark';
import FireSafetyTips from './FireSafetyTips';
import LogoutConfirmModal from '../shared/LogoutConfirmModal';
import { apiRequest } from '../../sharedApi';

export default function ResidentShell({ user, onLogout, onUserUpdate }) {
  const [screen, setScreen] = useState('home');
  const [trackingReport, setTrackingReport] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showAddressPrompt, setShowAddressPrompt] = useState(false);

  const hasAddress = !!(user?.address && user.address.trim());

  const openReport = (report) => {
    setTrackingReport(report);
    setScreen('tracking');
  };

  const navigateToReport = () => {
    if (!hasAddress) {
      setShowAddressPrompt(true);
      setScreen('home');
    } else {
      setShowAddressPrompt(false);
      setScreen('report');
    }
  };

  const handleReportNavClick = () => {
    navigateToReport();
  };

  return (
    <div className='resident-app'>
      <header className='resident-topbar'>
        <div className='resident-brand'>
          <FireAlertLogoMark className='resident-brand-mark' />
          <span><strong>FireAlert</strong><small>BFP MANSALAY</small></span>
        </div>
        <button type='button' className='resident-profile' aria-label='Open profile' onClick={() => setScreen('profile')}>
          <span>{(user?.name || 'R').charAt(0).toUpperCase()}</span>
        </button>
      </header>

      <main className='resident-content'>
        {screen === 'home' && <ResidentHomeScreen user={user} onNavigate={setScreen} onUserUpdate={onUserUpdate} showAddressPrompt={showAddressPrompt} onDismissAddressPrompt={() => setShowAddressPrompt(false)} />}
        {screen === 'report' && (
          hasAddress ? (
            <EmergencyReportScreen onReportSubmitted={openReport} />
          ) : (
            <ResidentHomeScreen
              user={user}
              onNavigate={setScreen}
              onUserUpdate={onUserUpdate}
              showAddressPrompt={true}
              onDismissAddressPrompt={() => setShowAddressPrompt(false)}
            />
          )
        )}
        {screen === 'tracking' && <ResponseTrackingScreen report={trackingReport} />}
        {screen === 'history' && (
          <SubmissionHistoryScreen
            onViewReport={openReport}
            onReportNew={navigateToReport}
            user={user}
          />
        )}
        {screen === 'profile' && <ResidentProfileScreen user={user} onLogout={() => setShowLogoutConfirm(true)} />}
      </main>

      <LogoutConfirmModal
        open={showLogoutConfirm}
        userName={user?.name}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          setShowLogoutConfirm(false);
          onLogout();
        }}
      />

      <nav className='resident-bottom-nav' aria-label='Resident navigation'>
        <button type='button' className={screen === 'home' ? 'active' : ''} aria-current={screen === 'home' ? 'page' : undefined} onClick={() => setScreen('home')}>
          <span aria-hidden='true'>⌂</span><small>Home</small>
        </button>
        <button type='button' className={screen === 'tracking' ? 'active' : ''} aria-current={screen === 'tracking' ? 'page' : undefined} onClick={() => setScreen('tracking')}>
          <span aria-hidden='true'>⌖</span><small>Track</small>
        </button>
        <button
          type='button'
          className={`resident-nav-report${screen === 'report' ? ' active' : ''}`}
          aria-label='Report fire'
          aria-current={screen === 'report' ? 'page' : undefined}
          onClick={handleReportNavClick}
        >
          <span className='resident-nav-fire' aria-hidden='true'>
            <svg viewBox='0 0 100 120' focusable='false'>
              <path d='M58 4c4 28-15 37-6 55 5 10 16 13 15 29 0 15-10 26-23 27-16 1-27-11-27-27 0-14 8-24 17-34-1 14 2 21 9 23 9 2 15-6 11-16C45 43 40 26 58 4Z' />
              <ellipse cx='50' cy='116' rx='31' ry='3' />
            </svg>
          </span>
          <small>Report Fire</small>
        </button>
        <button type='button' className={screen === 'history' ? 'active' : ''} aria-current={screen === 'history' ? 'page' : undefined} onClick={() => setScreen('history')}>
          <span aria-hidden='true'>▤</span><small>My reports</small>
        </button>
        <button type='button' className={screen === 'profile' ? 'active' : ''} aria-current={screen === 'profile' ? 'page' : undefined} onClick={() => setScreen('profile')}>
          <span aria-hidden='true'>♙</span><small>Profile</small>
        </button>
      </nav>
    </div>
  );
}

function ResidentHomeScreen({ user, onNavigate, onUserUpdate, showAddressPrompt, onDismissAddressPrompt }) {
  const hasAddress = !!(user?.address && user.address.trim());

  return (
    <div className='resident-page resident-home'>
      <div className='resident-home-welcome'>
        <p className='resident-eyebrow'>Resident dashboard</p>
        <h1>Welcome, {user?.name || 'Resident'}</h1>
        <p>FireAlert connects your report with BFP Mansalay.</p>
      </div>

      {!hasAddress && (
        <AddressSetupCard
          user={user}
          onUserUpdate={onUserUpdate}
          showPrompt={showAddressPrompt}
          onDismissPrompt={onDismissAddressPrompt}
        />
      )}

      <section className='resident-home-emergency' aria-labelledby='home-emergency-heading'>
        <span className='resident-home-emergency-icon' aria-hidden='true'>!</span>
        <div>
          <h2 id='home-emergency-heading'>In case of fire</h2>
          <p>Move to safety first. Submit an incident report when it is safe to do so.</p>
        </div>
      </section>

      <FireSafetyTips />
      <p className='resident-home-privacy'>Your incident reports and account details are private.</p>
    </div>
  );
}

function AddressSetupCard({ user, onUserUpdate, showPrompt, onDismissPrompt }) {
  const [purok, setPurok] = useState('');
  const [barangay, setBarangay] = useState('');
  const [municipality, setMunicipality] = useState('Mansalay');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!barangay.trim() || !municipality.trim()) {
      setError('Barangay and municipality are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const addressParts = [purok.trim(), barangay.trim(), municipality.trim()].filter(Boolean);
      const address = addressParts.join(', ');
      const payload = await apiRequest('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ address }),
      });
      const returnedUser = payload?.data || {};
      const updatedUser = {
        ...user,
        ...returnedUser,
        address: returnedUser.address || address,
      };
      if (onUserUpdate) onUserUpdate(updatedUser);
      if (onDismissPrompt) onDismissPrompt();
    } catch (err) {
      setError(err.message || 'Failed to save address. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`resident-address-setup${showPrompt ? ' resident-address-setup--prompt' : ''}`} aria-labelledby='address-setup-heading'>
      <div className='resident-address-setup-header'>
        <span className='resident-address-setup-icon' aria-hidden='true'>📍</span>
        <div>
          <h2 id='address-setup-heading'>Complete your profile</h2>
          <p>Your home address is required to submit incident reports.</p>
        </div>
      </div>

      {showPrompt && (
        <div className='resident-address-setup-alert' role='alert'>
          <span aria-hidden='true'>⚠️</span>
          <strong>Address required</strong> — Please fill in your home address before reporting a fire incident.
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className='resident-address-fields'>
          <div className='resident-address-field'>
            <label htmlFor='addr-purok'>House No. / Street / Purok</label>
            <input
              id='addr-purok'
              type='text'
              value={purok}
              onChange={(e) => setPurok(e.target.value)}
              placeholder='e.g. Purok 3, Sitio Mababang Lupa'
              autoComplete='address-line1'
            />
          </div>
          <div className='resident-address-field'>
            <label htmlFor='addr-barangay'>
              Barangay <span aria-hidden='true' className='resident-address-required'>*</span>
            </label>
            <input
              id='addr-barangay'
              type='text'
              value={barangay}
              onChange={(e) => setBarangay(e.target.value)}
              placeholder='e.g. Barangay Poblacion'
              required
              autoComplete='address-level3'
            />
          </div>
          <div className='resident-address-field'>
            <label htmlFor='addr-municipality'>
              Municipality <span aria-hidden='true' className='resident-address-required'>*</span>
            </label>
            <input
              id='addr-municipality'
              type='text'
              value={municipality}
              onChange={(e) => setMunicipality(e.target.value)}
              placeholder='e.g. Mansalay'
              required
              autoComplete='address-level2'
            />
          </div>
        </div>

        {error && <p className='resident-address-error' role='alert'>{error}</p>}

        <button type='submit' className='resident-address-submit' disabled={saving}>
          {saving ? 'Saving…' : 'Save Address'}
        </button>
      </form>
    </section>
  );
}

function ResidentProfileScreen({ user, onLogout }) {
  const contactNumber = user?.contact_number || user?.contactNumber;

  return (
    <div className='resident-page resident-profile-page'>
      <div className='resident-page-heading'>
        <div>
          <p className='resident-eyebrow'>Your account</p>
          <h1>Profile</h1>
        </div>
      </div>
      <section className='resident-profile-card' aria-label='Resident profile details'>
        <div className='resident-profile-avatar' aria-hidden='true'>
          {(user?.name || 'R').charAt(0).toUpperCase()}
        </div>
        <h2>{user?.name || 'Resident'}</h2>
        <p>Resident account · Mansalay</p>
        <dl>
          <div><dt>Full name</dt><dd>{user?.name || 'Not provided'}</dd></div>
          <div><dt>Email address</dt><dd>{user?.email || 'Not provided'}</dd></div>
          <div><dt>Contact number</dt><dd>{contactNumber || 'Not provided'}</dd></div>
          <div><dt>Home address</dt><dd>{user?.address || 'Not provided'}</dd></div>
        </dl>
        <p className='resident-profile-note'>For changes to your account information, contact your system administrator.</p>
        <button type='button' className='resident-signout-button' onClick={onLogout}>Sign out</button>
      </section>
    </div>
  );
}
