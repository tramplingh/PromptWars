/**
 * The app's notion of "now". `VITE_CLOCK_OFFSET_HOURS` shifts it (e.g. -9 to
 * demo opening hours in the evening); it must match the server's
 * `CLOCK_OFFSET_HOURS` so both sides agree on what time it is. Default: 0.
 */
const OFFSET_MS = (Number(import.meta.env.VITE_CLOCK_OFFSET_HOURS) || 0) * 3_600_000;

export const nowMs = (): number => Date.now() + OFFSET_MS;
export const now = (): Date => new Date(nowMs());
