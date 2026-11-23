import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { TtlCache } from '../src/lib/cache.js';
import { MemoryBookingRepository } from '../src/repositories/memoryBookingRepository.js';
import { buildSeedBookings } from '../src/data/seedBookings.js';
import { NOW, TODAY } from './helpers.js';

describe('TtlCache', () => {
  it('expires entries and evicts least-recently-used ones', () => {
    let now = 0;
    const cache = new TtlCache<number>(2, 100, () => now);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    now = 200;
    expect(cache.get('a')).toBeUndefined();
  });
});

describe('loadConfig', () => {
  it('requires a strong session secret in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/SESSION_SECRET/);
    expect(() => loadConfig({ NODE_ENV: 'production', SESSION_SECRET: 'short' })).toThrow(
      /SESSION_SECRET/,
    );
    expect(loadConfig({ NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(32) }).env).toBe(
      'production',
    );
  });

  it('treats Gemini as optional', () => {
    expect(loadConfig({}).gemini.apiKey).toBeUndefined();
    expect(loadConfig({ GEMINI_API_KEY: 'k' }).gemini).toMatchObject({
      apiKey: 'k',
      model: 'gemini-3.1-flash-lite',
    });
  });
});

describe('MemoryBookingRepository', () => {
  it('serialises transactions so concurrent writers cannot both win a slot', async () => {
    const repo = new MemoryBookingRepository();
    const attempt = (id: string) =>
      repo.transact(['eq'], (current) => {
        if (current.length > 0) return { writes: [], result: false };
        const booking = { ...buildSeedBookings(TODAY, NOW)[0]!, id, equipmentId: 'eq' };
        return { writes: [booking], result: true };
      });
    const results = await Promise.all([attempt('x'), attempt('y'), attempt('z')]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await repo.list()).toHaveLength(1);
  });

  it('keeps working after a transaction throws', async () => {
    const repo = new MemoryBookingRepository();
    await expect(
      repo.transact(['eq'], () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    await expect(repo.transact(['eq'], () => ({ writes: [], result: 'ok' }))).resolves.toBe('ok');
  });
});

describe('seed data', () => {
  it('produces internally consistent bookings', () => {
    for (const b of buildSeedBookings(TODAY, NOW)) {
      expect(b.slot.endHour).toBeGreaterThan(b.slot.startHour);
      expect(b.project.deadline >= b.slot.date).toBe(true);
    }
  });
});
