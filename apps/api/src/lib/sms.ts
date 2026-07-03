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
export function createSmsProvider(env: {
  SMS_PROVIDER?: string;
  SMSLENZ_USER_ID?: string;
  SMSLENZ_API_KEY?: string;
  SMS_SENDER_ID?: string;
}): SmsProvider {
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
  
  return new ConsoleSmsProvider();
}

/** Format OTP message for SMS. Max 160 chars for single segment. */
export function formatOtpMessage(code: string): string {
  return `Your HealthHub verification code is ${code}. Valid for 5 minutes. Do not share this code.`;
}
