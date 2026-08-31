import {
  addDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { tenantCollections } from "./collections";
import type { WebhookEvent } from "@/types";

const collectionFor = (tenantId: string) =>
  tenantCollections(getFirebaseFirestore(), tenantId).webhookEvents();

export interface RecordWebhookInput {
  source: string;
  event: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
}

export async function recordWebhookEvent(
  tenantId: string,
  input: RecordWebhookInput
): Promise<string> {
  const ref = await addDoc(collectionFor(tenantId), {
    tenantId,
    source: input.source,
    event: input.event,
    payload: input.payload,
    idempotencyKey: input.idempotencyKey,
    status: "received",
    attempts: 0,
    lastError: null,
    processedAt: null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function findWebhookEventByIdempotencyKey(
  tenantId: string,
  idempotencyKey: string
): Promise<WebhookEvent | null> {
  const snap = await getDocs(
    query(collectionFor(tenantId), where("idempotencyKey", "==", idempotencyKey), limit(1))
  );
  return snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as WebhookEvent);
}

export async function listWebhookEvents(
  tenantId: string,
  opts: { max?: number } = {}
): Promise<WebhookEvent[]> {
  const snap = await getDocs(
    query(collectionFor(tenantId), orderBy("createdAt", "desc"), limit(opts.max ?? 50))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WebhookEvent);
}

export async function updateWebhookStatus(
  tenantId: string,
  eventId: string,
  status: WebhookEvent["status"],
  opts: { attempts?: number; error?: string } = {}
): Promise<void> {
  const payload: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
  if (opts.attempts !== undefined) payload.attempts = opts.attempts;
  if (opts.error !== undefined) payload.lastError = opts.error;
  if (status === "processed") payload.processedAt = serverTimestamp();
  await updateDoc(doc(collectionFor(tenantId), eventId), payload);
}
