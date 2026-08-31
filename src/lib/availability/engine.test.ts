import { describe, expect, it } from "vitest";
import { generateSlots } from "../availability/engine";
import type {
  Appointment,
  Holiday,
  ProfessionalAvailability,
} from "@/types";

const baseAvailability: ProfessionalAvailability = {
  id: "av1",
  tenantId: "t1",
  professionalId: "p1",
  workDays: [
    { dayOfWeek: 1, enabled: true, startTime: "09:00", endTime: "18:00", breaks: [] },
    { dayOfWeek: 2, enabled: true, startTime: "09:00", endTime: "12:00", breaks: [] },
  ],
  daysOff: [],
  vacations: [],
  blockedDates: [],
  exceptions: [],
  updatedAt: { seconds: 0, nanoseconds: 0 },
};

const apptAt = (time: string, durationMin = 30): Appointment => {
  const [h, m] = time.split(":").map(Number);
  const start = new Date(2025, 4, 5, h, m, 0, 0); // 05/05/2025 é segunda-feira
  const end = new Date(start.getTime() + durationMin * 60000);
  return {
    id: "x",
    tenantId: "t1",
    professionalId: "p1",
    serviceId: "s1",
    customerId: "c1",
    startAt: start,
    endAt: end,
    status: "confirmed",
    paymentStatus: "pending",
    price: 50,
    createdBy: "customer",
    createdAt: start,
    updatedAt: start,
  };
};

describe("generateSlots", () => {
  it("gera slots de 30 min entre 09:00 e 18:00 (sem agendamentos)", () => {
    const slots = generateSlots({
      availability: baseAvailability,
      serviceDurationMinutes: 30,
      appointments: [],
      holidays: [],
      slotIntervalMinutes: 30,
      date: "2025-05-05",
    });
    const available = slots.filter((s) => s.available);
    // 9h até 17:30 = 18 slots de 30min (o último precisa caber antes das 18:00)
    expect(available.length).toBe(18);
  });

  it("não gera slots em dia desativado", () => {
    const slots = generateSlots({
      availability: baseAvailability,
      serviceDurationMinutes: 30,
      appointments: [],
      holidays: [],
      slotIntervalMinutes: 30,
      date: "2025-05-07", // quarta-feira não configurada
    });
    expect(slots).toEqual([]);
  });

  it("respeita horário de fim (12h) no dia com expediente reduzido", () => {
    const slots = generateSlots({
      availability: baseAvailability,
      serviceDurationMinutes: 30,
      appointments: [],
      holidays: [],
      slotIntervalMinutes: 30,
      date: "2025-05-06", // terça: 09h-12h
    });
    const available = slots.filter((s) => s.available);
    // 9h,9:30,10h,10:30,11h,11:30 = 6 slots
    expect(available.length).toBe(6);
  });

  it("bloqueia horários com agendamentos existentes", () => {
    const slots = generateSlots({
      availability: baseAvailability,
      serviceDurationMinutes: 30,
      appointments: [apptAt("10:00")],
      holidays: [],
      slotIntervalMinutes: 30,
      date: "2025-05-05",
    });
    const available = slots.filter((s) => s.available);
    expect(available.length).toBe(17); // 18 - 1 ocupado
    expect(available.some((s) => s.start.getHours() === 10 && s.start.getMinutes() === 0)).toBe(false);
  });

  it("remove o dia quando existe folga", () => {
    const availability: ProfessionalAvailability = {
      ...baseAvailability,
      daysOff: ["2025-05-05"],
    };
    const slots = generateSlots({
      availability,
      serviceDurationMinutes: 30,
      appointments: [],
      holidays: [],
      slotIntervalMinutes: 30,
      date: "2025-05-05",
    });
    expect(slots).toEqual([]);
  });

  it("remove o dia em período de férias", () => {
    const availability: ProfessionalAvailability = {
      ...baseAvailability,
      vacations: [{ id: "v1", startDate: "2025-05-01", endDate: "2025-05-10" }],
    };
    const slots = generateSlots({
      availability,
      serviceDurationMinutes: 30,
      appointments: [],
      holidays: [],
      slotIntervalMinutes: 30,
      date: "2025-05-05",
    });
    expect(slots).toEqual([]);
  });

  it("remove o dia em feriado do tenant", () => {
    const holidays: Holiday[] = [{ id: "h1", tenantId: "t1", date: "2025-05-05", name: "Feriado" }];
    const slots = generateSlots({
      availability: baseAvailability,
      serviceDurationMinutes: 30,
      appointments: [],
      holidays,
      slotIntervalMinutes: 30,
      date: "2025-05-05",
    });
    expect(slots).toEqual([]);
  });

  it("não gera slots que cruzam o intervalo (break)", () => {
    const availability: ProfessionalAvailability = {
      ...baseAvailability,
      workDays: [
        {
          dayOfWeek: 1,
          enabled: true,
          startTime: "09:00",
          endTime: "18:00",
          breaks: [{ start: "12:00", end: "13:00" }],
        },
      ],
    };
    const slots = generateSlots({
      availability,
      serviceDurationMinutes: 30,
      appointments: [],
      holidays: [],
      slotIntervalMinutes: 30,
      date: "2025-05-05",
    });
    const available = slots.filter((s) => s.available);
    const times = available.map((s) => s.start.getHours() * 60 + s.start.getMinutes());
    // 12:00 (720) e 12:30 (750) cruzam o intervalo e não podem estar disponíveis
    expect(times).not.toContain(720);
    expect(times).not.toContain(750);
    // 13:00 (780) começa após o intervalo e deve estar disponível
    expect(times).toContain(780);
    // total: 18 slots - 2 (12h e 12h30) = 16
    expect(available.length).toBe(16);
  });

  it("não gera slots no passado para hoje", () => {
    const availability: ProfessionalAvailability = {
      ...baseAvailability,
      workDays: [
        {
          dayOfWeek: new Date().getDay() as never,
          enabled: true,
          startTime: "00:00",
          endTime: "23:59",
          breaks: [],
        },
      ],
    };
    const today = new Date();
    const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const slots = generateSlots({
      availability,
      serviceDurationMinutes: 60,
      appointments: [],
      holidays: [],
      slotIntervalMinutes: 60,
      date: dateKey,
    });
    const available = slots.filter((s) => s.available);
    expect(available.length).toBeGreaterThan(0);
    expect(available.every((s) => s.start.getTime() > Date.now())).toBe(true);
  });
});
