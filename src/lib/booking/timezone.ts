import type { Holiday, ProfessionalAvailability } from "@/types";

/**
 * Manipulação de horário no fuso do tenant (default America/Sao_Paulo).
 *
 * A convenção da plataforma: o "relógio de parede" (ex.: "09:00") é sempre
 * interpretado no fuso do tenant. As conversões abaixo são independentes do
 * fuso do servidor (que normalmente roda em UTC).
 */

export const DEFAULT_TZ = "America/Sao_Paulo";

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsInTz(instant: Date, tz: string): Record<string, string> {
  let dtf = formatterCache.get(tz);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    formatterCache.set(tz, dtf);
  }
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(instant)) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  if (parts.hour === "24") parts.hour = "00";
  return parts;
}

function offsetAt(instantMs: number, tz: string): number {
  const p = partsInTz(new Date(instantMs), tz);
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second)
  );
  return asUtc - instantMs;
}

export interface WallClock {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  dayOfWeek: number; // 0 = domingo
}

export function wallClockOf(instant: Date, tz = DEFAULT_TZ): WallClock {
  const p = partsInTz(instant, tz);
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
    dayOfWeek: new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day))).getUTCDay(),
  };
}

/**
 * Converte um horário de parede (date + time no fuso `tz`) no instante UTC.
 * Repete o cálculo de offset uma vez para cobrir bordas de DST.
 */
export function instantFromWallClock(date: string, time: string, tz = DEFAULT_TZ): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wallAsUtc = Date.UTC(y, m - 1, d, hh, mm, 0, 0);
  const first = wallAsUtc - offsetAt(wallAsUtc, tz);
  const second = wallAsUtc - offsetAt(first, tz);
  return new Date(second);
}

export function dayOfWeekOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export interface AvailabilityValidationResult {
  ok: boolean;
  reason?: string;
}

/**
 * Valida se um instante pode ser agendado para o profissional, considerando
 * expediente, pausas, folgas, férias, bloqueios, exceções e feriados.
 * Todas as regras são avaliadas no fuso do tenant.
 */
export function validateSlotAvailability(opts: {
  availability: ProfessionalAvailability | null;
  holidays: Holiday[];
  durationMinutes: number;
  instant: Date;
  tz?: string;
}): AvailabilityValidationResult {
  const {
    availability,
    holidays,
    durationMinutes,
    instant,
    tz = DEFAULT_TZ,
  } = opts;

  if (!availability) {
    return { ok: false, reason: "Profissional sem disponibilidade configurada." };
  }

  const wc = wallClockOf(instant, tz);
  const { date, time, dayOfWeek } = wc;
  const start = toMinutes(time);
  const end = start + durationMinutes;

  if (holidays.some((h) => h.date === date)) {
    return { ok: false, reason: "Feriado — sem atendimento nesta data." };
  }
  if (availability.daysOff.includes(date)) {
    return { ok: false, reason: "Profissional de folga nesta data." };
  }
  if (availability.blockedDates.includes(date)) {
    return { ok: false, reason: "Data bloqueada." };
  }
  if (
    availability.vacations.some((v) => date >= v.startDate && date <= v.endDate)
  ) {
    return { ok: false, reason: "Profissional em férias nesta data." };
  }

  const workDay = availability.workDays.find((w) => w.dayOfWeek === dayOfWeek);
  if (!workDay || !workDay.enabled) {
    return { ok: false, reason: "Fora do expediente." };
  }

  let dayStart = toMinutes(workDay.startTime);
  let dayEnd = toMinutes(workDay.endTime);

  const exception = availability.exceptions.find((e) => e.date === date);
  if (exception) {
    if (exception.startTime && exception.endTime) {
      dayStart = toMinutes(exception.startTime);
      dayEnd = toMinutes(exception.endTime);
    } else {
      return { ok: false, reason: "Expediente excepcionalmente fechado." };
    }
  }

  if (start < dayStart || end > dayEnd) {
    return { ok: false, reason: "Horário fora do expediente." };
  }

  const crossesBreak = workDay.breaks.some(
    (b) => start < toMinutes(b.end) && toMinutes(b.start) < end
  );
  if (crossesBreak) {
    return { ok: false, reason: "Horário cruza um intervalo de pausa." };
  }

  return { ok: true };
}
