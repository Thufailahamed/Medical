import { describe, it, expect } from 'vitest';
import { computeReplyTimeMedian } from '../src/routes/doctors-reply-time';

describe('computeReplyTimeMedian', () => {
  it('returns null on empty', () => {
    const r = computeReplyTimeMedian([]);
    expect(r.medianMinutes).toBeNull();
    expect(r.sampleSize).toBe(0);
  });

  it('pairs patient → next doctor msg', () => {
    const now = Date.now();
    const msgs = [
      { senderRole: 'patient' as const, createdAt: new Date(now - 60 * 60_000).toISOString() },
      { senderRole: 'doctor' as const, createdAt: new Date(now - 30 * 60_000).toISOString() }, // 30min
      { senderRole: 'patient' as const, createdAt: new Date(now - 120 * 60_000).toISOString() },
      { senderRole: 'doctor' as const, createdAt: new Date(now - 60 * 60_000).toISOString() }, // 60min
    ];
    const r = computeReplyTimeMedian(msgs);
    expect(r.sampleSize).toBe(2);
    expect(r.medianMinutes).toBe(45);
  });

  it('ignores unmatched patient msgs', () => {
    const now = Date.now();
    const msgs = [
      { senderRole: 'patient' as const, createdAt: new Date(now - 60_000).toISOString() },
      // no doctor reply — pair never completes
    ];
    const r = computeReplyTimeMedian(msgs);
    expect(r.medianMinutes).toBeNull();
    expect(r.sampleSize).toBe(0);
  });
});
