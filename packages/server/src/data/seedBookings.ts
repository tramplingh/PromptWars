import {
  addDays,
  isWeekend,
  workingDays,
  type Booking,
  type BookingStatus,
  type Project,
} from '@lablink/shared';

interface SeedSpec {
  id: string;
  equipmentId: string;
  userId: string;
  /** Working-day offset from today (0 = today or the next working day); negative = calendar days ago. */
  day: number;
  startHour: number;
  endHour: number;
  status: BookingStatus;
  /** Deadline as calendar days after the slot date. */
  deadlineAfterSlot: number;
  /** How many hours before "now" the request was created. */
  createdHoursAgo: number;
  project: Omit<Project, 'deadline'>;
}

const projects = {
  drone: {
    title: 'Autonomous inspection drone frame',
    summary:
      'Laser-cut carbon-acrylic airframe for a final-year drone that inspects solar panels autonomously.',
    requirements: ['laser-cutting', 'engraving'],
  },
  prosthetic: {
    title: 'EMG-controlled prosthetic hand',
    summary:
      'Low-cost prosthetic hand prototype; needs laser-cut finger linkages before the hackathon demo.',
    requirements: ['laser-cutting'],
  },
  microfluidic: {
    title: 'Paper-based microfluidic glucose sensor',
    summary:
      'Cutting wax-patterned channels and acrylic housings for a point-of-care diagnostic test.',
    requirements: ['laser-cutting'],
  },
  vision: {
    title: 'Crop disease detection with vision transformers',
    summary: 'Fine-tuning a ViT model on 40k leaf images for an M.Tech thesis submission.',
    requirements: ['gpu', 'deep-learning', 'cuda'],
  },
  ecgNet: {
    title: 'Arrhythmia detection from wearable ECG',
    summary: 'Training a 1D-CNN on the MIT-BIH dataset for a conference paper submission.',
    requirements: ['gpu', 'deep-learning'],
  },
  protein: {
    title: 'Protein folding surrogate model',
    summary:
      'Training a graph neural network to approximate folding energies for a biotech course project.',
    requirements: ['gpu', 'model-training'],
  },
  sdr: {
    title: 'Software-defined radio receiver',
    summary:
      'Debugging the I2C front-end and verifying the IF stage of an FM receiver mini-project.',
    requirements: ['oscilloscope', 'protocol-decoding'],
  },
  enclosure: {
    title: 'Smart irrigation controller enclosure',
    summary: 'Printing a weather-proof enclosure for an IoT irrigation controller field trial.',
    requirements: ['3d-printing', 'fdm'],
  },
  pcrStudy: {
    title: 'Antibiotic resistance gene screening',
    summary: 'Amplifying resistance markers from soil isolates for a semester research project.',
    requirements: ['pcr', 'dna-amplification'],
  },
  cells: {
    title: 'Biofilm imaging under stress conditions',
    summary: 'Fluorescence imaging of stained biofilms to quantify growth under antibiotic stress.',
    requirements: ['fluorescence', 'cell-imaging'],
  },
  vrTour: {
    title: 'Virtual campus tour for open day',
    summary: 'Testing a Unity walkthrough of the new workshop for the open-day stall.',
    requirements: ['vr', '3d-rendering'],
  },
  vrMolecules: {
    title: 'VR protein visualiser',
    summary: 'Interactive VR view of folded protein structures for a biotech outreach demo.',
    requirements: ['vr'],
  },
} satisfies Record<string, Omit<Project, 'deadline'>>;

const specs: SeedSpec[] = [
  // Recent history — gives Arjun and Zara prior usage, which the fairness factor accounts for.
  {
    id: 'bk-seed-h1',
    equipmentId: 'laser-60w',
    userId: 's-arjun',
    day: -3,
    startHour: 10,
    endHour: 13,
    status: 'approved',
    deadlineAfterSlot: 14,
    createdHoursAgo: 120,
    project: projects.drone,
  },
  {
    id: 'bk-seed-h2',
    equipmentId: 'laser-60w',
    userId: 's-arjun',
    day: -2,
    startHour: 13,
    endHour: 16,
    status: 'approved',
    deadlineAfterSlot: 13,
    createdHoursAgo: 100,
    project: projects.drone,
  },
  {
    id: 'bk-seed-h3',
    equipmentId: 'gpu-4090',
    userId: 's-zara',
    day: -2,
    startHour: 9,
    endHour: 13,
    status: 'approved',
    deadlineAfterSlot: 10,
    createdHoursAgo: 90,
    project: projects.vision,
  },

  // Upcoming confirmed bookings.
  {
    id: 'bk-seed-a1',
    equipmentId: 'dso-keysight',
    userId: 's-priya',
    day: 0,
    startHour: 10,
    endHour: 12,
    status: 'approved',
    deadlineAfterSlot: 9,
    createdHoursAgo: 40,
    project: projects.sdr,
  },
  {
    id: 'bk-seed-a2',
    equipmentId: 'gpu-4090',
    userId: 's-zara',
    day: 0,
    startHour: 9,
    endHour: 13,
    status: 'approved',
    deadlineAfterSlot: 8,
    createdHoursAgo: 60,
    project: projects.vision,
  },
  {
    id: 'bk-seed-a3',
    equipmentId: 'printer-prusa',
    userId: 's-arjun',
    day: 0,
    startHour: 9,
    endHour: 15,
    status: 'approved',
    deadlineAfterSlot: 10,
    createdHoursAgo: 30,
    project: projects.enclosure,
  },
  {
    id: 'bk-seed-a4',
    equipmentId: 'pcr-thermo',
    userId: 's-rohan',
    day: 1,
    startHour: 13,
    endHour: 16,
    status: 'approved',
    deadlineAfterSlot: 12,
    createdHoursAgo: 50,
    project: projects.pcrStudy,
  },
  {
    id: 'bk-seed-a5',
    equipmentId: 'dso-keysight',
    userId: 's-priya',
    day: 1,
    startHour: 14,
    endHour: 16,
    status: 'approved',
    deadlineAfterSlot: 8,
    createdHoursAgo: 20,
    project: projects.sdr,
  },

  // Conflict 1: three requests for the single 60 W laser cutter in overlapping windows.
  {
    id: 'bk-seed-c1',
    equipmentId: 'laser-60w',
    userId: 's-arjun',
    day: 2,
    startHour: 10,
    endHour: 12,
    status: 'pending',
    deadlineAfterSlot: 10,
    createdHoursAgo: 30,
    project: projects.drone,
  },
  {
    id: 'bk-seed-c2',
    equipmentId: 'laser-60w',
    userId: 's-priya',
    day: 2,
    startHour: 10,
    endHour: 13,
    status: 'pending',
    deadlineAfterSlot: 1,
    createdHoursAgo: 5,
    project: projects.prosthetic,
  },
  {
    id: 'bk-seed-c3',
    equipmentId: 'laser-60w',
    userId: 's-rohan',
    day: 2,
    startHour: 11,
    endHour: 12,
    status: 'pending',
    deadlineAfterSlot: 18,
    createdHoursAgo: 50,
    project: projects.microfluidic,
  },

  // Conflict 2: three requests for two GPU workstations.
  {
    id: 'bk-seed-c4',
    equipmentId: 'gpu-4090',
    userId: 's-zara',
    day: 3,
    startHour: 14,
    endHour: 18,
    status: 'pending',
    deadlineAfterSlot: 4,
    createdHoursAgo: 12,
    project: projects.vision,
  },
  {
    id: 'bk-seed-c5',
    equipmentId: 'gpu-4090',
    userId: 's-priya',
    day: 3,
    startHour: 14,
    endHour: 16,
    status: 'pending',
    deadlineAfterSlot: 12,
    createdHoursAgo: 8,
    project: projects.ecgNet,
  },
  {
    id: 'bk-seed-c6',
    equipmentId: 'gpu-4090',
    userId: 's-rohan',
    day: 3,
    startHour: 15,
    endHour: 17,
    status: 'pending',
    deadlineAfterSlot: 6,
    createdHoursAgo: 26,
    project: projects.protein,
  },

  // A simple pending approval with no contention.
  {
    id: 'bk-seed-p1',
    equipmentId: 'microscope-fluor',
    userId: 's-rohan',
    day: 1,
    startHour: 10,
    endHour: 12,
    status: 'pending',
    deadlineAfterSlot: 9,
    createdHoursAgo: 18,
    project: projects.cells,
  },
];

/**
 * Background usage from the wider student body over the previous working week.
 * It makes the utilisation dashboard realistic without affecting the demo
 * personas' fairness scores (these users are not selectable personas).
 */
const HISTORY: [equipmentId: string, workingDaysAgo: number, startHour: number, endHour: number][] =
  [
    ['gpu-4090', 1, 9, 13],
    ['gpu-4090', 1, 13, 17],
    ['gpu-4090', 2, 9, 13],
    ['gpu-4090', 2, 14, 18],
    ['gpu-4090', 3, 10, 14],
    ['gpu-4090', 4, 8, 12],
    ['gpu-4090', 4, 13, 17],
    ['gpu-4090', 5, 9, 13],
    ['printer-prusa', 1, 9, 15],
    ['printer-prusa', 2, 10, 16],
    ['printer-prusa', 3, 9, 15],
    ['printer-prusa', 5, 11, 17],
    ['printer-bambu', 2, 10, 16],
    ['printer-bambu', 4, 9, 15],
    ['dso-keysight', 1, 10, 13],
    ['dso-keysight', 2, 14, 17],
    ['dso-keysight', 3, 9, 12],
    ['fpga-zedboard', 2, 10, 14],
    ['fpga-zedboard', 4, 13, 17],
    ['jetson-orin', 1, 14, 18],
    ['jetson-orin', 3, 10, 14],
    ['pcr-thermo', 2, 9, 13],
    ['pcr-thermo', 4, 13, 17],
    ['laser-40w', 3, 11, 14],
    ['stm32-kit', 1, 10, 13],
    ['microscope-fluor', 3, 10, 13],
  ];

function previousWorkingDay(today: string, count: number): string {
  let date = today;
  for (let found = 0; found < count;) {
    date = addDays(date, -1);
    if (!isWeekend(date)) found++;
  }
  return date;
}

function buildHistory(today: string, nowMs: number): Booking[] {
  return HISTORY.map(([equipmentId, ago, startHour, endHour], i) => {
    const date = previousWorkingDay(today, ago);
    const at = new Date(nowMs - (ago + 2) * 86_400_000).toISOString();
    return {
      id: `bk-seed-history-${i + 1}`,
      equipmentId,
      userId: `campus-student-${(i % 9) + 1}`,
      slot: { date, startHour, endHour },
      project: {
        title: 'Course lab work',
        summary: 'Routine coursework and project session.',
        deadline: addDays(date, 14),
        requirements: [],
      },
      status: 'approved',
      createdAt: at,
      checkedInAt: at,
      decision: { by: 'system', note: 'Seeded demo booking', at },
    };
  });
}

/**
 * Check-in demo built around the current campus hour (when labs are open):
 * - Priya has a walk-up oscilloscope session starting now (her "Check in" button is live);
 * - Arjun's VR session started an hour ago with no check-in → released as a no-show
 *   on the first API read, and Rohan's queued request is backfilled into the slot.
 */
function liveSpecs(hour: number): SeedSpec[] {
  const specs: SeedSpec[] = [];
  if (hour >= 9 && hour <= 16) {
    specs.push({
      id: 'bk-seed-w1',
      equipmentId: 'dso-keysight',
      userId: 's-priya',
      day: 0,
      startHour: hour,
      endHour: hour + 2,
      status: 'approved',
      deadlineAfterSlot: 9,
      createdHoursAgo: 0,
      project: projects.sdr,
    });
  }
  if (hour >= 9 && hour <= 20) {
    specs.push(
      {
        id: 'bk-seed-n1',
        equipmentId: 'vr-station',
        userId: 's-arjun',
        day: 0,
        startHour: hour - 1,
        endHour: hour + 1,
        status: 'approved',
        deadlineAfterSlot: 7,
        createdHoursAgo: 24,
        project: projects.vrTour,
      },
      {
        id: 'bk-seed-n2',
        equipmentId: 'vr-station',
        userId: 's-rohan',
        day: 0,
        startHour: hour,
        endHour: hour + 2,
        status: 'pending',
        deadlineAfterSlot: 5,
        createdHoursAgo: 3,
        project: projects.vrMolecules,
      },
    );
  }
  return specs;
}

/** Yesterday's no-show and the backfill it enabled, so the updates feed shows the full story. */
function yesterdayStory(today: string, nowMs: number): Booking[] {
  const date = previousWorkingDay(today, 1);
  const at = new Date(nowMs - 22 * 3_600_000).toISOString();
  const base = {
    equipmentId: 'printer-bambu',
    slot: { date, startHour: 10, endHour: 12 },
    createdAt: new Date(nowMs - 48 * 3_600_000).toISOString(),
  };
  return [
    {
      ...base,
      id: 'bk-seed-y1',
      userId: 's-zara',
      project: {
        ...projects.enclosure,
        title: 'Sensor housing for vision rig',
        deadline: addDays(date, 6),
      },
      status: 'no-show',
      decision: { by: 'system', note: 'Released: no check-in within 15 minutes of the start', at },
    },
    {
      ...base,
      id: 'bk-seed-y2',
      userId: 's-rohan',
      project: {
        ...projects.enclosure,
        title: 'Microfluidic chip holder',
        deadline: addDays(date, 4),
      },
      status: 'approved',
      backfilledFrom: 'bk-seed-y1',
      checkedInAt: at,
      decision: { by: 'system', note: 'Auto-approved: slot released by a no-show', at },
    },
  ];
}

/**
 * Builds demo bookings relative to the current date (and campus hour) so the
 * calendar always looks lived-in, whenever the app is started.
 */
export function buildSeedBookings(today: string, nowIso: string, hour = 10): Booking[] {
  const upcoming = workingDays(today, 10);
  const nowMs = Date.parse(nowIso);
  // The live demo replaces Priya's fixed oscilloscope session when labs are open.
  const live = liveSpecs(upcoming[0] === today ? hour : -1);
  const fixed = specs.filter(
    (s) => !(s.id === 'bk-seed-a1' && live.some((l) => l.id === 'bk-seed-w1')),
  );

  return [
    ...buildHistory(today, nowMs),
    ...yesterdayStory(today, nowMs),
    ...[...fixed, ...live].map((s): Booking => {
      const date = s.day >= 0 ? upcoming[s.day]! : addDays(today, s.day);
      const decidedAt = new Date(
        nowMs - Math.max(0, s.createdHoursAgo - 1) * 3_600_000,
      ).toISOString();
      // Sessions that already started were attended — except the live no-show demo.
      const started = date < today || (date === today && s.startHour < hour);
      const attended = s.status === 'approved' && started && s.id !== 'bk-seed-n1';
      return {
        id: s.id,
        equipmentId: s.equipmentId,
        userId: s.userId,
        slot: { date, startHour: s.startHour, endHour: s.endHour },
        project: { ...s.project, deadline: addDays(date, s.deadlineAfterSlot) },
        status: s.status,
        createdAt: new Date(nowMs - s.createdHoursAgo * 3_600_000).toISOString(),
        ...(s.status === 'approved' && {
          decision: { by: 'system', note: 'Seeded demo booking', at: decidedAt },
        }),
        ...(attended && { checkedInAt: decidedAt }),
      };
    }),
  ];
}
