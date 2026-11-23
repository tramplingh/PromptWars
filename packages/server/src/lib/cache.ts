import { createHash } from 'node:crypto';

interface Entry<V> {
  value: V;
  expiresAt: number;
}

/**
 * Small TTL + LRU cache. Used to avoid paying for identical Gemini calls
 * (e.g. the same search query) within a short window.
 */
export class TtlCache<V> {
  private readonly entries = new Map<string, Entry<V>>();

  constructor(
    private readonly maxEntries = 200,
    private readonly ttlMs = 10 * 60_000,
    private readonly nowMs: () => number = Date.now,
  ) {}

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.nowMs()) {
      this.entries.delete(key);
      return undefined;
    }
    // Refresh recency.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.nowMs() + this.ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  get size(): number {
    return this.entries.size;
  }

  static key(...parts: unknown[]): string {
    return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
  }
}
