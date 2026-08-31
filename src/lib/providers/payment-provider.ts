/**
 * Abstração de gateway de pagamento.
 *
 * NENHUM gateway é ativado no MVP enquanto não existir um com free tier
 * oficial e adequado. A implementação concreta (ex.: Mercado Pago, Stripe)
 * será plugada futuramente sem reescrever o sistema.
 */

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  providerReference: string | null;
}

export type PaymentStatus = "pending" | "approved" | "refunded" | "failed";

export interface CreatePaymentInput {
  amount: number;
  currency?: string;
  description: string;
  metadata?: Record<string, unknown>;
  method?: "pix" | "card" | "cash" | "signal";
  returnUrl?: string;
}

export interface PaymentProvider {
  readonly id: string;
  isEnabled(): boolean;
  createPayment(input: CreatePaymentInput): Promise<PaymentIntent>;
  getPayment(id: string): Promise<PaymentIntent>;
  cancelPayment(id: string): Promise<PaymentIntent>;
  refundPayment(id: string): Promise<PaymentIntent>;
  handleWebhook(payload: unknown, headers: Record<string, string>): Promise<{ event: string; ok: boolean }>;
}
