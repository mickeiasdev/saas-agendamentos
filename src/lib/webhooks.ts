/**
 * Webhooks (Fase 2.8).
 *
 * Estrutura de webhook_events com validação, idempotência e logs. A validação
 * de assinatura (HMAC) é feita no processador server-only
 * (src/lib/server/webhookProcessor.ts). Este módulo contém helpers puros de
 * chave de idempotência e ciclo de vida do evento.
 */

export type WebhookEventStatus = "received" | "processing" | "processed" | "failed";

export const WEBHOOK_STATUS_FLOW: Record<WebhookEventStatus, WebhookEventStatus[]> = {
  received: ["processing", "failed"],
  processing: ["processed", "failed"],
  processed: [],
  failed: ["processing"],
};

export function canTransitionWebhook(
  from: WebhookEventStatus,
  to: WebhookEventStatus
): boolean {
  return WEBHOOK_STATUS_FLOW[from]?.includes(to) ?? false;
}

/**
 * Gera uma chave de idempotência determinística a partir da origem, do nome do
 * evento e do payload. O mesmo payload reentregue produz a mesma chave, o que
 * permite rejeitar processamentos duplicados. A serialização canônica ordena
 * as chaves dos objetos, tornando a chave estável entre ordenações.
 */
export function makeIdempotencyKey(
  source: string,
  event: string,
  payload: Record<string, unknown> | null
): string {
  const canonical = canonicalStringify(payload ?? null);
  return `${source}:${event}:${hashString(canonical)}`;
}

/** Serializa JSON com chaves de objetos ordenadas (estável e determinística). */
export function canonicalStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const parts = keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify((value as Record<string, unknown>)[k])}`);
    return `{${parts.join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Hash FNV-1a de 32 bits (determinístico, sem dependências). */
export function hashString(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(8, "0");
}

export function webhookStatusLabel(status: WebhookEventStatus): string {
  const labels: Record<WebhookEventStatus, string> = {
    received: "Recebido",
    processing: "Processando",
    processed: "Processado",
    failed: "Falhou",
  };
  return labels[status] ?? status;
}

// ---------- FASE 3.14: WEBHOOKS PÚBLICOS (saída) ----------

export const PUBLIC_WEBHOOK_EVENTS = [
  "appointment.created",
  "appointment.confirmed",
  "appointment.cancelled",
  "payment.approved",
  "customer.created",
] as const;

export type PublicWebhookEvent = (typeof PUBLIC_WEBHOOK_EVENTS)[number];

export function isPublicWebhookEvent(event: string): event is PublicWebhookEvent {
  return (PUBLIC_WEBHOOK_EVENTS as readonly string[]).includes(event);
}

export function shouldDeliver(events: string[], event: string): boolean {
  return events.includes(event);
}

/**
 * Monta o payload do webhook público: evento, dados do tenant e timestamp.
 * O payload é canônico (JSON ordenado) para gerar assinatura determinística.
 */
export function buildWebhookPayload(
  event: string,
  tenantId: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  return {
    event,
    tenantId,
    timestamp: new Date().toISOString(),
    data,
  };
}

export interface WebhookHeaders {
  [key: string]: string;
}

/**
 * Cabeçalhos de entrega com assinatura HMAC-SHA256 do corpo bruto.
 * O receptor pode verificar a assinatura para garantir autenticidade.
 */
export function buildWebhookHeaders(
  signature: string,
  deliveryId: string,
  event: string
): WebhookHeaders {
  return {
    "Content-Type": "application/json",
    "X-Agenda-Signature": signature,
    "X-Agenda-Delivery": deliveryId,
    "X-Agenda-Event": event,
  };
}
