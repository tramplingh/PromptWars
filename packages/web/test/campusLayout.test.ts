import { describe, expect, it } from 'vitest';
import {
  AVENUE_Y,
  BUILDINGS,
  BUILDINGS_BY_DEPTH,
  VIEWBOX,
  project,
  roofPins,
  routeBetween,
  toPercent,
} from '../src/lib/campusLayout';

const byId = (id: string) => BUILDINGS.find((b) => b.departmentId === id)!;

describe('isometric campus geometry', () => {
  it('projects the ground origin to (0,0) and lifts height straight up', () => {
    expect(project(0, 0, 0)).toEqual({ x: 0, y: 0 });
    const ground = project(10, 5, 0);
    const raised = project(10, 5, 4);
    expect(raised.x).toBe(ground.x);
    expect(raised.y).toBeLessThan(ground.y);
  });

  it('never lets building footprints overlap', () => {
    for (const a of BUILDINGS) {
      for (const b of BUILDINGS) {
        if (a === b) continue;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d;
        expect(overlap, `${a.name} overlaps ${b.name}`).toBe(false);
      }
    }
  });

  it('keeps every building clear of the central avenue', () => {
    for (const b of BUILDINGS) expect(b.y + b.d < AVENUE_Y - 3 || b.y > AVENUE_Y + 3).toBe(true);
  });

  it('draws buildings back-to-front', () => {
    const depth = BUILDINGS_BY_DEPTH.map((b) => b.x + b.y + b.w + b.d);
    expect(depth).toEqual([...depth].sort((a, b) => a - b));
  });

  it('routes between buildings via the avenue, and not within one building', () => {
    const route = routeBetween(byId('ece'), byId('mech'));
    expect(route).toHaveLength(4);
    expect(route[1]!.y - route[1]!.x * Math.tan(Math.PI / 6)).toBeCloseTo(
      route[2]!.y - route[2]!.x * Math.tan(Math.PI / 6),
      0,
    );
    expect(routeBetween(byId('ece'), byId('ece'))).toEqual([]);
  });

  it('places pins above the roof and inside the viewBox', () => {
    for (const b of BUILDINGS) {
      for (const pin of roofPins(b, 5)) {
        expect(pin.head.y).toBeLessThan(pin.base.y);
        const { left, top } = toPercent(pin.head);
        expect(parseFloat(left)).toBeGreaterThan(0);
        expect(parseFloat(left)).toBeLessThan(100);
        expect(parseFloat(top)).toBeGreaterThan(0);
        expect(parseFloat(top)).toBeLessThan(100);
      }
    }
    expect(VIEWBOX.w).toBeGreaterThan(0);
    expect(roofPins(byId('cse'), 0)).toEqual([]);
  });
});
