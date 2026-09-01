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
import type { AuditLog } from "@/types";
import { buildAuditEntry, type AuditEntryInput } from "@/lib/audit";

const auditFor = (tenantId?: string) =>
  tenantId
    ? tenantCollections(getFirebaseFirestore(), tenantId).audit()
    : null;

/** Registra um evento de auditoria na subcoleção do tenant (imutável). */
export async function logAudit(input: AuditEntryInput): Promise<string | null> {
  if (!input.tenantId) return null;
  const col = auditFor(input.tenantId);
  if (!col) return null;
  const entry = buildAuditEntry(input);
  const ref = await addDoc(col, {
    tenantId: entry.tenantId,
    userId: entry.userId,
    action: entry.action,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId ?? null,
    metadata: entry.metadata ?? null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listAuditLogs(
  tenantId: string,
  opts: { max?: number; action?: string } = {}
): Promise<AuditLog[]> {
  const constraints = [];
  if (opts.action) constraints.push(where("action", "==", opts.action));
  const snap = await getDocs(
    query(tenantCollections(getFirebaseFirestore(), tenantId).audit(), ...constraints, orderBy("createdAt", "desc"), limit(opts.max ?? 100))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditLog);
}

export async function getAuditLog(tenantId: string, logId: string): Promise<AuditLog | null> {
  const snap = await getDocs(query(tenantCollections(getFirebaseFirestore(), tenantId).audit(), where("__name__", "==", logId)));
  return snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as AuditLog);
}
