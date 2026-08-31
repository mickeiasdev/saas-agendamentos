import type {
  Appointment,
  Holiday,
  ProfessionalAvailability,
  Slot,
} from "@/types";

export interface SlotGenerationOptions {
  availability: ProfessionalAvailability | null;
  serviceDurationMinutes: number;
  appointments: Appointment[];
  holidays: Holiday[];
  slotIntervalMinutes: number;
  date: string; // YYYY-MM-DD
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function resolveDate(value: Date | { toDate?: () => Date }): Date {
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(String(value));
}

function toDateTime(date: string, minutes: number): Date {
  const [y, m, d] = date.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  dateObj.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return dateObj;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Gera os slots disponíveis de um profissional para um dia específico.
 * Regras consideradas:
 *  - expediente (workDays + breaks)
 *  - folgas (daysOff), férias (vacations), bloqueios (blockedDates)
 *  - exceções (exceptions) que alteram o expediente do dia
 *  - feriados (holidays) do tenant
 *  - agendamentos existentes (bloqueiam os horários)
 */
export function generateSlots(opts: SlotGenerationOptions): Slot[] {
  const {
    availability,
    serviceDurationMinutes,
    appointments,
    holidays,
    slotIntervalMinutes,
    date,
  } = opts;

  if (!availability) return [];

  const weekday = new Date(`${date}T00:00:00`).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const workDay = availability.workDays.find((w) => w.dayOfWeek === weekday);
  if (!workDay || !workDay.enabled) return [];

  if (availability.daysOff.includes(date)) return [];
  if (availability.blockedDates.includes(date)) return [];
  if (
    availability.vacations.some((v) => date >= v.startDate && date <= v.endDate)
  ) {
    return [];
  }
  if (holidays.some((h) => h.date === date)) return [];

  let start = toMinutes(workDay.startTime);
  let end = toMinutes(workDay.endTime);

  const exception = availability.exceptions.find((e) => e.date === date);
  if (exception) {
    if (exception.startTime && exception.endTime) {
      start = toMinutes(exception.startTime);
      end = toMinutes(exception.endTime);
    } else {
      return [];
    }
  }

  const dayAppointments = appointments.filter((a) => {
    const startAt = resolveDate(a.startAt);
    return toDateKey(startAt) === date && a.status !== "cancelled" && a.status !== "no_show";
  });

  const occupied: Array<[number, number]> = dayAppointments.map((a) => {
    const st = resolveDate(a.startAt);
    const en = resolveDate(a.endAt);
    return [st.getHours() * 60 + st.getMinutes(), en.getHours() * 60 + en.getMinutes()];
  });

  const busyRanges = [...workDay.breaks.map((b) => [toMinutes(b.start), toMinutes(b.end)] as [number, number]), ...occupied];

  const slots: Slot[] = [];
  const now = new Date();
  const today = toDateKey(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (let t = start; t + serviceDurationMinutes <= end; t += slotIntervalMinutes) {
    const slotStart = t;
    const slotEnd = t + serviceDurationMinutes;

    if (today === date && slotStart < nowMinutes) continue;

    const isBusy = busyRanges.some(([bS, bE]) =>
      overlaps(slotStart, slotEnd, bS, bE)
    );

    slots.push({
      start: toDateTime(date, slotStart),
      end: toDateTime(date, slotEnd),
      professionalId: availability.professionalId,
      available: !isBusy,
    });
  }

  return slots;
}

export function isSlotAvailable(slot: Slot): boolean {
  return slot.available;
}
