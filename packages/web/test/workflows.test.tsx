import type {
  AllocationPlan,
  ApprovalQueue,
  BookingView,
  Catalog,
  Equipment,
  EquipmentDetail,
  Persona,
  PriorityScore,
  ScoredBooking,
  UtilisationReport,
} from '@lablink/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { axeViolations, mockApi, renderWithProviders } from './utils';

const priya: Persona = {
  id: 's-priya',
  name: 'Priya Sharma',
  role: 'student',
  departmentId: 'ece',
  title: 'B.Tech ECE',
};
const rao: Persona = {
  id: 'f-rao',
  name: 'Dr. Kavitha Rao',
  role: 'faculty',
  departmentId: 'ece',
  title: 'Faculty',
};

const lab = {
  id: 'ece-adv',
  name: 'Electronics Lab',
  departmentId: 'ece',
  location: 'ECE 204',
  openHour: 9,
  closeHour: 18,
};
const scope: Equipment = {
  id: 'dso',
  name: 'Oscilloscope',
  category: 'Electronics',
  labId: 'ece-adv',
  departmentId: 'ece',
  description: 'Four-channel scope',
  capabilities: ['oscilloscope', 'signal-analysis'],
  units: 1,
  requiresApproval: false,
  status: 'operational',
  maxHoursPerBooking: 3,
};
const department = { id: 'ece', code: 'ECE', name: 'Electronics' };
const catalog: Catalog = { departments: [department], labs: [lab], equipment: [scope] };

const DAY = '2099-01-05';
const detail: EquipmentDetail = {
  equipment: scope,
  lab,
  department,
  availability: [
    {
      date: DAY,
      hours: Array.from({ length: 9 }, (_, i) => ({
        hour: 9 + i,
        approved: 0,
        pending: 0,
        free: 1,
      })),
    },
  ],
};

const project = {
  title: 'Radio receiver',
  summary: 'Characterising an FM front-end on the bench oscilloscope',
  deadline: '2099-01-20',
  requirements: ['oscilloscope'],
};
const booking = (over: Partial<BookingView>): BookingView => ({
  id: 'b1',
  equipmentId: 'dso',
  equipmentName: 'Oscilloscope',
  userId: 's-priya',
  userName: 'Priya Sharma',
  slot: { date: DAY, startHour: 10, endHour: 12 },
  project,
  status: 'approved',
  createdAt: '2098-12-30T10:00:00Z',
  ...over,
});

const score: PriorityScore = {
  total: 72,
  breakdown: { urgency: 30, fairness: 20, fit: 15, waiting: 7 },
  feasible: true,
  reasons: ['Deadline in 15 days'],
};
const scored = (over: Partial<BookingView>, conflictId?: string): ScoredBooking => ({
  ...booking({ status: 'pending', ...over }),
  score,
  ...(conflictId ? { conflictId } : {}),
});

const base = {
  'GET /personas': [priya, rao],
  'GET /catalog': catalog,
  'GET /equipment/status': [{ equipmentId: 'dso', state: 'available', freeUnits: 1 }],
  'GET /activity': [],
  'GET /bookings/mine': [],
};

afterEach(() => vi.unstubAllGlobals());

describe('booking a slot', () => {
  it('validates the form, then books and returns to My bookings', async () => {
    const fetchMock = mockApi({
      ...base,
      'GET /session': { persona: priya },
      'GET /equipment/dso': detail,
      'POST /bookings': { booking: booking({}), outcome: 'confirmed' },
    });
    const user = userEvent.setup();
    renderWithProviders(<App />, { route: '/equipment/dso' });

    await screen.findByRole('heading', { name: 'Oscilloscope', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Book now' }));
    expect(await screen.findByText('Choose a start time on the calendar first.')).toBeVisible();

    await user.click(screen.getAllByRole('button', { name: /10AM: Free/ })[0] as HTMLElement);
    await user.type(screen.getByLabelText('Project title'), project.title);
    await user.type(screen.getByLabelText('What will you do on this equipment?'), project.summary);
    await user.type(screen.getByLabelText(/Project deadline/), project.deadline);
    await user.click(screen.getByRole('button', { name: 'Book now' }));

    expect(await screen.findByRole('heading', { name: 'My bookings' })).toBeVisible();
    expect(screen.getByText('Booked! Your slot is confirmed.')).toBeVisible();
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({
      equipmentId: 'dso',
      slot: { date: DAY, startHour: 10, endHour: 11 },
    });
  });

  it('shows staff a hint instead of the booking form', async () => {
    mockApi({ ...base, 'GET /session': { persona: rao }, 'GET /equipment/dso': detail });
    renderWithProviders(<App />, { route: '/equipment/dso' });
    expect(await screen.findByText(/Bookings are made by students/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Book now' })).not.toBeInTheDocument();
  });
});

describe('my bookings', () => {
  it('splits upcoming and history and has no accessibility violations', async () => {
    mockApi({
      ...base,
      'GET /session': { persona: priya },
      'GET /bookings/mine': [
        booking({ id: 'b2', status: 'cancelled' }),
        booking({ id: 'b1', status: 'pending' }),
      ],
    });
    const { container } = renderWithProviders(<App />, { route: '/bookings' });
    expect(await screen.findByRole('heading', { name: 'Upcoming (1)' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'History' })).toBeVisible();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('points to the catalogue when empty', async () => {
    mockApi({ ...base, 'GET /session': { persona: priya } });
    renderWithProviders(<App />, { route: '/bookings' });
    expect(await screen.findByText('No upcoming bookings')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Browse equipment' })).toHaveAttribute(
      'href',
      '/equipment',
    );
  });
});

describe('approvals', () => {
  const conflictId = 'dso_2099-01-05_10-12';
  const plan: AllocationPlan = {
    conflict: {
      id: conflictId,
      equipmentId: 'dso',
      date: DAY,
      startHour: 10,
      endHour: 12,
      pendingIds: ['c1', 'c2'],
      approvedIds: [],
    },
    decisions: [
      { bookingId: 'c1', userId: 's-priya', rank: 1, outcome: 'allocate', score, alternatives: [] },
      {
        bookingId: 'c2',
        userId: 's-arjun',
        rank: 2,
        outcome: 'reassign',
        score: { ...score, total: 55 },
        alternatives: [
          {
            equipmentId: 'dso',
            slot: { date: DAY, startHour: 13, endHour: 15 },
            kind: 'same-equipment',
          },
        ],
      },
    ],
    summary: 'Give the slot to Priya and move Arjun to 1 pm.',
  } as AllocationPlan;
  const queue: ApprovalQueue = {
    conflicts: [plan],
    pending: [
      scored({ id: 'c1' }, conflictId),
      scored({ id: 'c2', userName: 'Arjun Mehta', userId: 's-arjun' }, conflictId),
      scored({ id: 'p1', userName: 'Meera Iyer', userId: 's-meera' }),
    ],
  };

  it('explains and applies a fair allocation, and decides standalone requests', async () => {
    const fetchMock = mockApi({
      ...base,
      'GET /session': { persona: rao },
      'GET /approvals': queue,
      [`POST /conflicts/${conflictId}/explain`]: {
        source: 'gemini',
        overview: 'Priya’s deadline is closer.',
        perStudent: [{ bookingId: 'c2', message: 'A 1 pm slot keeps you on track.' }],
      },
      [`POST /conflicts/${conflictId}/apply`]: { updated: [booking({}), booking({ id: 'c2' })] },
      'POST /approvals/p1/decision': booking({ id: 'p1' }),
    });
    const user = userEvent.setup();
    const { container } = renderWithProviders(<App />, { route: '/approvals' });

    const card = await screen.findByRole('article', { name: 'Oscilloscope' });
    expect(within(card).getByText(/Give the slot to Priya/)).toBeVisible();

    await user.click(within(card).getByRole('button', { name: 'Explain with AI' }));
    expect(await within(card).findByText('Priya’s deadline is closer.')).toBeVisible();
    expect(within(card).getByText(/A 1 pm slot keeps you on track/)).toBeVisible();

    await user.click(within(card).getByRole('button', { name: 'Apply fair allocation' }));
    expect(await screen.findByText(/Fair allocation applied to 2 requests/)).toBeVisible();

    expect(screen.getByRole('heading', { name: 'Other pending requests (1)' })).toBeVisible();
    await user.type(screen.getByLabelText(/Note to Meera Iyer/), 'Bring your own probes');
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('Approved Meera Iyer’s request.')).toBeVisible();
    const decision = fetchMock.mock.calls.find(([url]) => String(url).includes('/decision'));
    expect(JSON.parse(String(decision?.[1]?.body))).toEqual({
      decision: 'approve',
      note: 'Bring your own probes',
    });
    expect(await axeViolations(container)).toEqual([]);
  });

  it('shows empty states when the queue is clear', async () => {
    mockApi({
      ...base,
      'GET /session': { persona: rao },
      'GET /approvals': { conflicts: [], pending: [] },
    });
    renderWithProviders(<App />, { route: '/approvals' });
    expect(await screen.findByText('No conflicts right now')).toBeVisible();
    expect(screen.getByText('You’re all caught up')).toBeVisible();
  });
});

describe('insights', () => {
  const report: UtilisationReport = {
    from: '2099-01-05',
    to: '2099-01-16',
    overall: 0.42,
    items: [
      {
        equipmentId: 'dso',
        name: 'Oscilloscope',
        departmentId: 'ece',
        approvedHours: 21,
        pendingHours: 4,
        capacityHours: 50,
        utilisation: 0.42,
      },
    ],
    peakHours: [
      { hour: 10, load: 6 },
      { hour: 14, load: 3 },
    ],
  };

  it('reports utilisation with AI recommendations', async () => {
    mockApi({
      ...base,
      'GET /session': { persona: rao },
      'GET /insights/utilisation': report,
      'GET /insights/recommendations': {
        source: 'gemini',
        insights: [
          {
            title: 'Open a Saturday slot',
            detail: 'Mornings are saturated.',
            action: 'Extend hours',
          },
        ],
      },
    });
    const { container } = renderWithProviders(<App />, { route: '/insights' });
    expect(await screen.findByRole('heading', { name: 'Resource utilisation' })).toBeVisible();
    expect(screen.getByText('Hours awaiting approval')).toBeVisible();
    expect(screen.getByText('4h')).toBeVisible();
    expect(await screen.findByText('Open a Saturday slot')).toBeVisible();
    await waitFor(async () => expect(await axeViolations(container)).toEqual([]));
  });
});
