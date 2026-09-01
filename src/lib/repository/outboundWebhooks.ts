import {
  addDoc,
  doc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { tenantCollections } from "./collections";
import type { OutboundWebhook, OutboundWebhookDelivery } from "@/types";

const webhooksFor = (tenantId: string) => tenantCollections(getFirebaseFirestore(), tenantId).outboundWebhooks();
const deliveriesFor = (tenantId: string) => tenantCollections(getFirebaseFirestore(), tenantId).webhookDeliveries();

export interface CreateOutboundWebhookInput {
  url: string;
  secret: string;
  events: string[];
  active?: boolean;
}

export async function listOutboundWebhooks(tenantId: string): Promise<OutboundWebhook[]> {
  const snap = await getDocs(query(webhooksFor(tenantId), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as OutboundWebhook);
}

export async function createOutboundWebhook(
  tenantId: string,
  input: CreateOutboundWebhookInput
): Promise<string> {
  const ref = await addDoc(webhooksFor(tenantId), {
    tenantId,
    url: input.url.trim(),
    secret: input.secret,
    events: input.events,
    active: input.active ?? true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateOutboundWebhook(
  tenantId: string,
  id: string,
  input: Partial<CreateOutboundWebhookInput>
): Promise<void> {
  await updateDoc(doc(webhooksFor(tenantId), id), { ...input, updatedAt: serverTimestamp() });
}

export async function toggleOutboundWebhook(tenantId: string, id: string, active: boolean): Promise<void> {
  await updateDoc(doc(webhooksFor(tenantId), id), { active, updatedAt: serverTimestamp() });
}

/** Lista webhooks ativos que devem receber determinado evento. */
export async function listWebhooksForEvent(tenantId: string, event: string): Promise<OutboundWebhook[]> {
  const all = await listOutboundWebhooks(tenantId);
  return all.filter((w) => w.active && w.events.includes(event));
}

export async function recordDelivery(
  tenantId: string,
  input: {
    webhookId: string;
    event: string;
    payload: Record<string, unknown>;
  }
): Promise<string> {
  const ref = await addDoc(deliveriesFor(tenantId), {
    tenantId,
    webhookId: input.webhookId,
    event: input.event,
    payload: input.payload,
    status: "pending",
    attempts: 0,
    lastError: null,
    deliveredAt: null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateDeliveryStatus(
  tenantId: string,
  deliveryId: string,
  status: OutboundWebhookDelivery["status"],
  opts: { attempts?: number; error?: string } = {}
): Promise<void> {
  const payload: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
  if (opts.attempts !== undefined) payload.attempts = opts.attempts;
  if (opts.error !== undefined) payload.lastError = opts.error;
  if (status === "delivered") payload.deliveredAt = serverTimestamp();
  await updateDoc(doc(deliveriesFor(tenantId), deliveryId), payload);
}

export async function listDeliveries(
  tenantId: string,
  opts: { webhookId?: string; max?: number } = {}
): Promise<OutboundWebhookDelivery[]> {
  const constraints = [];
  if (opts.webhookId) constraints.push(where("webhookId", "==", opts.webhookId));
  const snap = await getDocs(
    query(deliveriesFor(tenantId), ...constraints, orderBy("createdAt", "desc"), limit(opts.max ?? 50))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as OutboundWebhookDelivery);
}
