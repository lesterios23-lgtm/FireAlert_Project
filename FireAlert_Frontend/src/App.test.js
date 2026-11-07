import { render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [], links: {}, meta: {} }),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('shows the sign-in page instead of an unauthenticated preview', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: /Welcome back/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
  expect(screen.queryByText(/Illustrative Preview/i)).not.toBeInTheDocument();
});

test('opens the documented BFP command center for an authenticated BFP user', async () => {
  localStorage.setItem('firealert_token', 'test-token');
  localStorage.setItem('firealert_user', JSON.stringify({
    id: 7,
    name: 'BFP Duty Officer',
    role: 'bfp',
  }));

  render(<App />);

  expect(screen.getByRole('heading', { name: /Emergency Command Center/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Incident Records/i })).toBeInTheDocument();
  expect(await screen.findByText(/No fire reports have been submitted/i)).toBeInTheDocument();
  expect(screen.queryByText(/DEMO-001/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Preview only - not connected/i)).not.toBeInTheDocument();
});

test('opens the resident emergency report form for a resident account', () => {
  localStorage.setItem('firealert_token', 'test-token');
  localStorage.setItem('firealert_user', JSON.stringify({
    id: 8,
    name: 'Resident User',
    role: 'resident',
  }));

  render(<App />);

  expect(screen.getByRole('heading', { name: /Report a fire/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Submit emergency report/i })).toBeInTheDocument();
});
