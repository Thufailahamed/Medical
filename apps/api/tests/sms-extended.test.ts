import { describe, it, expect, vi } from 'vitest';
import { createSmsProvider, TwilioProvider, DialogLkProvider } from '../src/lib/sms';

describe('SMS providers (extended)', () => {
  it('creates Twilio provider', () => {
    const p = createSmsProvider(
      { SMS_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: 'ACx', TWILIO_AUTH_TOKEN: 'tok', TWILIO_FROM: '+1' } as any
    );
    expect(p).toBeInstanceOf(TwilioProvider);
  });

  it('creates Dialog-lk provider', () => {
    const p = createSmsProvider(
      { SMS_PROVIDER: 'dialog-lk', DIALOG_LK_API_KEY: 'k', DIALOG_LK_FROM: 'HHLK' } as any
    );
    expect(p).toBeInstanceOf(DialogLkProvider);
  });

  it('Twilio provider sends via fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ sid: 'SMx', status: 'queued' }), { status: 200 })
    );
    const p = createSmsProvider(
      { SMS_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: 'ACx', TWILIO_AUTH_TOKEN: 'tok', TWILIO_FROM: '+1' } as any,
      fetchMock as any
    );
    const result = await p.sendSms('+94770000000', 'test');
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('SMx');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('Messages.json'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('Twilio returns failure on 21610 (unsubscribed)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"code":21610}', { status: 400 }));
    const p = createSmsProvider(
      { SMS_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: 'ACx', TWILIO_AUTH_TOKEN: 'tok', TWILIO_FROM: '+1' } as any,
      fetchMock as any
    );
    const result = await p.sendSms('+94770000000', 'test');
    expect(result.success).toBe(false);
    expect(result.error).toContain('21610');
  });

  it('Dialog-lk provider sends JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ reference: 'DLG123' }), { status: 200 })
    );
    const p = createSmsProvider(
      { SMS_PROVIDER: 'dialog-lk', DIALOG_LK_API_KEY: 'k', DIALOG_LK_FROM: 'HHLK' } as any,
      fetchMock as any
    );
    const result = await p.sendSms('+94770000000', 'test');
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('DLG123');
  });
});
