/**
 * Schematic campus plan for the map view (presentation data only). Coordinates
 * are in an SVG viewBox of {@link MAP_WIDTH} × {@link MAP_HEIGHT}; each lab is a
 * rectangle that hosts its equipment pins.
 */
export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 620;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Building {
  departmentId: string;
  name: string;
  /** SVG polygon points. */
  points: string;
  label: { x: number; y: number };
  tone: 'blue' | 'green' | 'amber' | 'pink' | 'violet';
}

export const BUILDINGS: Building[] = [
  {
    departmentId: 'ece',
    name: 'ECE Block',
    points: '50,50 400,50 400,270 50,270',
    label: { x: 66, y: 74 },
    tone: 'blue',
  },
  {
    departmentId: 'cse',
    name: 'CSE Block',
    points: '450,50 720,50 720,250 450,250',
    label: { x: 466, y: 74 },
    tone: 'violet',
  },
  {
    departmentId: 'bio',
    name: 'Bio Sciences Block',
    points: '770,50 950,50 950,320 770,320',
    label: { x: 786, y: 74 },
    tone: 'pink',
  },
  {
    departmentId: 'mech',
    name: 'Mechanical Workshop',
    points: '50,330 470,330 470,570 50,570',
    label: { x: 66, y: 354 },
    tone: 'amber',
  },
  {
    departmentId: 'des',
    name: 'Design Centre',
    points: '540,360 850,360 850,570 540,570',
    label: { x: 556, y: 384 },
    tone: 'green',
  },
];

/** Lab rooms keyed by lab id. */
export const LAB_ROOMS: Record<string, Rect> = {
  'ece-adv': { x: 70, y: 92, w: 165, h: 160 },
  'ece-emb': { x: 250, y: 92, w: 130, h: 160 },
  'cse-ai': { x: 470, y: 92, w: 230, h: 140 },
  'bio-mol': { x: 790, y: 92, w: 140, h: 210 },
  'mech-fab': { x: 70, y: 372, w: 380, h: 180 },
  'des-studio': { x: 560, y: 402, w: 270, h: 150 },
};

/** Paths drawn as campus walkways between buildings. */
export const WALKWAYS = ['M0,300 H1000', 'M425,0 V620', 'M745,0 V340', 'M505,300 V620'];

/** Evenly distributes `count` pins inside a room, leaving space for the room label. */
export function pinPositions(room: Rect, count: number): { x: number; y: number }[] {
  if (count === 0) return [];
  const top = room.y + 34;
  const height = room.h - 44;
  const cols = Math.min(count, Math.max(1, Math.round(Math.sqrt((count * room.w) / height))));
  const rows = Math.ceil(count / cols);
  return Array.from({ length: count }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      x: room.x + ((col + 0.5) * room.w) / cols,
      y: top + ((row + 0.5) * height) / rows,
    };
  });
}
