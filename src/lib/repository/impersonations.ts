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
import type { ImpersonationSession } from "@/types";
import { buildImpersonationSession, isImpersonationActive } from "@/lib/impersonation";

const impersonationsFor = (tenantId: string) => tenantCollections(getFirebaseFirestore(), tenantId).impersonations();

export async function startImpersonation(
  tenantId: string,
  input: { adminUid: string; adminEmail?: string; reason: string },
  now = new Date()
): Promise<string> {
  const session = buildImpersonationSession({ tenantId, ...input }, now);
  const ref = await addDoc(impersonationsFor(tenantId), {
    tenantId,
    adminUid: session.adminUid,
    adminEmail: session.adminEmail ?? null,
    reason: session.reason,
    startedAt: session.startedAt,
    endedAt: null,
    status: "active",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function endImpersonation(tenantId: string, sessionId: string, now = new Date()): Promise<void> {
  await updateDoc(doc(impersonationsFor(tenantId), sessionId), {
    status: "ended",
    endedAt: now,
  });
}

export async function getActiveImpersonation(tenantId: string): Promise<ImpersonationSession | null> {
  const snap = await getDocs(
    query(impersonationsFor(tenantId), where("status", "==", "active"), orderBy("startedAt", "desc"), limit(1))
  );
  if (snap.empty) return null;
  const session = { id: snap.docs[0].id, ...snap.docs[0].data() } as ImpersonationSession;
  if (!isImpersonationActive(session)) return null;
  return session;
}

export async function listImpersonations(
  tenantId: string,
  opts: { max?: number } = {}
): Promise<ImpersonationSession[]> {
  const snap = await getDocs(
    query(impersonationsFor(tenantId), orderBy("startedAt", "desc"), limit(opts.max ?? 50))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ImpersonationSession);
}
