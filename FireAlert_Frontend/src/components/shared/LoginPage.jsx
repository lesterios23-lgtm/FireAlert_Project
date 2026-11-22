import React, { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../../sharedApi';
import FireAlertLogoMark from './FireAlertLogoMark';

// Set REACT_APP_GOOGLE_CLIENT_ID at build time to use your own OAuth client.
// The fallback keeps local development working without extra configuration.
const GOOGLE_CLIENT_ID =
  String(process.env.REACT_APP_GOOGLE_CLIENT_ID || '').trim()
  || '35718463117-21q7gbd8fbvk6ms861ma3uafp4l3m98j.apps.googleusercontent.com';

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '' });
  const [registrationForm, setRegistrationForm] = useState({
    name: '',
    contact_number: '',
    email: '',
    password: '',
    password_confirmation: '',
    acceptedTerms: false,
  });
  const [showRegistrationPassword, setShowRegistrationPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const googleButtonRef = useRef(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleRegistrationChange = (event) => {
    const { name, type, checked, value } = event.target;
    setRegistrationForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleRegistrationSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setNotice('');

    if (registrationForm.password !== registrationForm.password_confirmation) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    if (!registrationForm.acceptedTerms) {
      setError('Please agree to the Terms of Use and Privacy Notice to continue.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: registrationForm.name.trim(),
          contact_number: registrationForm.contact_number.trim(),
          email: registrationForm.email.trim(),
          password: registrationForm.password,
          password_confirmation: registrationForm.password_confirmation,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const validationErrors = data?.errors
          ? Object.values(data.errors).flat().join(' ')
          : '';
        throw new Error(validationErrors || data.message || 'Registration failed. Please try again.');
      }

      localStorage.removeItem('firealert_token');
      localStorage.removeItem('firealert_user');
      localStorage.removeItem('firealert_user_id');
      setForm({ email: registrationForm.email.trim(), password: '' });
      setMode('login');
      setRegistrationForm({
        name: '',
        contact_number: '',
        email: '',
        password: '',
        password_confirmation: '',
        acceptedTerms: false,
      });
      setNotice('Account created successfully. Sign in with your new account to continue.');
    } catch (requestError) {
      setError(
        requestError.message === 'Failed to fetch'
          ? 'Could not reach the server. Check that the backend is running and try again.'
          : requestError.message || 'Unable to create your account.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const validationErrors = data?.errors
          ? Object.values(data.errors).flat().join(' ')
          : '';
        throw new Error(validationErrors || data.message || 'Request failed. Please try again.');
      }
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Server returned an unexpected response (not JSON). The API may not be routed correctly on this site. Check deployment/server configuration.');
      }
      const data = await response.json();

      const accessToken = data?.data?.access_token;

      if (!accessToken) {
        throw new Error('Authentication token missing.');
      }

      const meResponse = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!meResponse.ok) {
        const meData = await meResponse.json().catch(() => ({}));
        throw new Error(meData.message || 'Unable to verify this account. Please try again.');
      }

      const meData = await meResponse.json();
      const payload = meData?.data;
      if (!payload?.id || !payload?.role) {
        throw new Error('The server returned incomplete account details.');
      }

      const authUser = {
        id: payload.id,
        name: payload.name || form.email,
        email: payload.email || form.email,
        contact_number: payload.contact_number || payload.contactNumber || payload.attributes?.contactNumber || '',
        address: payload.address || payload.attributes?.address || '',
        role: payload.role,
        is_manager: Boolean(payload.is_manager),
        profile_photo_url: payload.profile_photo_url || payload.profilePhotoUrl || null,
      };

      localStorage.setItem('firealert_token', accessToken);
      localStorage.setItem('firealert_user', JSON.stringify(authUser));
      if (authUser.id) {
        localStorage.setItem('firealert_user_id', String(authUser.id));
      }

      onLogin(authUser, authUser.id || undefined);
    } catch (requestError) {
      localStorage.removeItem('firealert_token');
      setError(requestError.message || 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const openRegistration = () => {
    setMode('register');
    setError('');
    setNotice('');
  };

  const returnToLogin = () => {
    setMode('login');
    setError('');
    setNotice('');
  };

  const handleGoogleCredential = async (response) => {
    if (!response?.credential) {
      setError('Google sign-in failed. Please try again.');
      return;
    }
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const googleResponse = await fetch(`${API_BASE_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await googleResponse.json().catch(() => ({}));
      if (!googleResponse.ok) {
        throw new Error(data?.message || 'Google sign-in failed. Please try again.');
      }
      const contentType = googleResponse.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Server returned an unexpected response (not JSON). The API may not be routed correctly on this site. Check deployment/server configuration.');
      }
      const accessToken = data?.data?.access_token;
      if (!accessToken) {
        throw new Error('Authentication token missing from server response. The API may be misconfigured or returning the wrong page.');
      }

      const meResponse = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!meResponse.ok) {
        const meData = await meResponse.json().catch(() => ({}));
        throw new Error(meData.message || 'Unable to verify this account. Please try again.');
      }

      const meData = await meResponse.json();
      const payload = meData?.data;
      if (!payload?.id || !payload?.role) {
        throw new Error('The server returned incomplete account details.');
      }

      const authUser = {
        id: payload.id,
        name: payload.name || payload.email || '',
        email: payload.email || '',
        contact_number: payload.contact_number || payload.contactNumber || payload.attributes?.contactNumber || '',
        address: payload.address || payload.attributes?.address || '',
        role: payload.role,
        is_manager: Boolean(payload.is_manager),
        profile_photo_url: payload.profile_photo_url || payload.profilePhotoUrl || null,
      };

      localStorage.setItem('firealert_token', accessToken);
      localStorage.setItem('firealert_user', JSON.stringify(authUser));
      if (authUser.id) {
        localStorage.setItem('firealert_user_id', String(authUser.id));
      }

      onLogin(authUser, authUser.id || undefined);
    } catch (requestError) {
      localStorage.removeItem('firealert_token');
      setError(
        requestError.message === 'Failed to fetch'
          ? 'Could not reach the server. Check that the backend is running and try again.'
          : requestError.message || 'Unable to sign in with Google.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mode !== 'register') return undefined;

    const renderGoogleButton = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return;
      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      });
      const width = Math.min(360, googleButtonRef.current.offsetWidth || 360);
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: 'continue_with',
        width,
      });
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
      return undefined;
    }

    const existing = document.querySelector('script[data-google-gsi="true"]');
    if (existing) {
      existing.addEventListener('load', renderGoogleButton);
      return () => existing.removeEventListener('load', renderGoogleButton);
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleGsi = 'true';
    script.onload = renderGoogleButton;
    script.onerror = () => setError('Unable to load Google sign-in. Please check your connection and try again.');
    document.head.appendChild(script);
    return () => {
      script.onload = null;
    };
  }, [mode]);

  return (
    <div className='auth-app'>
      <header className='auth-topbar'>
        <div className='auth-topbar-inner'>
          <div className='auth-brand'>
            <FireAlertLogoMark className='auth-brand-mark' />
            <span><strong>FireAlert</strong><small>BFP MANSALAY</small></span>
          </div>
          <span className='auth-portal-label'>{mode === 'register' ? 'Resident portal' : 'Portal'}</span>
        </div>
      </header>

      <main className={`auth-content${mode === 'register' ? ' is-registering' : ''}`}>
        <div className='auth-panel'>
        {mode === 'login' ? (
          <section className='auth-hero'>
            <p className='auth-hero-location'>Mansalay, Oriental Mindoro</p>
            <h1>Your community.<br />A safer response.</h1>
            <p>Report a fire, share its location, and follow updates from BFP Mansalay.</p>
          </section>
        ) : (
          <button type='button' className='auth-back-button' onClick={returnToLogin}>
            <span aria-hidden='true'>‹</span> Back to sign in
          </button>
        )}

        <section className='auth-card'>
          {mode === 'login' ? (
            <div className='auth-card-heading'>
              <h2>Welcome back</h2>
              <p>Sign in with your email address and password.</p>
            </div>
          ) : (
            <>
              <div className='auth-card-heading'>
                <h1>Create your account</h1>
                <p>A resident account lets you report fires and review your own incident updates.</p>
              </div>
              {error && <div className='auth-error' role='alert'>{error}</div>}
              {notice && <div className='auth-notice' role='status'>{notice}</div>}
              <form onSubmit={handleRegistrationSubmit} className='auth-form'>
                <label className='auth-field' htmlFor='register-name'>
                  <span>Full name</span>
                  <input
                    id='register-name'
                    type='text'
                    name='name'
                    autoComplete='name'
                    value={registrationForm.name}
                    onChange={handleRegistrationChange}
                    placeholder='Enter your full name'
                    maxLength={255}
                    required
                  />
                </label>
                <label className='auth-field' htmlFor='register-contact-number'>
                  <span>Contact number</span>
                  <input
                    id='register-contact-number'
                    type='tel'
                    name='contact_number'
                    autoComplete='tel'
                    value={registrationForm.contact_number}
                    onChange={handleRegistrationChange}
                    placeholder='Enter your contact number'
                    maxLength={20}
                    required
                  />
                </label>
                <label className='auth-field' htmlFor='register-email'>
                  <span>Email address</span>
                  <input
                    id='register-email'
                    type='email'
                    name='email'
                    autoComplete='email'
                    value={registrationForm.email}
                    onChange={handleRegistrationChange}
                    placeholder='you@example.com'
                    maxLength={255}
                    required
                  />
                </label>
                <label className='auth-field' htmlFor='register-password'>
                  <span>Password</span>
                  <span className='auth-password-control'>
                    <input
                      id='register-password'
                      type={showRegistrationPassword ? 'text' : 'password'}
                      name='password'
                      autoComplete='new-password'
                      value={registrationForm.password}
                      onChange={handleRegistrationChange}
                      placeholder='Enter your password'
                      minLength={8}
                      required
                    />
                    <button
                      type='button'
                      aria-label={showRegistrationPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showRegistrationPassword}
                      onClick={() => setShowRegistrationPassword((visible) => !visible)}
                    >
                      {showRegistrationPassword ? 'Hide' : 'Show'}
                    </button>
                  </span>
                </label>
                <label className='auth-field' htmlFor='register-password-confirm'>
                  <span>Confirm password</span>
                  <input
                    id='register-password-confirm'
                    type={showRegistrationPassword ? 'text' : 'password'}
                    name='password_confirmation'
                    autoComplete='new-password'
                    value={registrationForm.password_confirmation}
                    onChange={handleRegistrationChange}
                    placeholder='Re-enter your password'
                    minLength={8}
                    required
                  />
                </label>
                <p className='auth-field-hint'>Use at least 8 characters, including a number.</p>
                <label className='auth-consent'>
                  <input
                    type='checkbox'
                    name='acceptedTerms'
                    checked={registrationForm.acceptedTerms}
                    onChange={handleRegistrationChange}
                  />
                  <span>I agree to the Terms of Use and Privacy Notice for emergency reporting.</span>
                </label>
                <button type='submit' className='auth-submit-button' disabled={loading}>
                  {loading ? 'Please wait…' : 'Create resident account'}
                </button>
              </form>
              <div className='auth-divider'><span>or</span></div>
              <div ref={googleButtonRef} className='auth-google-button-wrap' aria-label='Continue with Google' />
              <div className='auth-account-prompt'>
                Already have an account? <button type='button' onClick={returnToLogin}>Sign in</button>
              </div>
            </>
          )}

          {mode === 'login' && (
            <>
              {error && <div className='auth-error' role='alert'>{error}</div>}
              {notice && <div className='auth-notice' role='status'>{notice}</div>}
              <form onSubmit={handleSubmit} className='auth-form'>
            <label className='auth-field' htmlFor='login-email'>
              <span>Email address</span>
              <input
                id='login-email'
                type='email'
                name='email'
                autoComplete='email'
                value={form.email}
                onChange={handleChange}
                placeholder='you@example.com'
                required
              />
            </label>
            <label className='auth-field' htmlFor='login-password'>
              <span>Password</span>
              <input
                id='login-password'
                type='password'
                name='password'
                autoComplete='current-password'
                value={form.password}
                onChange={handleChange}
                placeholder='Enter your password'
                required
              />
            </label>
            <button
              type='button'
              className='auth-forgot-button'
              onClick={() => setNotice('Password reset is not available here yet. Contact your BFP administrator for account help.')}
            >
              Forgot password?
            </button>
            <button type='submit' className='auth-submit-button' disabled={loading}>
              {loading ? 'Please wait…' : 'Sign in'}
            </button>
              </form>
              <div className='auth-account-prompt'>
                New to FireAlert? <button type='button' onClick={openRegistration}>Create account</button>
              </div>
            </>
          )}
        </section>

        {mode === 'register' ? (
          <div className='auth-privacy-card'>
            <strong>Your information is protected</strong>
            <p>Your identity and reported location are shared only with authorized BFP personnel.</p>
          </div>
        ) : (
          <div className='auth-emergency-note'>
            <span className='auth-emergency-icon' aria-hidden='true'>
              <svg viewBox='0 0 24 24' focusable='false'>
                <path
                  fill='currentColor'
                  d='M12 2.6a1.8 1.8 0 0 1 1.56.9l8.2 14.2a1.8 1.8 0 0 1-1.56 2.7H3.8a1.8 1.8 0 0 1-1.56-2.7l8.2-14.2A1.8 1.8 0 0 1 12 2.6Zm0 4.9a1 1 0 0 0-1 1v4.9a1 1 0 1 0 2 0V8.5a1 1 0 0 0-1-1Zm0 9.7a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z'
                />
              </svg>
            </span>
            <div className='auth-emergency-copy'>
              <strong>For fire emergencies only</strong>
              <p>Stay at a safe distance. If you cannot connect to FireAlert, call 911.</p>
            </div>
          </div>
        )}
        <p className='auth-security-note'>
          <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
            <path
              fill='currentColor'
              d='M12 2a4.2 4.2 0 0 0-4.2 4.2v2H7a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8.8a2 2 0 0 0-2-2h-.8v-2A4.2 4.2 0 0 0 12 2Zm-2.4 6.2V6.2a2.4 2.4 0 1 1 4.8 0v2H9.6Zm2.4 5a1.5 1.5 0 0 1 .9 2.7v1a.9.9 0 0 1-1.8 0v-1a1.5 1.5 0 0 1 .9-2.7Z'
            />
          </svg>
          <span>Secure access · Your information stays private</span>
        </p>
        </div>
      </main>
    </div>
  );
}
