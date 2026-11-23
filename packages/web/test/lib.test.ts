import type {
  ActivityEvent,
  Equipment,
  LiveStatus,
  PlannedStepView,
  ProjectPlanResponse,
} from '@lablink/shared';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { eventsForTab, groupByDay, tabCounts } from '../src/lib/activityFeed';
import { maxBookableHours, toSlot, validateBooking } from '../src/lib/bookingValidation';
import { EMPTY_FILTER, filterCatalog, summariseLive } from '../src/lib/catalogFilters';
import {
  planBookingInput,
  prerequisiteNumbers,
  sessionCount,
  stepColor,
  STEP_COLORS,
  timelineDays,
} from '../src/lib/planItems';
import { isUrgent } from '../src/lib/policy';
import { usePersistentFlag, wrapTarget } from '../src/lib/shellHooks';
import { FILTER_MATCHES, buildPins, useMapSelection } from '../src/lib/useMapSelection';

const device = (over: Partial<Equipment>): Equipment => ({
  id: 'scope',
  name: 'Digital oscilloscope',
  category: 'Electronics',
  labId: 'lab-1',
  departmentId: 'ece',
  description: 'Four-channel scope',
  capabilities: ['signal-analysis'],
  units: 1,
  requiresApproval: false,
  status: 'operational',
  maxHoursPerBooking: 3,
  ...over,
});

const status = (equipmentId: string, state: LiveStatus['state']): LiveStatus => ({
  equipmentId,
  state,
  freeUnits: state === 'available' ? 1 : 0,
});

describe('catalogue filters', () => {
  const catalog = [
    device({ id: 'scope' }),
    device({
      id: 'sem',
      name: 'Electron microscope',
      departmentId: 'bio',
      category: 'Imaging & Optics',
      requiresApproval: true,
    }),
    device({
      id: 'laser',
      name: 'Laser cutter',
      capabilities: ['acrylic-cutting'],
      status: 'maintenance',
    }),
  ];
  const live = new Map([
    ['scope', status('scope', 'available')],
    ['sem', status('sem', 'in-use')],
    ['laser', status('laser', 'maintenance')],
  ]);
  const ids = (filter: Partial<typeof EMPTY_FILTER>) =>
    filterCatalog(catalog, { ...EMPTY_FILTER, ...filter }, live).map((e) => e.id);

  it('returns everything with the empty filter', () => {
    expect(ids({})).toEqual(['scope', 'sem', 'laser']);
  });

  it('filters by department, category and keyword (including capabilities)', () => {
    expect(ids({ department: 'bio' })).toEqual(['sem']);
    expect(ids({ category: 'Imaging & Optics' })).toEqual(['sem']);
    expect(ids({ keyword: '  ACRYLIC ' })).toEqual(['laser']);
  });

  it('separates "free now" from "instant booking"', () => {
    expect(ids({ availability: 'now' })).toEqual(['scope']);
    expect(ids({ availability: 'instant' })).toEqual(['scope']);
  });

  it('summarises live states, counting requested as busy', () => {
    const summary = summariseLive([...live.values(), status('x', 'requested')]);
    expect(summary).toEqual({ available: 1, busy: 2, down: 1 });
  });
});

describe('booking validation', () => {
  const project = {
    title: 'EMG prosthetic',
    summary: 'Capturing forearm muscle signals for a low-cost prosthetic hand',
    deadline: '2026-12-10',
    requirements: [],
  };
  const selection = { date: '2026-11-25', startHour: 10, hours: 2 };

  it('asks for a slot before anything else', () => {
    expect(validateBooking('scope', null, project)).toEqual({
      ok: false,
      errors: { slot: 'Choose a start time on the calendar first.' },
    });
  });

  it('maps schema issues to the matching field', () => {
    const result = validateBooking('scope', selection, {
      ...project,
      title: 'x',
      summary: 'short',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.title).toMatch(/title/i);
      expect(result.errors.summary).toMatch(/20 characters/);
    }
  });

  it('rejects a deadline before the booking date', () => {
    const result = validateBooking('scope', selection, { ...project, deadline: '2026-11-24' });
    expect(result).toEqual({
      ok: false,
      errors: { deadline: 'Your deadline must be on or after the booking date.' },
    });
  });

  it('returns the parsed request when valid', () => {
    const result = validateBooking('scope', selection, project);
    expect(result.ok && result.input.slot).toEqual(toSlot(selection));
    expect(toSlot(selection)).toEqual({ date: '2026-11-25', startHour: 10, endHour: 12 });
  });

  it('caps duration by the device limit and lab closing time', () => {
    expect(maxBookableHours(4, 18, null)).toBe(4);
    expect(maxBookableHours(4, 18, { ...selection, startHour: 16 })).toBe(2);
    expect(maxBookableHours(4, 18, { ...selection, startHour: 18 })).toBe(1);
  });
});

describe('activity feed', () => {
  const event = (type: ActivityEvent['type'], at: string): ActivityEvent => ({
    id: `${type}-${at}`,
    type,
    at,
    bookingId: 'b1',
    equipmentId: 'scope',
    equipmentName: 'Scope',
    studentName: 'Priya',
    slot: { date: '2026-11-25', startHour: 10, endHour: 12 },
    projectTitle: 'EMG',
    deadline: '2026-12-10',
  });
  const events = [
    event('requested', '2026-11-23T09:00:00'),
    event('approved', '2026-11-23T10:00:00'),
    event('no-show', '2026-11-20T10:00:00'),
    event('backfilled', '2026-11-20T10:05:00'),
  ];

  it('counts events per tab', () => {
    expect(tabCounts(events)).toEqual({ requests: 1, decisions: 1, reallocations: 2 });
  });

  it('filters a tab, optionally to unread events only', () => {
    expect(eventsForTab(events, 'reallocations')).toHaveLength(2);
    expect(eventsForTab(events, 'reallocations', '2026-11-20T10:01:00')).toHaveLength(1);
  });

  it('groups by day and drops empty groups', () => {
    const groups = groupByDay(events, '2026-11-23');
    expect(groups.map(([label, list]) => [label, list.length])).toEqual([
      ['Today', 2],
      ['Earlier this week', 2],
    ]);
    expect(groupByDay(events.slice(0, 2), '2026-11-23').map(([label]) => label)).toEqual(['Today']);
  });
});

describe('planner helpers', () => {
  const step = (id: string, over: Partial<PlannedStepView>): PlannedStepView => ({
    id,
    title: id,
    purpose: '',
    requirements: ['signal-analysis'],
    hours: 2,
    dependsOn: [],
    schedule: { stepId: id, status: 'unschedulable', reason: 'none' },
    ...over,
  });
  const plan: ProjectPlanResponse = {
    source: 'fallback',
    title: 'EMG',
    summary: 'Short',
    deadline: '2026-12-10',
    feasible: false,
    steps: [
      step('capture', {
        schedule: {
          stepId: 'capture',
          status: 'scheduled',
          equipmentId: 'scope',
          fit: 1,
          sessions: [
            { date: '2026-11-24', startHour: 9, endHour: 12 },
            { date: '2026-11-26', startHour: 9, endHour: 11 },
          ],
        },
      }),
      step('analyse', { dependsOn: ['capture', 'missing'] }),
    ],
  };

  it('counts scheduled sessions only', () => {
    expect(sessionCount(plan)).toBe(2);
  });

  it('builds one booking item per session and pads a short summary', () => {
    const input = planBookingInput(plan);
    expect(input.items).toHaveLength(2);
    expect(input.items[0]).toMatchObject({
      equipmentId: 'scope',
      requirements: ['signal-analysis'],
    });
    expect(input.project.summary.length).toBeGreaterThanOrEqual(20);
  });

  it('spans working days from the first to the last session', () => {
    expect(timelineDays(plan)).toEqual(['2026-11-24', '2026-11-25', '2026-11-26']);
    expect(timelineDays({ ...plan, steps: [] })).toEqual([]);
  });

  it('numbers prerequisites and ignores unknown ids', () => {
    expect(prerequisiteNumbers(plan, ['capture', 'missing'])).toEqual([1]);
  });

  it('cycles step colours', () => {
    expect(stepColor(STEP_COLORS.length)).toBe(STEP_COLORS[0]);
  });
});

describe('policy and focus helpers', () => {
  it('flags deadlines within three days as urgent', () => {
    expect(isUrgent('2026-11-26', '2026-11-23')).toBe(true);
    expect(isUrgent('2026-11-27', '2026-11-23')).toBe(false);
  });

  it('wraps focus only at either end of a trapped region', () => {
    const [a, b, c] = ['a', 'b', 'c'].map(() => document.createElement('button'));
    const all = [a, b, c] as HTMLElement[];
    expect(wrapTarget(all, c ?? null, false)).toBe(a);
    expect(wrapTarget(all, a ?? null, true)).toBe(c);
    expect(wrapTarget(all, b ?? null, false)).toBeNull();
    expect(wrapTarget([], null, false)).toBeNull();
  });
});

describe('usePersistentFlag', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('reads, toggles and remembers the flag', () => {
    window.localStorage.setItem('flag', '1');
    const { result } = renderHook(() => usePersistentFlag('flag'));
    expect(result.current[0]).toBe(true);
    act(() => result.current[1]());
    expect(result.current[0]).toBe(false);
    expect(window.localStorage.getItem('flag')).toBe('0');
  });

  it('falls back to memory when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => usePersistentFlag('flag'));
    expect(result.current[0]).toBe(false);
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
  });
});

describe('campus map selection', () => {
  const ece = device({ id: 'scope', departmentId: 'ece' });
  const bio = device({ id: 'sem', departmentId: 'bio' });
  const lookup = (id: string) => [ece, bio].find((e) => e.id === id);

  it('places every catalogue item on its department roof', () => {
    const pins = buildPins([ece, bio]);
    expect(pins.map((p) => [p.equipment.id, p.building.departmentId])).toEqual(
      expect.arrayContaining([
        ['scope', 'ece'],
        ['sem', 'bio'],
      ]),
    );
  });

  it('matches map filters to live states', () => {
    expect(FILTER_MATCHES.busy('requested')).toBe(true);
    expect(FILTER_MATCHES.available('in-use')).toBe(false);
    expect(FILTER_MATCHES.down('maintenance')).toBe(true);
    expect(FILTER_MATCHES.all(undefined)).toBe(true);
  });

  it('selects equipment with a route from home, then a building, then clears', () => {
    const { result } = renderHook(() => useMapSelection(lookup, 'ece'));
    act(() => result.current.selectEquipment('sem'));
    expect(result.current.selected?.id).toBe('sem');
    expect(result.current.activeBuilding?.departmentId).toBe('bio');
    expect(result.current.route.length).toBeGreaterThan(1);

    act(() => result.current.selectBuilding('ece'));
    expect(result.current.selected).toBeUndefined();
    expect(result.current.activeBuilding?.departmentId).toBe('ece');
    expect(result.current.route).toEqual([]);

    act(() => result.current.clear());
    expect(result.current.activeBuilding).toBeUndefined();
  });

  it('scrolls the matching list item into view for map clicks', () => {
    const { result } = renderHook(() => useMapSelection(lookup, undefined));
    const button = document.createElement('button');
    button.scrollIntoView = vi.fn();
    act(() => result.current.registerListItem('scope', button));
    act(() => result.current.selectEquipment('scope', true));
    expect(button.scrollIntoView).toHaveBeenCalled();
    act(() => result.current.registerListItem('scope', null));
  });
});
