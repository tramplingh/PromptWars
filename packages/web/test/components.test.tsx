import type { DayAvailability, PriorityScore } from '@lablink/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AvailabilityGrid } from '../src/components/AvailabilityGrid';
import { AiSourceBadge, StatusBadge } from '../src/components/Badges';
import { ScoreBreakdown } from '../src/components/ScoreBreakdown';
import { axeViolations } from './utils';

const FUTURE = '2099-01-05';
const days: DayAvailability[] = [
  {
    date: FUTURE,
    hours: [
      { hour: 9, approved: 0, pending: 0, free: 2 },
      { hour: 10, approved: 1, pending: 0, free: 1 },
      { hour: 11, approved: 2, pending: 0, free: 0 },
      { hour: 12, approved: 1, pending: 1, free: 0 },
    ],
  },
];

describe('AvailabilityGrid', () => {
  it('describes every cell in text, not only colour', () => {
    render(<AvailabilityGrid days={days} units={2} selection={null} onSelect={() => undefined} />);
    expect(screen.getByRole('button', { name: /9AM: available/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /10AM: 1 of 2 units available/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /11AM: fully booked/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /12PM: requested by others/ })).toBeEnabled();
  });

  it('selects a start time with the keyboard', async () => {
    const onSelect = vi.fn();
    render(<AvailabilityGrid days={days} units={2} selection={null} onSelect={onSelect} />);
    const cell = screen.getByRole('button', { name: /9AM: available/ });
    cell.focus();
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith(FUTURE, 9);
  });

  it('marks the selected range as pressed', () => {
    render(
      <AvailabilityGrid
        days={days}
        units={2}
        selection={{ date: FUTURE, startHour: 9, hours: 2 }}
        onSelect={() => undefined}
      />,
    );
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(2);
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = render(
      <AvailabilityGrid days={days} units={2} selection={null} onSelect={() => undefined} />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('ScoreBreakdown', () => {
  it('exposes each factor as an accessible meter', () => {
    const score: PriorityScore = {
      total: 72,
      feasible: true,
      reasons: [],
      breakdown: { urgency: 0.9, fairness: 0.5, fit: 1, waiting: 0.25 },
    };
    render(<ScoreBreakdown score={score} />);
    expect(screen.getByRole('meter', { name: 'Deadline urgency' })).toHaveAttribute(
      'aria-valuenow',
      '90',
    );
    expect(screen.getByRole('meter', { name: 'Waiting time' })).toHaveAttribute(
      'aria-valuenow',
      '25',
    );
  });
});

describe('badges', () => {
  it('labels statuses and AI provenance honestly', () => {
    render(
      <>
        <StatusBadge status="approved" />
        <AiSourceBadge source="fallback" />
      </>,
    );
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Smart rules')).toBeInTheDocument();
  });
});
