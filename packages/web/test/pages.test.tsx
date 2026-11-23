import type { ActivityEvent, Catalog, LiveStatus, Persona } from '@lablink/shared';
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
  departmentId: 'mech',
  title: 'Faculty',
};

const catalog: Catalog = {
  departments: [
    { id: 'ece', code: 'ECE', name: 'Electronics' },
    { id: 'bio', code: 'BIO', name: 'Biotech' },
  ],
  // Real lab ids so the campus map can place pins.
  labs: [
    {
      id: 'ece-adv',
      name: 'Electronics Lab',
      departmentId: 'ece',
      location: 'ECE 204',
      openHour: 9,
      closeHour: 18,
    },
    {
      id: 'bio-mol',
      name: 'Bio Lab',
      departmentId: 'bio',
      location: 'Bio 3',
      openHour: 9,
      closeHour: 17,
    },
  ],
  equipment: [
    {
      id: 'dso',
      name: 'Oscilloscope',
      category: 'Electronics',
      labId: 'ece-adv',
      departmentId: 'ece',
      description: 'Scope',
      capabilities: ['oscilloscope'],
      units: 2,
      requiresApproval: false,
      status: 'operational',
      maxHoursPerBooking: 3,
    },
    {
      id: 'emg',
      name: 'Biosignal Kit',
      category: 'Biotech',
      labId: 'bio-mol',
      departmentId: 'bio',
      description: 'EMG sensors',
      capabilities: ['emg'],
      units: 1,
      requiresApproval: true,
      status: 'maintenance',
      maxHoursPerBooking: 3,
    },
  ],
};

const live: LiveStatus[] = [
  { equipmentId: 'dso', state: 'available', freeUnits: 2 },
  { equipmentId: 'emg', state: 'maintenance', freeUnits: 0 },
];

const activity: ActivityEvent[] = [
  {
    id: 'b1:approved',
    type: 'approved',
    at: new Date().toISOString(),
    bookingId: 'b1',
    equipmentId: 'dso',
    equipmentName: 'Oscilloscope',
    studentName: 'Priya Sharma',
    slot: { date: '2099-01-05', startHour: 10, endHour: 12 },
    projectTitle: 'Radio receiver',
    deadline: '2099-01-20',
  },
];

const baseRoutes = {
  'GET /session': { persona: priya },
  'GET /personas': [priya, rao],
  'GET /catalog': catalog,
  'GET /equipment/status': live,
  'GET /activity': activity,
  'GET /bookings/mine': [],
};

afterEach(() => vi.unstubAllGlobals());

describe('equipment catalogue', () => {
  it('lists, filters and shows live status', async () => {
    mockApi(baseRoutes);
    renderWithProviders(<App />, { route: '/equipment' });
    expect(await screen.findByRole('link', { name: 'Oscilloscope' })).toBeInTheDocument();
    expect(await screen.findByText('2 units free now')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Department'), 'bio');
    expect(screen.queryByRole('link', { name: 'Oscilloscope' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Biosignal Kit' })).toBeInTheDocument();
  });

  it('switches to an accessible table view', async () => {
    mockApi(baseRoutes);
    renderWithProviders(<App />, { route: '/equipment' });
    await screen.findByRole('link', { name: 'Oscilloscope' });
    await userEvent.click(screen.getByRole('button', { name: 'Table' }));
    const table = screen.getByRole('table', { name: 'Equipment catalogue' });
    expect(within(table).getByRole('rowheader', { name: /Oscilloscope/ })).toBeInTheDocument();
  });

  it('shows AI matches with reasons and provenance', async () => {
    mockApi({
      ...baseRoutes,
      'POST /ai/search': {
        source: 'gemini',
        results: [{ equipmentId: 'emg', reason: 'Captures EMG from forearm muscles.' }],
      },
    });
    renderWithProviders(<App />, { route: '/equipment' });
    await userEvent.type(await screen.findByLabelText('Describe what you need'), 'muscle signals');
    await userEvent.click(screen.getByRole('button', { name: 'Find equipment' }));
    const results = await screen.findByRole('region', { name: /Best matches/ });
    expect(within(results).getByText('Captures EMG from forearm muscles.')).toBeInTheDocument();
    expect(within(results).getByText('Gemini')).toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    mockApi(baseRoutes);
    const { container } = renderWithProviders(<App />, { route: '/equipment' });
    await screen.findByText('2 units free now');
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('dashboard', () => {
  it('greets the student, shows fair-share usage and the updates feed', async () => {
    mockApi(baseRoutes);
    const { container } = renderWithProviders(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: /Priya/ })).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Fair-share usage' })).toBeInTheDocument();
    const feed = screen.getByRole('region', { name: 'Updates' });
    await userEvent.click(within(feed).getByRole('tab', { name: /Decisions/ }));
    expect(
      await within(feed).findByText(/Priya Sharma was approved for Oscilloscope/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main',
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('campus map', () => {
  it('labels every pin with name, lab and live status', async () => {
    mockApi(baseRoutes);
    const { container } = renderWithProviders(<App />, { route: '/map' });
    const map = await screen.findByRole('group', { name: 'Campus map' });
    await waitFor(() =>
      expect(
        within(map).getByRole('button', {
          name: /Oscilloscope, Electronics Lab: 2 units free now/,
        }),
      ).toBeInTheDocument(),
    );
    await userEvent.click(within(map).getByRole('button', { name: /Biosignal Kit/ }));
    const details = screen.getByRole('complementary', { name: 'Biosignal Kit details' });
    expect(within(details).getByText('Down for maintenance')).toBeInTheDocument();
    // Priya is in ECE, the kit is in Bio Sciences: the walking route is explained in text.
    expect(within(details).getByText(/Route shown: ECE Block → Bio Sciences/)).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('opens a building panel listing its equipment', async () => {
    mockApi(baseRoutes);
    renderWithProviders(<App />, { route: '/map' });
    const map = await screen.findByRole('group', { name: 'Campus map' });
    await userEvent.click(
      within(map).getByRole('button', {
        name: /^ECE Block\s*· You \(your department\)\s*, 1 item$/,
      }),
    );
    const panel = screen.getByRole('complementary', { name: 'ECE Block details' });
    expect(within(panel).getByRole('button', { name: /Oscilloscope/ })).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole('button', { name: 'Close details' }));
    expect(
      screen.queryByRole('complementary', { name: 'ECE Block details' }),
    ).not.toBeInTheDocument();
  });
});

describe('role-aware shell', () => {
  it('shows student navigation and hides faculty pages', async () => {
    mockApi(baseRoutes);
    renderWithProviders(<App />);
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    await waitFor(() =>
      expect(within(nav).getByRole('link', { name: 'My bookings' })).toBeInTheDocument(),
    );
    expect(within(nav).queryByRole('link', { name: /Approvals/ })).not.toBeInTheDocument();
  });

  it('switches profile from the profile menu', async () => {
    const fetchMock = mockApi({ ...baseRoutes, 'POST /session': { persona: rao } });
    renderWithProviders(<App />);
    await userEvent.click(await screen.findByRole('button', { name: /Viewing as Priya Sharma/ }));
    const menu = screen.getByRole('dialog', { name: 'Switch profile' });
    await userEvent.click(within(menu).getByRole('button', { name: /Dr. Kavitha Rao/ }));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/session',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ personaId: 'f-rao' }) }),
    );
  });

  it('shows unread alerts in the notifications panel', async () => {
    mockApi(baseRoutes);
    renderWithProviders(<App />);
    const bell = await screen.findByRole('button', { name: /Notifications, 1 unread/ });
    await userEvent.click(bell);
    const panel = screen.getByRole('dialog', { name: 'Notifications' });
    expect(within(panel).getByText(/was approved for Oscilloscope/)).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).not.toBeInTheDocument();
    expect(bell).toHaveFocus();
  });

  it('explains when a page is not available for the current role', async () => {
    mockApi(baseRoutes);
    renderWithProviders(<App />, { route: '/approvals' });
    expect(await screen.findByText(/isn’t available for your current profile/)).toBeInTheDocument();
  });

  it('auto-selects a demo profile instead of showing a login page', async () => {
    const fetchMock = mockApi({
      ...baseRoutes,
      'GET /session': { persona: null },
      'POST /session': { persona: priya },
    });
    renderWithProviders(<App />);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/session',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ personaId: 's-priya' }) }),
      ),
    );
  });
});

describe('project planner', () => {
  const plan = {
    source: 'gemini',
    title: 'Drone build',
    summary: 'Scope the sensors then cut the frame.',
    deadline: '2099-01-20',
    feasible: true,
    finish: { date: '2099-01-06', hour: 12 },
    slackDays: 14,
    steps: [
      {
        id: 's1',
        title: 'Debug sensors',
        purpose: 'Check I2C signals',
        requirements: ['oscilloscope'],
        hours: 2,
        dependsOn: [],
        schedule: {
          stepId: 's1',
          status: 'scheduled',
          equipmentId: 'dso',
          fit: 1,
          sessions: [{ date: '2099-01-05', startHour: 10, endHour: 12 }],
        },
      },
      {
        id: 's2',
        title: 'Record EMG',
        purpose: 'Capture muscle data',
        requirements: ['emg'],
        hours: 2,
        dependsOn: ['s1'],
        schedule: {
          stepId: 's2',
          status: 'unschedulable',
          reason: 'No operational equipment on campus offers these capabilities',
        },
      },
    ],
  };

  it('shows ordered steps, assignments, gaps and books the plan', async () => {
    const fetchMock = mockApi({
      ...baseRoutes,
      'POST /planner/plan': plan,
      'POST /planner/book': {
        results: [
          {
            equipmentId: 'dso',
            slot: { date: '2099-01-05', startHour: 10, endHour: 12 },
            outcome: 'confirmed',
            bookingId: 'b1',
          },
        ],
      },
    });
    const { container } = renderWithProviders(<App />, { route: '/planner' });
    await userEvent.type(
      await screen.findByLabelText('Project description'),
      'Drone: debug sensors with a scope and record EMG',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Plan my project' }));

    const steps = await screen.findByRole('list', { name: 'Plan steps in order' });
    expect(
      within(steps).getByRole('heading', { name: 'Step 1: Debug sensors' }),
    ).toBeInTheDocument();
    expect(within(steps).getByRole('link', { name: 'Oscilloscope' })).toBeInTheDocument();
    expect(within(steps).getByText(/No operational equipment/)).toBeInTheDocument();
    expect(within(steps).getByText(/after step 1/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Book all 1 session' }));
    expect(await screen.findByRole('heading', { name: 'Booking results' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/planner/book',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('check-in', () => {
  it('shows staff the kiosk code and today’s sessions', async () => {
    mockApi({
      ...baseRoutes,
      'GET /session': { persona: rao },
      'GET /equipment/dso/kiosk': {
        equipmentId: 'dso',
        date: '2099-01-05',
        code: 'ABC234',
        sessions: [
          {
            id: 'b1',
            equipmentId: 'dso',
            userId: 's-priya',
            userName: 'Priya Sharma',
            equipmentName: 'Oscilloscope',
            slot: { date: '2099-01-05', startHour: 10, endHour: 12 },
            project: { title: 'Radio', summary: 'x', deadline: '2099-01-20', requirements: [] },
            status: 'no-show',
            createdAt: '2099-01-01T00:00:00Z',
          },
        ],
      },
    });
    const { container } = renderWithProviders(<App />, { route: '/kiosk/dso' });
    expect(await screen.findByLabelText('Check-in code A B C 2 3 4')).toBeInTheDocument();
    expect(screen.getByText('No-show · released')).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('checks the student in from the kiosk QR link', async () => {
    const fetchMock = mockApi({
      ...baseRoutes,
      'POST /check-in': {
        id: 'b1',
        equipmentId: 'dso',
        equipmentName: 'Oscilloscope',
        slot: { date: '2099-01-05', startHour: 10, endHour: 12 },
      },
    });
    renderWithProviders(<App />, { route: '/check-in?e=dso&c=abc234' });
    expect(await screen.findByText('Checked in to Oscilloscope')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/check-in',
      expect.objectContaining({ body: JSON.stringify({ equipmentId: 'dso', code: 'ABC234' }) }),
    );
  });
});
