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
import type { Job } from "@/types";
import { buildJob } from "@/lib/jobs";

const jobsFor = (tenantId?: string) =>
  tenantId
    ? tenantCollections(getFirebaseFirestore(), tenantId).jobs()
    : null;

export interface ScheduleJobInput {
  tenantId?: string;
  type: string;
  payload: Record<string, unknown>;
  runAt?: Date;
  maxAttempts?: number;
}

/** Agenda um job (filas, Fase 3.23). */
export async function scheduleJob(input: ScheduleJobInput): Promise<string | null> {
  const col = jobsFor(input.tenantId);
  if (!col) return null;
  const job = buildJob(input);
  const ref = await addDoc(col, {
    tenantId: job.tenantId ?? null,
    type: job.type,
    payload: job.payload,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    runAt: job.runAt,
    lastError: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listJobs(tenantId: string, opts: { status?: Job["status"]; max?: number } = {}): Promise<Job[]> {
  const constraints = [];
  if (opts.status) constraints.push(where("status", "==", opts.status));
  const snap = await getDocs(
    query(tenantCollections(getFirebaseFirestore(), tenantId).jobs(), ...constraints, orderBy("runAt", "asc"), limit(opts.max ?? 50))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Job);
}

/** Marca o resultado de execução (sucesso ou re-agendamento com backoff). */
export async function applyJobOutcome(
  tenantId: string,
  jobId: string,
  ok: boolean,
  error?: string,
  now = new Date()
): Promise<void> {
  const snap = await getDocs(query(tenantCollections(getFirebaseFirestore(), tenantId).jobs(), where("__name__", "==", jobId)));
  if (snap.empty) return;
  const job = { id: snap.docs[0].id, ...snap.docs[0].data() } as Job;
  const attempts = job.attempts + 1;
  if (ok) {
    await updateDoc(doc(tenantCollections(getFirebaseFirestore(), tenantId).jobs(), jobId), {
      status: "completed",
      attempts,
      lastError: null,
      updatedAt: serverTimestamp(),
    });
    return;
  }
  const remaining = job.maxAttempts - attempts;
  if (remaining <= 0) {
    await updateDoc(doc(tenantCollections(getFirebaseFirestore(), tenantId).jobs(), jobId), {
      status: "failed",
      attempts,
      lastError: error ?? null,
      updatedAt: serverTimestamp(),
    });
    return;
  }
  const delay = Math.min(30_000 * 2 ** attempts, 3600_000);
  await updateDoc(doc(tenantCollections(getFirebaseFirestore(), tenantId).jobs(), jobId), {
    status: "queued",
    attempts,
    runAt: new Date(now.getTime() + delay),
    lastError: error ?? null,
    updatedAt: serverTimestamp(),
  });
}
