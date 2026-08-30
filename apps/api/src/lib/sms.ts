/**
 * SMS provider abstraction + SMSLenz implementation.
 *
 * SMSLenz API:
 *   URL:  https://www.smslenz.lk/api/send-sms
 *   Method: POST or GET
 *   Params: user_id, api_key, sender_id, contact, message
 */

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SmsProvider {
  sendSms(to: string, message: string): Promise<SmsResult>;
}

/** Console-only provider for development. */
export class ConsoleSmsProvider implements SmsProvider {
  async sendSms(to: string, message: string): Promise<SmsResult> {
    console.log(`[sms:console] to=${to} message=${message}`);
    return { success: true, messageId: 'console-' + Date.now() };
  }
}

/** SMSLenz provider — Sri Lanka bulk SMS gateway. */
export class SmslenzProvider implements SmsProvider {
  constructor(
    private userId: string,
    private apiKey: string,
    private senderId: string = 'SMSlenzDEMO',
  ) {}

  async sendSms(to: string, message: string): Promise<SmsResult> {
    const url = new URL('https://www.smslenz.lk/api/send-sms');
    url.searchParams.set('user_id', this.userId);
    url.searchParams.set('api_key', this.apiKey);
    url.searchParams.set('sender_id', this.senderId);
    url.searchParams.set('contact', to);
    url.searchParams.set('message', message);

    try {
      const res = await fetch(url.toString(), { method: 'GET' });
      const text = await res.text();
      
      if (!res.ok) {
        console.error(`[sms:smslenz] HTTP ${res.status}: ${text}`);
        return { success: false, error: `HTTP ${res.status}: ${text}` };
      }

      console.log(`[sms:smslenz] sent to=${to} response=${text}`);
      return { success: true, messageId: text };
    } catch (err: any) {
      console.error(`[sms:smslenz] error:`, err);
      return { success: false, error: err?.message ?? 'SMS send failed' };
    }
  }
}

/** Factory — picks the right provider based on env config. */
export function createSmsProvider(
  env: {
    SMS_PROVIDER?: string;
    SMSLENZ_USER_ID?: string;
    SMSLENZ_API_KEY?: string;
    SMS_SENDER_ID?: string;
    TWILIO_ACCOUNT_SID?: string;
    TWILIO_AUTH_TOKEN?: string;
    TWILIO_FROM?: string;
    DIALOG_LK_API_KEY?: string;
    DIALOG_LK_FROM?: string;
  },
  fetchImpl: typeof fetch = fetch,
): SmsProvider {
  const provider = env.SMS_PROVIDER || 'console';

  if (provider === 'smslenz') {
    if (!env.SMSLENZ_USER_ID || !env.SMSLENZ_API_KEY) {
      console.warn('[sms] SMSLenz credentials missing, falling back to console');
      return new ConsoleSmsProvider();
    }
    return new SmslenzProvider(
      env.SMSLENZ_USER_ID,
      env.SMSLENZ_API_KEY,
      env.SMS_SENDER_ID || 'SMSlenzDEMO',
    );
  }

  if (provider === 'twilio') {
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
      console.warn('[sms] Twilio credentials missing, falling back to console');
      return new ConsoleSmsProvider();
    }
    return new TwilioProvider(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, env.TWILIO_FROM ?? '', fetchImpl);
  }

  if (provider === 'dialog-lk') {
    if (!env.DIALOG_LK_API_KEY) {
      console.warn('[sms] Dialog-lk credentials missing, falling back to console');
      return new ConsoleSmsProvider();
    }
    return new DialogLkProvider(env.DIALOG_LK_API_KEY, env.DIALOG_LK_FROM ?? 'HHLK', fetchImpl);
  }

  return new ConsoleSmsProvider();
}

/** Twilio provider — international SMS, BAA available. */
export class TwilioProvider implements SmsProvider {
  constructor(
    private accountSid: string,
    private authToken: string,
    private from: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  async sendSms(to: string, message: string): Promise<SmsResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const params = new URLSearchParams({ To: to, From: this.from, Body: message });
    try {
      const res = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${this.accountSid}:${this.authToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
      if (!res.ok) {
        const text = await res.text();
        const codeMatch = text.match(/"code":(\d+)/);
        return { success: false, error: codeMatch ? `twilio_${codeMatch[1]}` : `twilio_${res.status}` };
      }
      const json = (await res.json()) as { sid: string };
      return { success: true, messageId: json.sid };
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'twilio send failed' };
    }
  }
}

/** Dialog.lk provider — SL local rich communication SMS gateway. */
export class DialogLkProvider implements SmsProvider {
  constructor(
    private apiKey: string,
    private from: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  async sendSms(to: string, message: string): Promise<SmsResult> {
    try {
      const res = await this.fetchImpl('https://richcommunication.dialog.lk/api/v1/sms', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ msisdn: to, message, sender: this.from }),
      });
      if (!res.ok) return { success: false, error: `dialog_${res.status}` };
      const json = (await res.json()) as { reference: string };
      return { success: true, messageId: json.reference };
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'dialog send failed' };
    }
  }
}

/** Send SMS with per-user opt-out check; auto-blacklist on Twilio 21610. */
export async function sendSmsWithOptOut(
  env: any,
  userId: string | null,
  to: string,
  message: string,
  db: any,
  fetchImpl: typeof fetch = fetch,
): Promise<SmsResult> {
  if (userId) {
    const optOut = await db
      .prepare('SELECT 1 FROM notification_opt_outs WHERE user_id = ? AND channel = ?')
      .bind(userId, 'sms')
      .first();
    if (optOut) return { success: false, error: 'opted_out' };
  }
  const provider = createSmsProvider(env, fetchImpl);
  const result = await provider.sendSms(to, message);
  if (!result.success && result.error?.includes('21610') && userId) {
    await db
      .prepare('INSERT OR REPLACE INTO notification_opt_outs (user_id, channel, reason) VALUES (?, ?, ?)')
      .bind(userId, 'sms', 'twilio_21610')
      .run();
  }
  return result;
}

/** Format OTP message for SMS. Max 160 chars for single segment. */
export function formatOtpMessage(code: string): string {
  return `Your HealthHub verification code is ${code}. Valid for 5 minutes. Do not share this code.`;
}
