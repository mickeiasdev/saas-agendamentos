import type { ImpersonationSession } from "@/types";

/**
 * Impersonation (Fase 3.16).
 *
 * Acesso temporário de suporte a um tenant. A sessão é sempre registrada com
 * administrador, tenant, motivo, horário de início e fim. Lógica pura de
 * ciclo de vida da sessão e validação de expiração.
 */

export const IMPERSONATION_MAX_MINUTES = 60;

export function isReasonValid(reason: string): boolean {
  return reason.trim().length >= 5;
}

export function buildImpersonationSession(
  input: { adminUid: string; adminEmail?: string; tenantId: string; reason: string },
  now = new Date()
): Omit<ImpersonationSession, "id"> {
  if (!isReasonValid(input.reason)) {
    throw new Error("Informe um motivo (mínimo 5 caracteres).");
  }
  return {
    adminUid: input.adminUid,
    adminEmail: input.adminEmail,
    tenantId: input.tenantId,
    reason: input.reason.trim(),
    startedAt: now,
    endedAt: null,
    status: "active",
  };
}

export function isImpersonationActive(
  session: Pick<ImpersonationSession, "status" | "startedAt" | "endedAt">,
  now = new Date()
): boolean {
  if (session.status !== "active") return false;
  if (session.endedAt) return false;
  const start = session.startedAt instanceof Date ? session.startedAt : session.startedAt?.toDate?.() ?? new Date(String(session.startedAt));
  const elapsedMin = (now.getTime() - start.getTime()) / 60000;
  return elapsedMin < IMPERSONATION_MAX_MINUTES;
}

export function endImpersonationSession(
  session: Pick<ImpersonationSession, "status">,
  now = new Date()
): Pick<ImpersonationSession, "status" | "endedAt"> {
  return {
    status: "ended",
    endedAt: now,
  };
}

export function impersonationDurationMinutes(
  session: Pick<ImpersonationSession, "startedAt" | "endedAt">,
  now = new Date()
): number {
  const start = session.startedAt instanceof Date ? session.startedAt : session.startedAt?.toDate?.() ?? new Date(String(session.startedAt));
  const end = session.endedAt instanceof Date ? session.endedAt : session.endedAt?.toDate?.() ?? now;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}
