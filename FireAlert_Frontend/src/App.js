import React, { useState, useEffect } from 'react';
import './App.css';
import './styles/variables.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/resident.css';
import './styles/bfp.css';
import './styles/portal.css';

import LoginPage from './components/shared/LoginPage';
import LandingPage from './pages/LandingPage';
import ResidentShell from './components/resident/ResidentShell';
import BFPShell from './components/bfp/BFPShell';
import { apiRequest, normalizeReports, API_BASE_URL } from './sharedApi';

// Public routes only work for path-based URLs (e.g. /, /login) served from a
// static host or dev server. When opened from file:// (no path routing), a
// hash fallback keeps the same behavior: #/login shows the sign-in screen.
function isStandaloneApp() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    new URLSearchParams(window.location.search).get('source') === 'pwa'
  );
}

function readPublicLocation() {
  const { pathname, hash, search } = window.location;
  if (pathname === '/' || pathname === '/index.html') {
    if (/^#\/login\b/.test(hash)) return '/login';
    // Installed/PWA launches should open the app (login), not the marketing landing page.
    if (isStandaloneApp() || new URLSearchParams(search).get('app') === '1') return '/login';
    return '/';
  }
  if (/^\/login\b/.test(pathname)) return '/login';
  return '/';
}

export default function App() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [publicPath, setPublicPath] = useState(() =>
    typeof window !== 'undefined' ? readPublicLocation() : '/'
  );

  useEffect(() => {
    const onNavigate = () => setPublicPath(readPublicLocation());
    window.addEventListener('popstate', onNavigate);
    window.addEventListener('hashchange', onNavigate);
    return () => {
      window.removeEventListener('popstate', onNavigate);
      window.removeEventListener('hashchange', onNavigate);
    };
  }, []);

  useEffect(() => {
    const onAuthExpired = () => {
      setUser(null);
      setUserRole(null);
    };
    window.addEventListener('firealert:auth-expired', onAuthExpired);
    return () => window.removeEventListener('firealert:auth-expired', onAuthExpired);
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem('firealert_user');
    const token = localStorage.getItem('firealert_token');
    const storedId = localStorage.getItem('firealert_user_id');
    if (storedUser && token) {
      try {
        const parsed = JSON.parse(storedUser);
        const sessionUser = storedId && !parsed.id ? { ...parsed, id: storedId } : parsed;
        setUser(sessionUser);
        setUserRole(sessionUser.role || 'resident');
      } catch {
        localStorage.removeItem('firealert_token');
        localStorage.removeItem('firealert_user');
        localStorage.removeItem('firealert_user_id');
      }
    }
    setInitialized(true);
  }, []);

  // Revalidate stored sessions so role/account changes take effect without
  // requiring users to manually clear browser storage.
  useEffect(() => {
    const token = localStorage.getItem('firealert_token');
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const payload = await apiRequest('/auth/me');
        const me = payload?.data;
        if (cancelled || !me?.id || !me?.role) return;
        const nextUser = {
          id: me.id,
          name: me.name || me.email || 'User',
          email: me.email || '',
          contact_number: me.contact_number || me.contactNumber || '',
          address: me.address || '',
          role: me.role,
          is_manager: Boolean(me.is_manager),
          profile_photo_url: me.profile_photo_url || me.profilePhotoUrl || null,
        };
        setUser(nextUser);
        setUserRole(nextUser.role || 'resident');
        localStorage.setItem('firealert_user', JSON.stringify(nextUser));
        localStorage.setItem('firealert_user_id', String(nextUser.id));
      } catch (err) {
        if (cancelled) return;
        const msg = String(err?.message || '').toLowerCase();
        if (msg.includes('401') || msg.includes('unauthenticated')) {
          localStorage.removeItem('firealert_token');
          localStorage.removeItem('firealert_user');
          localStorage.removeItem('firealert_user_id');
          setUser(null);
          setUserRole(null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleLogin = (userData, id) => {
    setUser(userData);
    setUserRole(userData.role || 'resident');
    localStorage.setItem('firealert_user', JSON.stringify(userData));
    if (id) {
      localStorage.setItem('firealert_user_id', String(id));
    }
  };

  const handleUserUpdate = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('firealert_user', JSON.stringify(updatedUser));
  };

  const handleLogout = () => {
    apiRequest('/auth/logout', { method: 'POST' }).catch(() => {});
    localStorage.removeItem('firealert_token');
    localStorage.removeItem('firealert_user');
    localStorage.removeItem('firealert_user_id');
    setUser(null);
    setUserRole(null);
  };

  if (!initialized) {
    return null;
  }

  if (!user) {
    if (publicPath === '/' && !isStandaloneApp()) {
      return <LandingPage />;
    }
    return <LoginPage onLogin={handleLogin} />;
  }

  const isBFP = userRole === 'bfp' || userRole === 'admin' || user.is_manager;

  return isBFP ? (
    <BFPShell user={user} onLogout={handleLogout} />
  ) : (
    <ResidentShell user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
  );
}

export { apiRequest, normalizeReports, API_BASE_URL };
