import { describe, it, expect } from 'vitest';
import { deadlinePassed } from '../../src/lib/dates.ts';

const SNAPSHOT = '2026-07-19T03:20:42.435784+00:00';

describe('deadlinePassed', () => {
  it('is true when the deadline is before the snapshot', () => {
    expect(deadlinePassed('2019-05-01', SNAPSHOT)).toBe(true);
    expect(deadlinePassed('2026-07-18', SNAPSHOT)).toBe(true);
  });

  it('is false when the deadline is after the snapshot', () => {
    expect(deadlinePassed('2026-08-24', SNAPSHOT)).toBe(false);
    expect(deadlinePassed('2030-01-01', SNAPSHOT)).toBe(false);
  });

  it('never invents an expiry for a missing deadline', () => {
    expect(deadlinePassed(null, SNAPSHOT)).toBe(false);
    expect(deadlinePassed('', SNAPSHOT)).toBe(false);
  });

  it('never flags an unparseable deadline as passed', () => {
    expect(deadlinePassed('N/A', SNAPSHOT)).toBe(false);
    expect(deadlinePassed('see documents', SNAPSHOT)).toBe(false);
  });

  it('returns false when the reference instant is itself unparseable', () => {
    expect(deadlinePassed('2019-05-01', 'not-a-date')).toBe(false);
  });
});
