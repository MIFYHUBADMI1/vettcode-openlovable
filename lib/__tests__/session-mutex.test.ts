import { describe, expect, it, beforeEach } from 'vitest';
import { sessionMutex } from '../session-mutex';

describe('SessionMutex', () => {
  beforeEach(() => {
    sessionMutex.clear();
  });

  it('runs a single operation normally', async () => {
    const result = await sessionMutex.run('a', async () => 42);
    expect(result).toBe(42);
  });

  it('second caller for the same key receives the first result', async () => {
    let callCount = 0;

    const p1 = sessionMutex.run('key', async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 50));
      return 'first';
    });

    // Second call while first is in-flight
    const p2 = sessionMutex.run('key', async () => {
      callCount++;
      return 'second';
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe('first');
    expect(r2).toBe('first');
    // Only the leader's fn should have been called
    expect(callCount).toBe(1);
  });

  it('different keys run independently', async () => {
    const results = await Promise.all([
      sessionMutex.run('a', async () => 'A'),
      sessionMutex.run('b', async () => 'B'),
    ]);
    expect(results).toEqual(['A', 'B']);
  });

  it('isLocked returns true while operation is in-flight', async () => {
    const p = sessionMutex.run('x', async () => {
      expect(sessionMutex.isLocked('x')).toBe(true);
      return 'done';
    });

    // Before it resolves, isLocked should be true
    // (the leader sets it synchronously before the async work)
    await p;
    expect(sessionMutex.isLocked('x')).toBe(false);
  });

  it('propagates errors from the leader to all waiters', async () => {
    const p1 = sessionMutex.run('err', async () => {
      throw new Error('boom');
    });

    const p2 = sessionMutex.run('err', async () => {
      return 'should not run';
    });

    await expect(p1).rejects.toThrow('boom');
    await expect(p2).rejects.toThrow('boom');
  });

  it('key is released after error so next call runs', async () => {
    try {
      await sessionMutex.run('retry', async () => {
        throw new Error('fail');
      });
    } catch {
      // expected
    }

    // Should be able to run again with the same key
    const result = await sessionMutex.run('retry', async () => 'ok');
    expect(result).toBe('ok');
  });

  it('handles many concurrent waiters', async () => {
    let callCount = 0;
    const leader = sessionMutex.run('many', async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 30));
      return 'leader-result';
    });

    const waiters = Array.from({ length: 10 }, () =>
      sessionMutex.run('many', async () => {
        callCount++;
        return 'waiter-result';
      }),
    );

    const results = await Promise.all([leader, ...waiters]);
    expect(callCount).toBe(1);
    for (const r of results) {
      expect(r).toBe('leader-result');
    }
  });
});
