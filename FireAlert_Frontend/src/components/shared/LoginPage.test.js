import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginPage from './LoginPage';
import { API_BASE_URL } from '../../sharedApi';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('switches between resident and BFP sign-in guidance', () => {
  render(<LoginPage onLogin={jest.fn()} />);

  expect(screen.getByText('Sign in to your resident account.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /BFP Personnel/i }));

  expect(screen.getByText('Sign in with your authorized BFP account.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /BFP Personnel/i })).toHaveAttribute('aria-pressed', 'true');
});

test('does not open a BFP account from the resident sign-in option', async () => {
  global.fetch = jest.fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { access_token: 'bfp-token' } }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { id: 12, name: 'BFP Officer', email: 'officer@example.com', role: 'bfp' },
      }),
    });

  render(<LoginPage onLogin={jest.fn()} />);
  fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'officer@example.com' } });
  fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'password1' } });
  fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/Select BFP Personnel to sign in/i);
  expect(localStorage.getItem('firealert_token')).toBeNull();
});

test('requires agreement before sending a resident registration request', () => {
  global.fetch = jest.fn();
  render(<LoginPage onLogin={jest.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: /Create account/i }));
  fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Renz Montana' } });
  fireEvent.change(screen.getByLabelText(/Contact number/i), { target: { value: '+639171234567' } });
  fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'renz@example.com' } });
  fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'password1' } });
  fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'password1' } });
  fireEvent.click(screen.getByRole('button', { name: /Create resident account/i }));

  expect(screen.getByRole('alert')).toHaveTextContent(/agree to the Terms of Use/i);
  expect(global.fetch).not.toHaveBeenCalled();
});

test('registers a resident and requires sign-in before opening the account', async () => {
  const onLogin = jest.fn();
  global.fetch = jest.fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Registered successfully', data: { access_token: 'registration-token' } }),
    });

  render(<LoginPage onLogin={onLogin} />);
  fireEvent.click(screen.getByRole('button', { name: /Create account/i }));
  fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Renz Montana' } });
  fireEvent.change(screen.getByLabelText(/Contact number/i), { target: { value: '+639171234567' } });
  fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'renz@example.com' } });
  fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'password1' } });
  fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'password1' } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: /Create resident account/i }));

  expect(await screen.findByText(/Account created successfully\. Sign in with your new account/i)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /Welcome back/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/Email address/i)).toHaveValue('renz@example.com');
  expect(screen.getByLabelText(/^Password$/i)).toHaveValue('');
  expect(onLogin).not.toHaveBeenCalled();
  expect(global.fetch).toHaveBeenNthCalledWith(
    1,
    `${API_BASE_URL}/auth/register`,
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        name: 'Renz Montana',
        contact_number: '+639171234567',
        email: 'renz@example.com',
        password: 'password1',
        password_confirmation: 'password1',
      }),
    })
  );
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem('firealert_token')).toBeNull();
  expect(localStorage.getItem('firealert_user')).toBeNull();
});

test('opens the account only after successful sign-in', async () => {
  const onLogin = jest.fn();
  global.fetch = jest.fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { access_token: 'resident-token' } }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { id: 5, name: 'Renz Montana', email: 'renz@example.com', contact_number: '+639171234567', role: 'resident' },
      }),
    });

  render(<LoginPage onLogin={onLogin} />);
  fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'renz@example.com' } });
  fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'password1' } });
  fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));

  await waitFor(() => expect(onLogin).toHaveBeenCalledWith(
    { id: 5, name: 'Renz Montana', email: 'renz@example.com', contact_number: '+639171234567', role: 'resident', is_manager: false },
    5
  ));
  expect(localStorage.getItem('firealert_token')).toBe('resident-token');
});
