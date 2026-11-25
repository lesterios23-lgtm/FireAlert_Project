import React, { useEffect, useMemo, useRef, useState } from 'react';
import EmergencyCommandCenter from './EmergencyCommandCenter';
import IncidentRecords from './IncidentRecords';
import FireAlertLogoMark from '../shared/FireAlertLogoMark';
import LogoutConfirmModal from '../shared/LogoutConfirmModal';
import AdminDashboard from './AdminDashboard';

function getInitials(name) {
  const clean = String(name || '').trim();
  if (!clean) return 'BFP';
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function roleLabel(user) {
  if (user?.role === 'admin') return 'System Administrator';
  if (user?.is_manager) return 'Duty Manager';
  if (user?.role === 'bfp') return 'Duty Officer';
  return user?.role ? String(user.role) : 'Duty Officer';
}

export default function BFPShell({ user, onLogout }) {
  const [page, setPage] = useState('command');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef(null);

  const displayName = user?.name || 'BFP Personnel';
  const profileRows = useMemo(() => ([
    { label: 'Full name', value: user?.name || 'BFP Personnel' },
    { label: 'Email address', value: user?.email || 'Not provided' },
    { label: 'Contact number', value: user?.contact_number || user?.contactNumber || 'Not provided' },
    ...(user?.address ? [{ label: 'Address', value: user.address }] : []),
    { label: 'Role', value: roleLabel(user) },
    { label: 'Account status', value: 'Authorized personnel' },
  ]), [user]);

  useEffect(() => {
    if (!showProfile) return undefined;
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfile(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setShowProfile(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showProfile]);

  const isCommandCenter = page === 'command';

  return (
    <div className={`bfp-app${isCommandCenter ? ' is-command-center' : ''}`}>
      <header className='bfp-navbar'>
        <a className='bfp-logo' href='/' aria-label='FireAlert BFP Mansalay home'>
          <FireAlertLogoMark className='bfp-logo-mark' />
          <span>
            <strong>FireAlert</strong>
            <small>BFP MANSALAY</small>
          </span>
        </a>

        <nav className='bfp-primary-nav' aria-label='BFP navigation'>
          <button
            type='button'
            className={page === 'command' ? 'active' : ''}
            onClick={() => setPage('command')}
          >
            <span aria-hidden='true'>◉</span> Command Center
          </button>
          <button
            type='button'
            className={page === 'records' ? 'active' : ''}
            onClick={() => setPage('records')}
          >
            <span aria-hidden='true'>▤</span> Incident Records
          </button>
          {user?.role === 'admin' && (
            <button
              type='button'
              className={page === 'admin' ? 'active' : ''}
              onClick={() => setPage('admin')}
            >
              <span aria-hidden='true'>⚙</span> System Admin
            </button>
          )}
        </nav>

        <div className='bfp-account' ref={profileRef}>
          <button
            type='button'
            className='bfp-profile-trigger'
            onClick={() => setShowProfile((open) => !open)}
            aria-haspopup='dialog'
            aria-expanded={showProfile}
            aria-label='View profile information'
            title='View profile information'
          >
            <span className='bfp-profile-avatar' aria-hidden='true'>{getInitials(displayName)}</span>
            <span className='account-details'>
              <strong>{displayName}</strong>
              <small>{roleLabel(user)} · BFP Mansalay</small>
            </span>
          </button>
          {showProfile && (
            <div className='bfp-profile-card' role='dialog' aria-label='User profile information'>
              <div className='bfp-profile-card-head'>
                <span className='bfp-profile-avatar large' aria-hidden='true'>{getInitials(displayName)}</span>
                <div>
                  <strong>{displayName}</strong>
                  <small>{roleLabel(user)} · BFP Mansalay</small>
                </div>
              </div>
              <dl className='bfp-profile-rows'>
                {profileRows.map(({ label, value }) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <button type='button' className='bfp-profile-signout' onClick={() => { setShowProfile(false); setShowLogoutConfirm(true); }}>Sign out</button>
            </div>
          )}
        </div>
      </header>

      <main className={`bfp-main${isCommandCenter ? ' bfp-main-command' : ''}`}>
        {page === 'admin' && user?.role === 'admin' ? (
          <AdminDashboard />
        ) : page === 'command' ? (
          <EmergencyCommandCenter />
        ) : (
          <IncidentRecords onOpenCommand={() => setPage('command')} />
        )}
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
      {!isCommandCenter && (
        <footer className='bfp-footer'>
          <span>Restricted BFP workspace · Resident identity and location are confidential.</span>
          <span>FireAlert · Mansalay, Oriental Mindoro</span>
        </footer>
      )}
    </div>
  );
}
