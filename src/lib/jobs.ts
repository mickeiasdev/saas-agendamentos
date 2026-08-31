import type { Job, JobStatus } from "@/types";

/**
 * Filas/Jobs (Fase 3.23).
 *
 * Arquitetura de jobs para tarefas pesadas (notificações, e-mails, relatórios,
 * webhooks, automações). Utiliza serviços gratuitos enquanto suficientes;
 * aqui ficam os helpers puros de agendamento, re-tentativas e backoff.
 * A execução pode ser feita via Cloud Functions / cron ou processamento
 * manual, sem mudar a lógica de ciclo de vida do job.
 */

export interface ScheduleJobInput {
  tenantId?: string;
  type: string;
  payload: Record<string, unknown>;
  runAt?: Date;
  maxAttempts?: number;
}

export function buildJob(input: ScheduleJobInput, now = new Date()): Omit<Job, "id"> {
  const runAt = input.runAt ?? now;
  if (runAt.getTime() < now.getTime() - 1000) {
    throw new Error("runAt não pode estar no passado.");
  }
  return {
    tenantId: input.tenantId,
    type: input.type,
    payload: input.payload,
    status: "queued",
    attempts: 0,
    maxAttempts: input.maxAttempts ?? 3,
    runAt,
    createdAt: now,
    updatedAt: now,
  };
}

export function canRunJob(job: Pick<Job, "status" | "runAt">, now = new Date()): boolean {
  return job.status === "queued" && now.getTime() >= job.runAt.getTime();
}

export interface JobRunResult {
  status: JobStatus;
  attempts: number;
  runAt: Date;
  lastError?: string;
}

/**
 * Marca o resultado de uma execução. Se falhar e ainda houver tentativas,
 * agenda nova execução com backoff exponencial (2^n * baseDelayMs).
 */
export function applyJobResult(
  job: Pick<Job, "attempts" | "maxAttempts" | "runAt">,
  ok: boolean,
  error?: string,
  now = new Date(),
  baseDelayMs = 30_000
): JobRunResult {
  const attempts = job.attempts + 1;
  if (ok) {
    return { status: "completed", attempts, runAt: job.runAt };
  }
  const remaining = job.maxAttempts - attempts;
  if (remaining <= 0) {
    return { status: "failed", attempts, runAt: job.runAt, lastError: error };
  }
  const delay = Math.min(baseDelayMs * 2 ** attempts, 3600_000);
  return {
    status: "queued",
    attempts,
    runAt: new Date(now.getTime() + delay),
    lastError: error,
  };
}

export function jobStatusLabel(status: JobStatus): string {
  const labels: Record<JobStatus, string> = {
    queued: "Na fila",
    running: "Em execução",
    completed: "Concluído",
    failed: "Falhou",
  };
  return labels[status] ?? status;
}
