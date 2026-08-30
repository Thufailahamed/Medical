import { describe, it, expect, vi } from 'vitest';
import { tryRecordWebhook } from '../src/lib/payments/webhook-idempotency';

const mockDb = () => ({
  prepare: vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ success: true }),
    first: vi.fn().mockResolvedValue(null),
  }),
});

describe('tryRecordWebhook', () => {
  it('returns isNew=true on first insert', async () => {
    const db = mockDb();
    const result = await tryRecordWebhook(db as any, 'payhere', 'evt_1', { foo: 1 });
    expect(result.isNew).toBe(true);
  });

  it('returns isNew=false on duplicate (UNIQUE violation)', async () => {
    const db = mockDb();
    db.prepare().bind().run.mockRejectedValueOnce(
      new Error('UNIQUE constraint failed: payment_webhook_events.provider, payment_webhook_events.event_id')
    );
    const result = await tryRecordWebhook(db as any, 'payhere', 'evt_1', {});
    expect(result.isNew).toBe(false);
  });
});
