import { fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';

test('renders a clearly labeled FireAlert operations preview', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: 'Incident operations' })).toBeInTheDocument();
  expect(screen.getByText(/all entries are fictional/i)).toBeInTheDocument();
  expect(screen.getByText(/not live gps or map data/i)).toBeInTheDocument();
});

test('shows only report counts by status', () => {
  render(<App />);

  const counts = within(
    screen.getByLabelText(/illustrative report counts by status/i),
  );
  expect(counts.getByText('Pending')).toBeInTheDocument();
  expect(counts.getByText('Responding')).toBeInTheDocument();
});

test('opens the incident records view', () => {
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: /incident records/i }));

  expect(screen.getByRole('heading', { name: 'Incident Records' })).toBeInTheDocument();
  expect(screen.getByText(/fictional sample records/i)).toBeInTheDocument();
});

test('keeps predictions unavailable until a validated model is connected', () => {
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: 'Predictions' }));

  expect(
    screen.getByRole('heading', { name: /not yet validated - no historical data loaded/i }),
  ).toBeInTheDocument();
  expect(screen.getByText(/no risk scores, accuracy figures, or automatic dispatch/i)).toBeInTheDocument();
});

test('does not present the preview login as functional authentication', () => {
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(screen.getByRole('heading', { name: 'Sign in to FireAlert' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /backend required/i })).toBeDisabled();
});
