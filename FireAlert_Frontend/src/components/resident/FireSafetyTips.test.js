import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import FireSafetyTips from './FireSafetyTips';

test('keeps the dashboard safety preview compact and opens the complete tips on demand', () => {
  render(<FireSafetyTips />);

  expect(screen.getByRole('heading', { name: 'Fire safety tips' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Fire prevention tips' })).not.toBeInTheDocument();
  expect(screen.queryByText('Never leave cooking unattended')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /View tips/i }));
  const dialog = screen.getByRole('dialog', { name: 'Fire safety tips' });
  expect(within(dialog).getByRole('heading', { name: 'Fire prevention tips' })).toBeInTheDocument();
  expect(within(dialog).getByText('Never leave cooking unattended')).toBeInTheDocument();
  expect(within(dialog).getByText(/In case of fire, evacuate immediately and call 911/i)).toBeInTheDocument();
});

test('switches between warning signs and first aid tabs in the tips dialog', () => {
  render(<FireSafetyTips />);
  fireEvent.click(screen.getByRole('button', { name: /View tips/i }));
  const panel = screen.getByRole('tabpanel');

  fireEvent.click(screen.getByRole('tab', { name: /Warning signs/i }));
  expect(within(panel).getByRole('heading', { name: 'Fire warning signs to watch for' })).toBeInTheDocument();
  expect(within(panel).getByText('Burning or unusual smells')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('tab', { name: /Burn first aid/i }));
  expect(within(panel).getByRole('heading', { name: 'First aid for fire injuries' })).toBeInTheDocument();
  expect(within(panel).getByText('Cool minor burns with running water')).toBeInTheDocument();
  expect(within(panel).getByText(/Seek care for major burns/i)).toBeInTheDocument();
});
