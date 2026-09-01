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
import type { Automation, AutomationRun, AutomationTrigger } from "@/types";

const automationsFor = (tenantId: string) => tenantCollections(getFirebaseFirestore(), tenantId).automations();
const runsFor = (tenantId: string) => tenantCollections(getFirebaseFirestore(), tenantId).automationRuns();

export async function listAutomations(tenantId: string): Promise<Automation[]> {
  const snap = await getDocs(query(automationsFor(tenantId), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Automation);
}

export interface CreateAutomationInput {
  name: string;
  trigger: AutomationTrigger;
  channel: Automation["channel"];
  config?: Record<string, unknown>;
  enabled?: boolean;
}

export async function createAutomation(tenantId: string, input: CreateAutomationInput): Promise<string> {
  const ref = await addDoc(automationsFor(tenantId), {
    tenantId,
    name: input.name.trim(),
    trigger: input.trigger,
    channel: input.channel,
    config: input.config ?? {},
    enabled: input.enabled ?? true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateAutomation(
  tenantId: string,
  id: string,
  input: Partial<CreateAutomationInput>
): Promise<void> {
  await updateDoc(doc(automationsFor(tenantId), id), { ...input, updatedAt: serverTimestamp() });
}

export async function toggleAutomation(tenantId: string, id: string, enabled: boolean): Promise<void> {
  await updateDoc(doc(automationsFor(tenantId), id), { enabled, updatedAt: serverTimestamp() });
}

export async function listAutomationRuns(
  tenantId: string,
  opts: { automationId?: string; max?: number } = {}
): Promise<AutomationRun[]> {
  const constraints = [];
  if (opts.automationId) constraints.push(where("automationId", "==", opts.automationId));
  const snap = await getDocs(
    query(runsFor(tenantId), ...constraints, orderBy("createdAt", "desc"), limit(opts.max ?? 50))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AutomationRun);
}

export async function findAutomationRun(
  tenantId: string,
  automationId: string,
  targetId: string
): Promise<AutomationRun | null> {
  const snap = await getDocs(
    query(runsFor(tenantId), where("automationId", "==", automationId), where("targetId", "==", targetId), limit(1))
  );
  return snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as AutomationRun);
}

/** Registra a execução da automação para um alvo (idempotência). */
export async function recordAutomationRun(
  tenantId: string,
  input: { automationId: string; targetId: string; status: AutomationRun["status"]; error?: string }
): Promise<string> {
  const ref = await addDoc(runsFor(tenantId), {
    tenantId,
    automationId: input.automationId,
    targetId: input.targetId,
    status: input.status,
    error: input.error ?? null,
    executedAt: input.status === "sent" || input.status === "failed" ? serverTimestamp() : null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}
