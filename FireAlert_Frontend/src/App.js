import React, { useState, useEffect } from 'react';
import './App.css';
import './styles/variables.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/resident.css';
import './styles/bfp.css';
import './styles/portal.css';

import LoginPage from './components/shared/LoginPage';
import ResidentShell from './components/resident/ResidentShell';
import BFPShell from './components/bfp/BFPShell';
import { apiRequest, normalizeReports, API_BASE_URL } from './sharedApi';

export default function App() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [initialized, setInitialized] = useState(false);

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
