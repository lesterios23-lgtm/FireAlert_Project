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

function ResidentAvatar({ user, className = '' }) {
  const photoUrl = user?.profile_photo_url || user?.profilePhotoUrl;
  const initial = (user?.name || 'R').charAt(0).toUpperCase();
  return (
    <span className={className} aria-hidden='true'>
      {photoUrl ? <img src={photoUrl} alt='' /> : initial}
    </span>
  );
}

function NavIcon({ name }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: 'false' };
  if (name === 'home') {
    return (
      <svg {...common}>
        <path d='M3 10.5 12 3l9 7.5' />
        <path d='M5.5 9.5V20h13V9.5' />
        <path d='M10 20v-5h4v5' />
      </svg>
    );
  }
  if (name === 'track') {
    return (
      <svg {...common}>
        <circle cx='12' cy='12' r='7' />
        <circle cx='12' cy='12' r='2' fill='currentColor' stroke='none' />
        <path d='M12 2v3M12 19v3M2 12h3M19 12h3' />
      </svg>
    );
  }
  if (name === 'history') {
    return (
      <svg {...common}>
        <path d='M7 3h7l5 5v13H7z' />
        <path d='M14 3v5h5' />
        <path d='M10 13h6M10 17h6' />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx='12' cy='8' r='3.5' />
      <path d='M5 20a7 7 0 0 1 14 0' />
    </svg>
  );
}

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
          <ResidentAvatar user={user} />
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
        {screen === 'profile' && <ResidentProfileScreen user={user} onLogout={() => setShowLogoutConfirm(true)} onUserUpdate={onUserUpdate} />}
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
          <span className='resident-nav-icon' aria-hidden='true'><NavIcon name='home' /></span>
          <small>Home</small>
        </button>

        <button
          type='button'
          className={`resident-nav-item${screen === 'tracking' ? ' active' : ''}`}
          aria-current={screen === 'tracking' ? 'page' : undefined}
          onClick={() => setScreen('tracking')}
        >
          <span className='resident-nav-icon' aria-hidden='true'><NavIcon name='track' /></span>
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
          <span className='resident-nav-icon' aria-hidden='true'><NavIcon name='history' /></span>
          <small>My reports</small>
        </button>

        <button
          type='button'
          className={`resident-nav-item${screen === 'profile' ? ' active' : ''}`}
          aria-current={screen === 'profile' ? 'page' : undefined}
          onClick={() => setScreen('profile')}
        >
          <span className='resident-nav-icon resident-nav-profile-icon' aria-hidden='true'>
            {user?.profile_photo_url || user?.profilePhotoUrl ? <ResidentAvatar user={user} className='resident-nav-avatar' /> : <NavIcon name='profile' />}
          </span>
          <small>Profile</small>
        </button>
      </nav>
    </div>
  );
}

function ResidentHomeScreen({ user, onUserUpdate, showAddressPrompt, onDismissAddressPrompt }) {
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
          <h2 id='home-emergency-heading'>Emergency Reminder</h2>
          <p>May sunog? Unahin ang kaligtasan. Lumayo sa panganib at tumawag sa 911.</p>
        </div>
      </section>

      <BfpContactSection />

      <FireSafetyTips />

      <BfpAnnouncementsSection />
    </div>
  );
}

function BfpContactSection() {
  const numbers = ['0915-603-1507', '0921-850-7600'];
  const [copied, setCopied] = useState('');

  const copyNumber = async (number) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(number);
      } else {
        const area = document.createElement('textarea');
        area.value = number;
        area.setAttribute('readonly', '');
        area.style.position = 'absolute';
        area.style.left = '-9999px';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
      }
      setCopied(number);
      window.setTimeout(() => setCopied((current) => (current === number ? '' : current)), 1800);
    } catch {
      setCopied('');
    }
  };

  return (
    <section className='resident-home-card resident-contact-card' aria-labelledby='bfp-contact-heading'>
      <div className='resident-home-card-head'>
        <div>
          <p className='resident-eyebrow'>BFP MANSALAY</p>
          <h2 id='bfp-contact-heading'>Contact Information</h2>
        </div>
      </div>
      <ul className='resident-contact-list'>
        {numbers.map((number) => (
          <li key={number} className='resident-contact-item'>
            <span className='resident-contact-number'>{number}</span>
            <button type='button' className='resident-copy-button' onClick={() => copyNumber(number)}>
              {copied === number ? 'Copied' : 'Copy'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BfpAnnouncementsSection() {
  const [announcements, setAnnouncements] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const payload = await apiRequest('/announcements');
        const items = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
        if (!cancelled) setAnnouncements(items);
      } catch {
        if (!cancelled) setAnnouncements([]);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = expanded ? announcements : announcements.slice(0, 2);
  const hasAnnouncements = announcements.length > 0;

  return (
    <section className='resident-home-card resident-announcements-card' aria-labelledby='bfp-announcements-heading'>
      <div className='resident-home-card-head'>
        <div>
          <p className='resident-eyebrow'>BFP MANSALAY</p>
          <h2 id='bfp-announcements-heading'>BFP Announcements</h2>
          <p>Fire prevention reminders and public safety announcements.</p>
        </div>
      </div>
      {!loaded ? (
        <p className='resident-announcements-empty'>Loading announcements…</p>
      ) : hasAnnouncements ? (
        <>
          <ul className='resident-announcements-list'>
            {visible.map((item, index) => {
              const title = item?.title || item?.attributes?.title || 'Announcement';
              const body = item?.body || item?.content || item?.attributes?.body || item?.attributes?.content || '';
              return (
                <li key={item?.id || index} className='resident-announcement-item'>
                  <strong>{title}</strong>
                  {body ? <p>{body}</p> : null}
                </li>
              );
            })}
          </ul>
          <button type='button' className='resident-link-button' onClick={() => setExpanded((value) => !value)}>
            {expanded ? 'Show fewer announcements' : 'View All Announcements'} <span aria-hidden='true'>→</span>
          </button>
        </>
      ) : (
        <>
          <p className='resident-announcements-empty'>No announcements available at this time.</p>
          <button type='button' className='resident-link-button' onClick={() => setExpanded(true)} disabled>
            View All Announcements <span aria-hidden='true'>→</span>
          </button>
        </>
      )}
    </section>
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

function ResidentProfileScreen({ user, onLogout, onUserUpdate }) {
  const [form, setForm] = useState({
    name: user?.name || '',
    contact_number: user?.contact_number || user?.contactNumber || '',
    address: user?.address || '',
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setForm({
      name: user?.name || '',
      contact_number: user?.contact_number || user?.contactNumber || '',
      address: user?.address || '',
    });
  }, [user?.name, user?.contact_number, user?.contactNumber, user?.address]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview('');
      return undefined;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const currentPhoto = !removePhoto ? (photoPreview || user?.profile_photo_url || user?.profilePhotoUrl || '') : '';

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setRemovePhoto(false);
    setError('');
    setNotice('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const body = new FormData();
      body.append('name', form.name.trim());
      body.append('contact_number', form.contact_number.trim());
      body.append('address', form.address.trim());
      if (photoFile) body.append('profile_photo', photoFile);
      if (removePhoto) body.append('remove_profile_photo', '1');
      const payload = await apiRequest('/auth/profile', { method: 'PATCH', body });
      const returned = payload?.data || {};
      const updatedUser = {
        ...user,
        ...returned,
        name: returned.name ?? form.name.trim(),
        contact_number: returned.contact_number ?? form.contact_number.trim(),
        address: returned.address ?? form.address.trim(),
        profile_photo_url: returned.profile_photo_url ?? (removePhoto ? null : user?.profile_photo_url),
      };
      if (onUserUpdate) onUserUpdate(updatedUser);
      setPhotoFile(null);
      setRemovePhoto(false);
      setNotice('Profile updated.');
    } catch (err) {
      setError(err.message || 'Unable to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='resident-page resident-profile-page'>
      <div className='resident-page-heading'>
        <div>
          <p className='resident-eyebrow'>Your account</p>
          <h1>Profile</h1>
        </div>
      </div>
      <section className='resident-profile-card resident-profile-edit-card' aria-label='Resident profile details'>
        <form className='resident-profile-form' onSubmit={handleSubmit}>
          <div className='resident-profile-photo-block'>
            <div className='resident-profile-avatar resident-profile-avatar--large' aria-hidden='true'>
              {currentPhoto ? <img src={currentPhoto} alt='' /> : (form.name || user?.name || 'R').charAt(0).toUpperCase()}
            </div>
            <div className='resident-profile-photo-actions'>
              <label className='resident-upload-button'>
                <input type='file' accept='image/jpeg,image/png,image/webp' onChange={handlePhotoChange} />
                {currentPhoto ? 'Change photo' : 'Add profile photo'}
              </label>
              {(currentPhoto || photoFile) && (
                <button type='button' className='resident-text-button' onClick={() => { setPhotoFile(null); setRemovePhoto(true); }}>
                  Remove photo
                </button>
              )}
            </div>
          </div>

          {error && <p className='resident-address-error' role='alert'>{error}</p>}
          {notice && <p className='resident-profile-success' role='status'>{notice}</p>}

          <label className='resident-profile-field'>
            <span>Full name</span>
            <input name='name' type='text' value={form.name} onChange={handleChange} required />
          </label>
          <label className='resident-profile-field'>
            <span>Email address</span>
            <input type='email' value={user?.email || ''} disabled readOnly />
          </label>
          <label className='resident-profile-field'>
            <span>Contact number</span>
            <input name='contact_number' type='text' value={form.contact_number} onChange={handleChange} />
          </label>
          <label className='resident-profile-field'>
            <span>Home address</span>
            <textarea name='address' rows={3} value={form.address} onChange={handleChange} />
          </label>

          <button type='submit' className='resident-address-submit' disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </form>
        <button type='button' className='resident-signout-button' onClick={onLogout}>Sign out</button>
      </section>
    </div>
  );
}
