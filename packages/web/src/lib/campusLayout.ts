/**
 * Isometric campus model for the map view (presentation data + pure geometry).
 *
 * The campus is described in flat "world" units on a ground plane (x to the
 * south-east, y to the south-west, z up) and projected to 2D with a classic
 * 2:1 isometric projection. Everything here is deterministic and unit-testable;
 * the React layer only draws the shapes it returns.
 */

export const SCALE = 7;
const COS = Math.cos(Math.PI / 6) * SCALE;
const SIN = Math.sin(Math.PI / 6) * SCALE;

export interface Point {
  x: number;
  y: number;
}

/** World (x, y, z) → screen point. */
export function project(x: number, y: number, z = 0): Point {
  return { x: (x - y) * COS, y: (x + y) * SIN - z * SCALE };
}

export const toPoints = (pts: Point[]) =>
  pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

export type Tone = 'blue' | 'violet' | 'pink' | 'amber' | 'green';

export interface Building {
  departmentId: string;
  name: string;
  /** Footprint origin (north corner) and size in world units. */
  x: number;
  y: number;
  w: number;
  d: number;
  /** Height in world units. */
  h: number;
  tone: Tone;
  /** Which side of the footprint faces the central avenue (where routes arrive). */
  door: 'front' | 'back';
}

/** Two rows of department buildings either side of a central avenue at y ≈ AVENUE_Y. */
export const AVENUE_Y = 38;
export const AVENUE_HALF_WIDTH = 3.5;
export const WORLD = { w: 94, d: 76 };

export const BUILDINGS: Building[] = [
  {
    departmentId: 'ece',
    name: 'ECE Block',
    x: 6,
    y: 8,
    w: 26,
    d: 20,
    h: 9,
    tone: 'blue',
    door: 'front',
  },
  {
    departmentId: 'cse',
    name: 'CSE Block',
    x: 39,
    y: 10,
    w: 22,
    d: 17,
    h: 13,
    tone: 'violet',
    door: 'front',
  },
  {
    departmentId: 'bio',
    name: 'Bio Sciences',
    x: 68,
    y: 7,
    w: 19,
    d: 22,
    h: 8,
    tone: 'pink',
    door: 'front',
  },
  {
    departmentId: 'mech',
    name: 'Mechanical Workshop',
    x: 8,
    y: 48,
    w: 30,
    d: 22,
    h: 6,
    tone: 'amber',
    door: 'back',
  },
  {
    departmentId: 'des',
    name: 'Design Centre',
    x: 48,
    y: 49,
    w: 22,
    d: 16,
    h: 8,
    tone: 'green',
    door: 'back',
  },
];

/** Accent colours per department (roof trim, windows, selection). */
export const TONE_ACCENT: Record<Tone, string> = {
  blue: '#2563eb',
  violet: '#7c3aed',
  pink: '#db2777',
  amber: '#d97706',
  green: '#16a34a',
};

/** Decorative trees (world x, y). */
export const TREES: [number, number][] = [
  [35, 20],
  [36, 26],
  [63, 24],
  [91, 14],
  [92, 24],
  [4, 34],
  [52, 71],
  [76, 54],
  [80, 62],
  [86, 70],
  [24, 73],
  [40, 46],
];

export interface BuildingFaces {
  top: string;
  left: string;
  right: string;
  shadow: string;
}

/** Polygons for the visible faces of a box: top, south-west (left) and south-east (right). */
export function buildingFaces(b: Building): BuildingFaces {
  const { x, y, w, d, h } = b;
  return {
    top: toPoints([
      project(x, y, h),
      project(x + w, y, h),
      project(x + w, y + d, h),
      project(x, y + d, h),
    ]),
    left: toPoints([
      project(x, y + d, h),
      project(x + w, y + d, h),
      project(x + w, y + d, 0),
      project(x, y + d, 0),
    ]),
    right: toPoints([
      project(x + w, y, h),
      project(x + w, y + d, h),
      project(x + w, y + d, 0),
      project(x + w, y, 0),
    ]),
    shadow: toPoints([
      project(x + 2, y + 2),
      project(x + w + 3, y + 2),
      project(x + w + 3, y + d + 3),
      project(x + 2, y + d + 3),
    ]),
  };
}

/** Roof ridge lines running along the building's length. */
export function roofStripes(b: Building, spacing = 3): [Point, Point][] {
  const lines: [Point, Point][] = [];
  for (let i = spacing; i < b.w - 1; i += spacing) {
    lines.push([project(b.x + i, b.y + 2, b.h), project(b.x + i, b.y + b.d - 2, b.h)]);
  }
  return lines;
}

/** Window rows on the south-west face. */
export function windows(b: Building): string[] {
  const out: string[] = [];
  const floors = Math.max(1, Math.floor(b.h / 4));
  for (let f = 0; f < floors; f++) {
    const z0 = 1.6 + f * 4;
    for (let i = 2; i + 3 < b.w; i += 5) {
      const y = b.y + b.d;
      out.push(
        toPoints([
          project(b.x + i, y, z0 + 2),
          project(b.x + i + 3, y, z0 + 2),
          project(b.x + i + 3, y, z0),
          project(b.x + i, y, z0),
        ]),
      );
    }
  }
  return out;
}

/** Point where routes meet a building: centre of the side facing the avenue, at ground level. */
export function doorPoint(b: Building): { wx: number; wy: number } {
  return { wx: b.x + b.w / 2, wy: b.door === 'front' ? b.y + b.d : b.y };
}

/**
 * Walking route between two buildings via the central avenue, as screen points.
 * Returns an empty list when both are the same building.
 */
export function routeBetween(from: Building, to: Building): Point[] {
  if (from.departmentId === to.departmentId) return [];
  const a = doorPoint(from);
  const b = doorPoint(to);
  return [
    project(a.wx, a.wy),
    project(a.wx, AVENUE_Y),
    project(b.wx, AVENUE_Y),
    project(b.wx, b.wy),
  ];
}

/** Pin anchor points spread across a building's roof, floating `lift` units above it. */
export function roofPins(b: Building, count: number, lift = 5): { base: Point; head: Point }[] {
  if (count === 0) return [];
  const cols = Math.min(count, Math.max(1, Math.round(Math.sqrt((count * b.w) / b.d))));
  const rows = Math.ceil(count / cols);
  return Array.from({ length: count }, (_, i) => {
    const wx = b.x + ((i % cols) + 0.5) * (b.w / cols);
    const wy = b.y + (Math.floor(i / cols) + 0.5) * (b.d / rows);
    return { base: project(wx, wy, b.h), head: project(wx, wy, b.h + lift) };
  });
}

/** Screen position for a building's name sign: on the ground just in front of its south-west façade. */
export function labelPoint(b: Building): Point {
  return project(b.x + b.w / 2, b.y + b.d + 2.5, 0);
}

/** Painter's order: draw buildings further back (smaller x + y) first. */
export const BUILDINGS_BY_DEPTH = [...BUILDINGS].sort(
  (a, b) => a.x + a.y + a.w + a.d - (b.x + b.y + b.w + b.d),
);

const corners = [
  project(0, 0, 0),
  project(WORLD.w, 0, 0),
  project(WORLD.w, WORLD.d, 0),
  project(0, WORLD.d, 0),
];
const PAD = 16;
const TOP_HEADROOM = 22 * SCALE;

/** SVG viewBox enclosing the whole campus, with headroom for tall buildings and labels. */
export const VIEWBOX = {
  x: Math.min(...corners.map((c) => c.x)) - PAD,
  y: Math.min(...corners.map((c) => c.y)) - TOP_HEADROOM,
  w: Math.max(...corners.map((c) => c.x)) - Math.min(...corners.map((c) => c.x)) + PAD * 2,
  h:
    Math.max(...corners.map((c) => c.y)) -
    Math.min(...corners.map((c) => c.y)) +
    TOP_HEADROOM +
    PAD,
};

/** Converts a screen point into CSS percentages of the viewBox (for HTML overlays). */
export function toPercent(p: Point): { left: string; top: string } {
  return {
    left: `${((p.x - VIEWBOX.x) / VIEWBOX.w) * 100}%`,
    top: `${((p.y - VIEWBOX.y) / VIEWBOX.h) * 100}%`,
  };
}

export const GROUND = toPoints(corners);

/** The avenue and a cross street, as ground polygons. */
export const ROADS = [
  toPoints([
    project(0, AVENUE_Y - AVENUE_HALF_WIDTH),
    project(WORLD.w, AVENUE_Y - AVENUE_HALF_WIDTH),
    project(WORLD.w, AVENUE_Y + AVENUE_HALF_WIDTH),
    project(0, AVENUE_Y + AVENUE_HALF_WIDTH),
  ]),
  toPoints([
    project(42, AVENUE_Y),
    project(46, AVENUE_Y),
    project(46, WORLD.d),
    project(42, WORLD.d),
  ]),
];

/** Dashed centre line of the avenue. */
export const AVENUE_CENTRE: [Point, Point] = [project(0, AVENUE_Y), project(WORLD.w, AVENUE_Y)];
