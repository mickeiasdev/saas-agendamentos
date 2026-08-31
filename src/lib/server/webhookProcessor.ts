import { createHmac, timingSafeEqual } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { makeIdempotencyKey, type WebhookEventStatus } from "@/lib/webhooks";

/**
 * Processador de webhooks (Fase 2.8) — server-only.
 *
 * Implementa:
 *  - validação de assinatura HMAC (quando um secret está configurado);
 *  - idempotência por chave determinística (mesmo payload não é reprocessado);
 *  - logs em webhook_events com status, tentativas e último erro.
 *
 * Nenhum gateway é cobrado nem ativado no MVP; este processador deixa o fluxo
 * pronto para quando um provedor com free tier adequado for integrado.
 */

export interface WebhookVerificationResult {
  valid: boolean;
  error?: string;
}

export function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  signature: string | null | undefined
): WebhookVerificationResult {
  if (!secret) return { valid: false, error: "Webhook secret não configurado." };
  if (!signature) return { valid: false, error: "Assinatura ausente." };

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return { valid: false, error: "Assinatura inválida." };

  return timingSafeEqual(a, b) ? { valid: true } : { valid: false, error: "Assinatura inválida." };
}

export interface ProcessWebhookInput {
  tenantId: string;
  source: string;
  event: string;
  payload: Record<string, unknown>;
  signature?: string | null;
  secret?: string;
  rawBody?: string;
}

export interface WebhookProcessorResult {
  handled: boolean;
  duplicate: boolean;
  eventId: string;
  status: WebhookEventStatus;
  error?: string;
}

async function findEventByKey(
  db: Firestore,
  tenantId: string,
  idempotencyKey: string
): Promise<{ id: string; data: { status?: string; attempts?: number } } | null> {
  const snap = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("webhook_events")
    .where("idempotencyKey", "==", idempotencyKey)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, data: snap.docs[0].data() };
}

export async function processWebhook(
  db: Firestore,
  input: ProcessWebhookInput,
  handler: (event: { source: string; event: string; payload: Record<string, unknown> }) => Promise<void>
): Promise<WebhookProcessorResult> {
  const { tenantId, source, event, payload } = input;

  if (input.secret) {
    const verification = verifyWebhookSignature(input.secret, input.rawBody ?? "", input.signature);
    if (!verification.valid) {
      return { handled: false, duplicate: false, eventId: "", status: "failed", error: verification.error };
    }
  }

  const idempotencyKey = makeIdempotencyKey(source, event, payload);
  const col = db.collection("tenants").doc(tenantId).collection("webhook_events");

  const existing = await findEventByKey(db, tenantId, idempotencyKey);
  let eventId: string;
  let attempts = 0;

  if (existing) {
    if (existing.data.status === "processed") {
      return { handled: true, duplicate: true, eventId: existing.id, status: "processed" };
    }
    eventId = existing.id;
    attempts = (existing.data.attempts ?? 0) + 1;
    await col.doc(eventId).update({ status: "processing", attempts });
  } else {
    const ref = await col.add({
      tenantId,
      source,
      event,
      payload,
      idempotencyKey,
      status: "processing",
      attempts: 1,
      lastError: null,
      processedAt: null,
      createdAt: new Date(),
    });
    eventId = ref.id;
    attempts = 1;
  }

  try {
    await handler({ source, event, payload });
    await col.doc(eventId).update({ status: "processed", processedAt: new Date() });
    return { handled: true, duplicate: false, eventId, status: "processed" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao processar webhook.";
    await col.doc(eventId).update({ status: "failed", lastError: message });
    return { handled: true, duplicate: false, eventId, status: "failed", error: message };
  }
}
