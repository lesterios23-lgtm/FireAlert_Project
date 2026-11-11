import React, { useEffect, useMemo, useRef, useState } from 'react';
import EmergencyReportScreen from './EmergencyReportScreen';
import ResponseTrackingScreen from './ResponseTrackingScreen';
import SubmissionHistoryScreen from './SubmissionHistoryScreen';
import FireAlertLogoMark from '../shared/FireAlertLogoMark';
import FireSafetyTips from './FireSafetyTips';
import LogoutConfirmModal from '../shared/LogoutConfirmModal';
import {
  buildResidentAddress,
  matchMansalayBarangay,
  suggestMansalayBarangays,
} from '../shared/mansalayBarangays';
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
        <button
          type='button'
          className={`resident-nav-item${screen === 'home' ? ' active' : ''}`}
          aria-current={screen === 'home' ? 'page' : undefined}
          onClick={() => setScreen('home')}
        >
          <span className='resident-nav-icon' aria-hidden='true'>⌂</span>
          <small>Home</small>
        </button>

        <button
          type='button'
          className={`resident-nav-item${screen === 'tracking' ? ' active' : ''}`}
          aria-current={screen === 'tracking' ? 'page' : undefined}
          onClick={() => setScreen('tracking')}
        >
          <span className='resident-nav-icon' aria-hidden='true'>⌖</span>
          <small>Track</small>
        </button>

        <button
          type='button'
          className={`resident-nav-report resident-nav-cab${screen === 'report' ? ' active' : ''}`}
          aria-label='Report fire'
          aria-current={screen === 'report' ? 'page' : undefined}
          onClick={handleReportNavClick}
        >
          <span className='resident-nav-fire' aria-hidden='true'>
            <span className='resident-nav-fire-pulse' />
            <svg viewBox='0 0 100 120' focusable='false'>
              <path d='M58 4c4 28-15 37-6 55 5 10 16 13 15 29 0 15-10 26-23 27-16 1-27-11-27-27 0-14 8-24 17-34-1 14 2 21 9 23 9 2 15-6 11-16C45 43 40 26 58 4Z' />
              <ellipse cx='50' cy='116' rx='31' ry='3' />
            </svg>
          </span>
          <small>Report Fire</small>
        </button>

        <button
          type='button'
          className={`resident-nav-item${screen === 'history' ? ' active' : ''}`}
          aria-current={screen === 'history' ? 'page' : undefined}
          onClick={() => setScreen('history')}
        >
          <span className='resident-nav-icon' aria-hidden='true'>▤</span>
          <small>My reports</small>
        </button>

        <button
          type='button'
          className={`resident-nav-item${screen === 'profile' ? ' active' : ''}`}
          aria-current={screen === 'profile' ? 'page' : undefined}
          onClick={() => setScreen('profile')}
        >
          <span className='resident-nav-icon' aria-hidden='true'>♙</span>
          <small>Profile</small>
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
        <p className='resident-eyebrow'>RESIDENT DASHBOARD · MANSALAY</p>
        <h1>Hi, {user?.name || 'Resident'}</h1>
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
          <h2 id='home-emergency-heading'>May sunog?</h2>
          <p>Unahin ang kaligtasan. Tumawag sa 911.</p>
        </div>
      </section>

      <FireSafetyTips />
    </div>
  );
}

function AddressSetupCard({ user, onUserUpdate, showPrompt, onDismissPrompt }) {
  const [houseDetail, setHouseDetail] = useState('');
  const [barangay, setBarangay] = useState('');
  const [municipality] = useState('Mansalay');
  const [barangayTouched, setBarangayTouched] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const suggestBoxRef = useRef(null);

  const matchedBarangay = matchMansalayBarangay(barangay);
  const suggestions = useMemo(() => suggestMansalayBarangays(barangay), [barangay]);
  const barangayValid = Boolean(matchedBarangay);
  const showBarangayError = barangayTouched && barangay.trim() !== '' && !matchedBarangay;

  useEffect(() => {
    if (showPrompt) setIsEditing(true);
  }, [showPrompt]);

  useEffect(() => {
    if (!isEditing) return undefined;
    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsEditing(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isEditing]);

  useEffect(() => {
    if (!showSuggestions) return undefined;
    const handlePointerDown = (event) => {
      if (suggestBoxRef.current && !suggestBoxRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [showSuggestions]);

  const chooseSuggestion = (name) => {
    setBarangay(name);
    setBarangayTouched(true);
    setShowSuggestions(false);
  };

  const handleBarangayKeyDown = (event) => {
    if (event.key === 'ArrowDown' && suggestions.length > 0) {
      event.preventDefault();
      setActiveSuggestion((current) => (current + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp' && suggestions.length > 0) {
      event.preventDefault();
      setActiveSuggestion((current) => (current - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter' && showSuggestions && suggestions.length > 0) {
      event.preventDefault();
      chooseSuggestion(suggestions[Math.min(activeSuggestion, suggestions.length - 1)]);
    } else if (event.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!matchedBarangay) {
      setBarangayTouched(true);
      setError('Choose your barangay from the Mansalay list.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { address } = buildResidentAddress({ houseDetail, barangay: matchedBarangay });
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
          <h2 id='address-setup-heading'>Add your home address</h2>
          <p>Needed before you can submit a report.</p>
        </div>
      </div>

      {showPrompt && (
        <div className='resident-address-setup-alert' role='alert'>
          <span aria-hidden='true'>⚠️</span>
          <strong>Address required to report a fire.</strong>
        </div>
      )}

      <button type='button' className='resident-address-submit' onClick={() => setIsEditing(true)}>
        {showPrompt ? 'Complete address' : 'Add home address'}
      </button>

      {isEditing && (
        <div
          className='resident-address-modal-overlay'
          onClick={(event) => {
            if (event.target === event.currentTarget) setIsEditing(false);
          }}
        >
          <section className='resident-address-modal' role='dialog' aria-modal='true' aria-labelledby='address-modal-heading'>
            <div className='resident-address-modal-header'>
              <div>
                <p className='resident-eyebrow'>PROFILE SETUP</p>
                <h2 id='address-modal-heading'>Your home address</h2>
              </div>
              <button type='button' className='resident-address-modal-close' onClick={() => setIsEditing(false)} aria-label='Close address form'>×</button>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div className='resident-address-fields'>
                <div className='resident-address-field'>
                  <label htmlFor='addr-purok'>House No. / Street / Purok</label>
                  <input
                    id='addr-purok'
                    type='text'
                    value={houseDetail}
                    onChange={(e) => setHouseDetail(e.target.value)}
                    placeholder='e.g. Purok 3, Sitio Maligaya'
                    autoComplete='address-line1'
                  />
                </div>
                <div className='resident-address-field resident-address-autosuggest' ref={suggestBoxRef}>
                  <label htmlFor='addr-barangay'>
                    Barangay <span aria-hidden='true' className='resident-address-required'>*</span>
                    <small className='resident-address-scope'>Mansalay only</small>
                  </label>
                  <input
                    id='addr-barangay'
                    type='text'
                    role='combobox'
                    aria-expanded={showSuggestions}
                    aria-autocomplete='list'
                    aria-controls='addr-barangay-suggestions'
                    aria-activedescendant={showSuggestions && suggestions.length > 0 ? `mansalay-brgy-${activeSuggestion}` : undefined}
                    value={barangay}
                    onChange={(e) => {
                      setBarangay(e.target.value);
                      setBarangayTouched(true);
                      setShowSuggestions(true);
                      setActiveSuggestion(0);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onKeyDown={handleBarangayKeyDown}
                    onBlur={() => setBarangayTouched(true)}
                    placeholder='Type to search 17 Mansalay barangays…'
                    required
                    autoComplete='off'
                    className={showBarangayError ? 'is-invalid' : matchedBarangay ? 'is-valid' : ''}
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <ul id='addr-barangay-suggestions' role='listbox' aria-label='Mansalay barangays' className='resident-barangay-suggestions'>
                      {suggestions.map((name, index) => (
                        <li key={name} role='option' id={`mansalay-brgy-${index}`} aria-selected={index === activeSuggestion}>
                          <button
                            type='button'
                            className={index === activeSuggestion ? 'active' : ''}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => chooseSuggestion(name)}
                            onMouseEnter={() => setActiveSuggestion(index)}
                          >
                            <span aria-hidden='true'>📍</span> Brgy. {name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {matchedBarangay ? (
                    <p className='resident-address-valid' role='status'>✓ Brgy. {matchedBarangay}, Mansalay</p>
                  ) : (
                    <p className='resident-address-hint'>Only the 17 barangays of Mansalay are accepted.</p>
                  )}
                </div>
                <div className='resident-address-field'>
                  <label htmlFor='addr-municipality'>Municipality</label>
                  <input
                    id='addr-municipality'
                    type='text'
                    value={municipality}
                    readOnly
                    disabled
                    autoComplete='address-level2'
                  />
                </div>
              </div>

              {error && <p className='resident-address-error' role='alert'>{error}</p>}

              <button type='submit' className='resident-address-submit' disabled={saving || !barangayValid}>
                {saving ? 'Saving…' : 'Save Address'}
              </button>
            </form>
          </section>
        </div>
      )}
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
