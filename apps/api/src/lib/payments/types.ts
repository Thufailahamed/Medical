export type PaymentProvider = 'payhere' | 'stripe';

export type CheckoutInput = {
  invoiceId: string;
  method: PaymentProvider;
  returnUrl: string;
  cancelUrl?: string;
};

export type CheckoutResult = {
  redirectUrl: string;
  merchantOrderId: string;
  provider: PaymentProvider;
};

export type WebhookEvent = {
  provider: PaymentProvider;
  eventId: string;
  merchantOrderId: string;
  statusCode: number;
  amountMinor: number;
  currency: string;
  raw: unknown;
};

export type RefundInput = {
  paymentId: string;
  amountMinor?: number;
  reason?: string;
};

export type RefundResult = {
  refundId: string;
  status: 'pending' | 'succeeded' | 'failed';
  provider: PaymentProvider;
};
