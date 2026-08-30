import type { PaymentProvider } from './types';

export enum PaymentErrorCode {
  WebhookSignatureInvalid = 'webhook_signature_invalid',
  WebhookReplay = 'webhook_replay',
  ProviderError = 'provider_error',
  UnsupportedProvider = 'unsupported_provider',
  NotFound = 'not_found',
}

export class PaymentError extends Error {
  constructor(
    public code: PaymentErrorCode,
    public provider: PaymentProvider | 'unknown',
    public providerRef?: string,
    message?: string
  ) {
    super(message ?? `${code} (${provider}${providerRef ? `:${providerRef}` : ''})`);
    this.name = 'PaymentError';
  }
}
