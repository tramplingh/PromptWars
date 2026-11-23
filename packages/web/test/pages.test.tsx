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
    const details = screen.getByRole('region', { name: 'Biosignal Kit details' });
    expect(within(details).getByText('Down for maintenance')).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
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
