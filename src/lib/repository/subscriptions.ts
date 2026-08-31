import {
  addDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { tenantCollections, globalCollections } from "./collections";
import { canTransition } from "@/lib/subscriptions";
import type { PlanId, Subscription, SubscriptionStatus } from "@/types";

const collectionFor = (tenantId: string) =>
  tenantCollections(getFirebaseFirestore(), tenantId).subscriptions();

export interface CreateSubscriptionInput {
  planId: PlanId;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt?: Date | null;
}

export async function listSubscriptions(tenantId: string): Promise<Subscription[]> {
  const snap = await getDocs(
    query(collectionFor(tenantId), orderBy("currentPeriodStart", "desc"), limit(20))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Subscription);
}

export async function getCurrentSubscription(tenantId: string): Promise<Subscription | null> {
  const snap = await getDocs(
    query(collectionFor(tenantId), orderBy("currentPeriodStart", "desc"), limit(1))
  );
  return snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as Subscription);
}

export async function createSubscription(
  tenantId: string,
  input: CreateSubscriptionInput
): Promise<string> {
  const ref = await addDoc(collectionFor(tenantId), {
    tenantId,
    planId: input.planId,
    status: input.status,
    startedAt: serverTimestamp(),
    trialEndsAt: input.trialEndsAt ?? null,
    currentPeriodStart: input.currentPeriodStart,
    currentPeriodEnd: input.currentPeriodEnd,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Transição de status validada (TRIAL/ACTIVE/PAST_DUE/SUSPENDED/CANCELLED).
 * Atualiza o documento do tenant e o registro atual de assinatura, mantendo a
 * arquitetura pronta para quando houver cobrança real via gateway.
 */
export async function transitionSubscription(
  tenantId: string,
  to: SubscriptionStatus
): Promise<{ ok: boolean; error?: string }> {
  const db = getFirebaseFirestore();
  const tenantRef = doc(globalCollections.tenants(db), tenantId);
  const tenantSnap = await getDoc(tenantRef);
  if (!tenantSnap.exists()) return { ok: false, error: "Empresa não encontrada." };

  const from = tenantSnap.data().subscriptionStatus as SubscriptionStatus;
  if (!canTransition(from, to)) {
    return { ok: false, error: `Transição de ${from} para ${to} não permitida.` };
  }

  await updateDoc(tenantRef, { subscriptionStatus: to, updatedAt: serverTimestamp() });

  const current = await getCurrentSubscription(tenantId);
  if (current) {
    const payload: Record<string, unknown> = { status: to, updatedAt: serverTimestamp() };
    if (to === "CANCELLED") {
      payload.canceledAt = serverTimestamp();
      payload.cancelAtPeriodEnd = true;
    }
    if (to === "ACTIVE") {
      payload.canceledAt = null;
      payload.cancelAtPeriodEnd = false;
    }
    await updateDoc(doc(collectionFor(tenantId), current.id), payload);
  }

  return { ok: true };
}
