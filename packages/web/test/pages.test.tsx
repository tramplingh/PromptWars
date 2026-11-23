import type { Catalog, Persona } from '@lablink/shared';
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
  labs: [
    {
      id: 'l1',
      name: 'Electronics Lab',
      departmentId: 'ece',
      location: 'ECE 204',
      openHour: 9,
      closeHour: 18,
    },
    {
      id: 'l2',
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
      labId: 'l1',
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
      labId: 'l2',
      departmentId: 'bio',
      description: 'EMG sensors',
      capabilities: ['emg'],
      units: 1,
      requiresApproval: true,
      status: 'operational',
      maxHoursPerBooking: 3,
    },
  ],
};

const baseRoutes = {
  'GET /session': { persona: priya },
  'GET /personas': [priya, rao],
  'GET /catalog': catalog,
};

afterEach(() => vi.unstubAllGlobals());

describe('Discover page', () => {
  it('lists and filters the catalogue', async () => {
    mockApi(baseRoutes);
    renderWithProviders(<App />);
    expect(await screen.findByRole('link', { name: 'Oscilloscope' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Department'), 'bio');
    expect(screen.queryByRole('link', { name: 'Oscilloscope' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Biosignal Kit' })).toBeInTheDocument();
  });

  it('shows AI matches with reasons and provenance', async () => {
    mockApi({
      ...baseRoutes,
      'POST /ai/search': {
        source: 'gemini',
        results: [{ equipmentId: 'emg', reason: 'Captures EMG from forearm muscles.' }],
      },
    });
    renderWithProviders(<App />);
    await userEvent.type(await screen.findByLabelText('Describe what you need'), 'muscle signals');
    await userEvent.click(screen.getByRole('button', { name: 'Find equipment' }));
    const results = await screen.findByRole('region', { name: /Best matches/ });
    expect(within(results).getByText('Captures EMG from forearm muscles.')).toBeInTheDocument();
    expect(within(results).getByText('Gemini')).toBeInTheDocument();
  });

  it('offers a skip link and has no detectable accessibility violations', async () => {
    mockApi(baseRoutes);
    const { container } = renderWithProviders(<App />);
    await screen.findByRole('link', { name: 'Oscilloscope' });
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main',
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('role-aware navigation', () => {
  it('shows student navigation and hides faculty pages', async () => {
    mockApi(baseRoutes);
    renderWithProviders(<App />);
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    await waitFor(() =>
      expect(within(nav).getByRole('link', { name: 'My bookings' })).toBeInTheDocument(),
    );
    expect(within(nav).queryByRole('link', { name: /Approvals/ })).not.toBeInTheDocument();
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
