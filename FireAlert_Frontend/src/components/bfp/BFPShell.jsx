import React, { useState } from 'react';
import EmergencyCommandCenter from './EmergencyCommandCenter';
import IncidentRecords from './IncidentRecords';
import FireAlertLogoMark from '../shared/FireAlertLogoMark';
import LogoutConfirmModal from '../shared/LogoutConfirmModal';
import AdminDashboard from './AdminDashboard';

export default function BFPShell({ user, onLogout }) {
  const [page, setPage] = useState('command');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  return (
    <div className='bfp-app'>
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

        <div className='bfp-account'>
          <span className='account-shield' aria-hidden='true'>♧</span>
          <span className='account-details'>
            <strong>{user?.name || 'BFP Personnel'}</strong>
            <small>Authorized personnel · Duty officer</small>
          </span>
          <button type='button' className='bfp-signout' onClick={() => setShowLogoutConfirm(true)}>Sign out</button>
        </div>
      </header>

      <main className='bfp-main'>
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
      <footer className='bfp-footer'>
        <span>Restricted BFP workspace · Resident identity and location are confidential.</span>
        <span>FireAlert · Mansalay, Oriental Mindoro</span>
      </footer>
    </div>
  );
}
