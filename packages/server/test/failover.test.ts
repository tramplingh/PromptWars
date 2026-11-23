import { describe, expect, it, vi } from 'vitest';
import { isRetryable, withFailover } from '../src/ai/failover.js';

const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

describe('Gemini model failover', () => {
  it('uses the primary model when it answers', async () => {
    const attempt = vi.fn(async (model: string) => `ok from ${model}`);
    await expect(withFailover(['a', 'b'], 5000, attempt)).resolves.toEqual({
      value: 'ok from a',
      model: 'a',
    });
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('moves to the next model on overload or quota errors', async () => {
    const attempt = vi.fn(async (model: string) => {
      if (model === 'a') throw httpError(503);
      return 'ok';
    });
    await expect(withFailover(['a', 'b'], 5000, attempt)).resolves.toEqual({
      value: 'ok',
      model: 'b',
    });
  });

  it('does not retry invalid output on another model', async () => {
    const attempt = vi.fn(async () => {
      throw new SyntaxError('Unexpected token');
    });
    await expect(withFailover(['a', 'b'], 5000, attempt)).rejects.toThrow('Unexpected token');
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('shares one time budget across attempts', async () => {
    let clock = 0;
    const attempt = vi.fn(async (_model: string, timeoutMs: number) => {
      clock += timeoutMs - 500; // each attempt fails after using most of its time
      throw httpError(429);
    });
    await expect(withFailover(['a', 'b', 'c'], 3000, attempt, () => clock)).rejects.toThrow('429');
    expect(attempt.mock.calls.map(([, ms]) => ms)).toEqual([3000]);
  });

  it('classifies retryable errors', () => {
    expect(isRetryable(httpError(429))).toBe(true);
    expect(isRetryable(httpError(404))).toBe(true);
    expect(isRetryable(httpError(400))).toBe(false);
    expect(isRetryable(Object.assign(new Error('aborted'), { name: 'AbortError' }))).toBe(true);
    expect(isRetryable(new Error('The model is overloaded'))).toBe(true);
    expect(isRetryable('nope')).toBe(false);
  });
});
