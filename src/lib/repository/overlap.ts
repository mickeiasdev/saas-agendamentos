import type { Appointment } from "@/types";

export const OVERLAP_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

export function overlapLookback(startAt: Date): Date {
  return new Date(startAt.getTime() - OVERLAP_LOOKBACK_MS);
}

export function isBlockingStatus(status: Appointment["status"] | undefined): boolean {
  return status !== "cancelled" && status !== "no_show";
}

export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

export function toInstant(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v && typeof v === "object" && typeof (v as { toDate?: unknown }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate();
  }
  return new Date(String(v));
}

export interface OverlapCandidate {
  id: string;
  startAt: unknown;
  endAt: unknown;
  status?: Appointment["status"];
}

/**
 * Filtra agendamentos que bloqueiam o intervalo [startAt, endAt).
 * Ids em `ignoreIds` (ex.: o próprio slot ou o agendamento sendo remarcado)
 * são ignorados.
 */
export function asOverlapCandidate(
  id: string,
  data: { startAt?: unknown; endAt?: unknown; status?: Appointment["status"] }
): OverlapCandidate {
  return { id, startAt: data.startAt, endAt: data.endAt, status: data.status };
}

export function findBlockingOverlaps(
  docs: OverlapCandidate[],
  startAt: Date,
  endAt: Date,
  ignoreIds: string[] = []
): OverlapCandidate[] {
  const ignore = new Set(ignoreIds);
  return docs.filter((d) => {
    if (ignore.has(d.id)) return false;
    if (!isBlockingStatus(d.status)) return false;
    return rangesOverlap(startAt, endAt, toInstant(d.startAt), toInstant(d.endAt));
  });
}
