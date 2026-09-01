import {
  addDoc,
  doc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { tenantCollections } from "./collections";
import type { CustomerSubscription, CustomerSubscriptionPlan } from "@/types";
import { isPlanValid, renewSubscription } from "@/lib/customerSubscriptions";

const plansFor = (tenantId: string) => tenantCollections(getFirebaseFirestore(), tenantId).subscriptionPlans();
const subsFor = (tenantId: string) => tenantCollections(getFirebaseFirestore(), tenantId).customerSubscriptions();

// ---------- PLANOS VENDIDOS PELAS EMPRESAS ----------

export async function listSubscriptionPlans(tenantId: string, onlyActive = false): Promise<CustomerSubscriptionPlan[]> {
  const snap = await getDocs(query(plansFor(tenantId), orderBy("name")));
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CustomerSubscriptionPlan);
  return onlyActive ? list.filter((p) => p.active) : list;
}

export interface CreatePlanInput {
  name: string;
  description?: string;
  price: number;
  billingCycle: CustomerSubscriptionPlan["billingCycle"];
  appointmentsIncluded: number;
  active?: boolean;
}

export async function createSubscriptionPlan(tenantId: string, input: CreatePlanInput): Promise<string> {
  const validation = isPlanValid(input);
  if (!validation) throw new Error("Dados do plano inválidos.");
  const ref = await addDoc(plansFor(tenantId), {
    tenantId,
    name: input.name.trim(),
    description: input.description ?? null,
    price: input.price,
    billingCycle: input.billingCycle,
    appointmentsIncluded: input.appointmentsIncluded,
    active: input.active ?? true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateSubscriptionPlan(
  tenantId: string,
  id: string,
  input: Partial<CreatePlanInput>
): Promise<void> {
  await updateDoc(doc(plansFor(tenantId), id), { ...input, updatedAt: serverTimestamp() });
}

// ---------- ASSINATURAS DOS CLIENTES ----------

export async function listCustomerSubscriptions(
  tenantId: string,
  customerId?: string
): Promise<CustomerSubscription[]> {
  const q = customerId
    ? query(subsFor(tenantId), where("customerId", "==", customerId))
    : query(subsFor(tenantId), orderBy("cycleStart", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CustomerSubscription);
}

export interface CreateCustomerSubscriptionInput {
  planId: string;
  planName: string;
  customerId: string;
  customerName: string;
  price: number;
  appointmentsIncluded: number;
  billingCycle: CustomerSubscription["billingCycle"];
  cycleStart?: Date;
}

/** Assina um cliente em um plano (primeiro ciclo). */
export async function createCustomerSubscription(
  tenantId: string,
  input: CreateCustomerSubscriptionInput
): Promise<string> {
  const start = input.cycleStart ?? new Date();
  const durationDays = input.billingCycle === "weekly" ? 7 : input.billingCycle === "monthly" ? 30 : input.billingCycle === "quarterly" ? 90 : 365;
  const ref = await addDoc(subsFor(tenantId), {
    tenantId,
    planId: input.planId,
    planName: input.planName,
    customerId: input.customerId,
    customerName: input.customerName,
    price: input.price,
    appointmentsIncluded: input.appointmentsIncluded,
    appointmentsUsed: 0,
    billingCycle: input.billingCycle,
    cycleStart: start,
    cycleEnd: new Date(start.getTime() + durationDays * 86400000),
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Registra o uso de um atendimento na assinatura. */
export async function useCustomerSubscription(
  tenantId: string,
  subscriptionId: string
): Promise<void> {
  const snapshot = await getDocs(
    query(subsFor(tenantId), where("__name__", "==", subscriptionId))
  );
  if (snapshot.empty) throw new Error("Assinatura não encontrada.");
  const sub = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as CustomerSubscription;
  if (sub.appointmentsUsed >= sub.appointmentsIncluded) {
    throw new Error("Limite de atendimentos do ciclo atingido.");
  }
  await updateDoc(doc(subsFor(tenantId), subscriptionId), {
    appointmentsUsed: sub.appointmentsUsed + 1,
    updatedAt: serverTimestamp(),
  });
}

/** Renova a assinatura para o próximo ciclo. */
export async function renewCustomerSubscription(
  tenantId: string,
  subscriptionId: string,
  from?: Date
): Promise<void> {
  const snapshot = await getDocs(
    query(subsFor(tenantId), where("__name__", "==", subscriptionId))
  );
  if (snapshot.empty) throw new Error("Assinatura não encontrada.");
  const sub = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as CustomerSubscription;
  const renewed = renewSubscription(sub, from ?? new Date());
  await updateDoc(doc(subsFor(tenantId), subscriptionId), {
    appointmentsUsed: renewed.appointmentsUsed,
    cycleStart: renewed.cycleStart,
    cycleEnd: renewed.cycleEnd,
    status: renewed.status,
    updatedAt: serverTimestamp(),
  });
}

export async function setCustomerSubscriptionStatus(
  tenantId: string,
  subscriptionId: string,
  status: CustomerSubscription["status"]
): Promise<void> {
  await updateDoc(doc(subsFor(tenantId), subscriptionId), {
    status,
    updatedAt: serverTimestamp(),
  });
}
