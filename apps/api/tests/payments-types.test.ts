import { describe, it, expect } from 'vitest';
import { PaymentError, PaymentErrorCode } from '../src/lib/payments/errors';
import type { PaymentProvider, CheckoutInput } from '../src/lib/payments/types';

describe('payments types/errors', () => {
  it('PaymentError carries code + providerRef', () => {
    const err = new PaymentError(PaymentErrorCode.WebhookSignatureInvalid, 'payhere', 'evt_123');
    expect(err.code).toBe('webhook_signature_invalid');
    expect(err.provider).toBe('payhere');
    expect(err.providerRef).toBe('evt_123');
  });

  it('CheckoutInput accepts invoiceId + method', () => {
    const input: CheckoutInput = { invoiceId: 'inv_1', method: 'payhere', returnUrl: 'https://x' };
    expect(input.invoiceId).toBe('inv_1');
  });

  it('PaymentProvider type unions', () => {
    const providers: PaymentProvider[] = ['payhere', 'stripe'];
    expect(providers).toHaveLength(2);
  });
});
