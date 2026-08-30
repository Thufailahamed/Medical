import { describe, it, expect, vi } from 'vitest';
import { pollReceipts } from '../src/lib/notifications';

const stubDb = (rows: any[]) => ({
  prepare: vi.fn((sql: string) => ({
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results: rows }),
    run: vi.fn().mockResolvedValue({}),
    first: vi.fn().mockResolvedValue(null),
  })),
});

describe('pollReceipts', () => {
  it('returns processed: 0 on empty rows', async () => {
    const db = stubDb([]);
    const r = await pollReceipts(db as any, {} as any);
    expect(r.processed).toBe(0);
  });

  it('DeviceNotRegistered → DELETE push_tokens + mark failed', async () => {
    const db = stubDb([{ id: 'n1', expo_ticket: 't1', user_id: 'u1' }]);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ data: { t1: { status: 'error', details: { error: 'DeviceNotRegistered' } } } }),
        { status: 200 }
      )
    );
    const r = await pollReceipts(db as any, {} as any, fetchMock as any);
    expect(r.processed).toBe(1);
    const calls = (db.prepare as any).mock.calls.map((c: any) => c[0]).join(' ');
    expect(calls).toMatch(/DELETE FROM push_tokens/);
    expect(calls).toMatch(/status = 'failed'/);
  });

  it('ok ticket → mark delivered', async () => {
    const db = stubDb([{ id: 'n2', expo_ticket: 't2', user_id: 'u2' }]);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { t2: { status: 'ok' } } }), { status: 200 })
    );
    await pollReceipts(db as any, {} as any, fetchMock as any);
    const calls = (db.prepare as any).mock.calls.map((c: any) => c[0]).join(' ');
    expect(calls).toMatch(/status = 'delivered'/);
    expect(calls).toMatch(/delivered_at/);
  });
});
