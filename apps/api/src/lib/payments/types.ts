export type PaymentProvider = 'paymentslk';

export type CheckoutCustomer = { name: string; email: string; phone?: string };

export type CheckoutInput = {
  amountCents: number;
  description: string;
  reference: string;
  successUrl: string;
  cancelUrl?: string;
  customer?: CheckoutCustomer;
};

export type CheckoutResult = {
  redirectUrl: string;
  merchantOrderId: string;
  paymentId: string | null;
  provider: PaymentProvider;
};

export type WebhookEvent = {
  provider: PaymentProvider;
  eventId: string;
  merchantOrderId: string;
  paymentId: string | null;
  statusCode: number;
  amountMinor: number;
  raw: unknown;
};

export type RefundInput = {
  paymentId: string;
  amountCents?: number;
  reason?: string;
};

export type RefundResult = {
  refundId: string;
  status: 'pending' | 'succeeded' | 'failed';
  provider: PaymentProvider;
};
