import { describe, expect, it } from "vitest";
import {
  DEFAULT_TZ,
  dayOfWeekOf,
  instantFromWallClock,
  minutesToTime,
  toMinutes,
  validateSlotAvailability,
  wallClockOf,
} from "./timezone";
import type { Holiday, ProfessionalAvailability } from "@/types";

const MONDAY = "2025-05-05"; // segunda-feira

function makeAvailability(overrides: Partial<ProfessionalAvailability> = {}): ProfessionalAvailability {
  return {
    id: "av1",
    tenantId: "t1",
    professionalId: "p1",
    workDays: [
      { dayOfWeek: 1, enabled: true, startTime: "09:00", endTime: "18:00", breaks: [{ start: "12:00", end: "13:00" }] },
    ],
    daysOff: [],
    vacations: [],
    blockedDates: [],
    exceptions: [],
    updatedAt: { seconds: 0, nanoseconds: 0 },
    ...overrides,
  };
}

describe("instantFromWallClock", () => {
  it("converte 09:00 em São Paulo (UTC-3) para 12:00 UTC", () => {
    const instant = instantFromWallClock(MONDAY, "09:00", "America/Sao_Paulo");
    expect(instant.getUTCHours()).toBe(12);
    expect(instant.getUTCDate()).toBe(5);
  });

  it("respeita fusos com meia hora de offset (America/St_Johns, UTC-2:30 no horário de verão)", () => {
    const instant = instantFromWallClock(MONDAY, "09:00", "America/St_Johns");
    expect(instant.getUTCHours()).toBe(11);
    expect(instant.getUTCMinutes()).toBe(30);
  });

  it("converte corretamente em fuso positivo (Europe/Berlin)", () => {
    const instant = instantFromWallClock("2025-05-05", "00:00", "Europe/Berlin");
    expect(instant.getUTCDate()).toBe(4);
    expect(instant.getUTCHours()).toBe(22);
  });

  it("round-trip: wallClockOf(instantFromWallClock(t)) devolve o mesmo relógio", () => {
    const instant = instantFromWallClock(MONDAY, "10:30", DEFAULT_TZ);
    const wall = wallClockOf(instant, DEFAULT_TZ);
    expect(wall.date).toBe(MONDAY);
    expect(wall.time).toBe("10:30");
  });

  it("produz instantes estáveis (sem flutuação de offset)", () => {
    const a = instantFromWallClock(MONDAY, "09:00", DEFAULT_TZ).getTime();
    const b = instantFromWallClock(MONDAY, "09:00", DEFAULT_TZ).getTime();
    expect(a).toBe(b);
  });
});

describe("wallClockOf / dayOfWeekOf", () => {
  it("extrai o relógio local do instante", () => {
    const instant = new Date("2025-05-05T12:00:00Z");
    const wall = wallClockOf(instant, "America/Sao_Paulo");
    expect(wall.date).toBe("2025-05-05");
    expect(wall.time).toBe("09:00");
  });

  it("dayOfWeekOf reconhece segunda-feira como 1", () => {
    expect(dayOfWeekOf(MONDAY)).toBe(1);
  });

  it("minutesToTime e toMinutes são inversos", () => {
    for (const time of ["00:00", "09:05", "12:30", "23:59"]) {
      expect(minutesToTime(toMinutes(time))).toBe(time);
    }
  });
});

describe("validateSlotAvailability", () => {
  const at = (time: string, date = MONDAY) => instantFromWallClock(date, time, DEFAULT_TZ);

  it("aprova um horário válido dentro do expediente", () => {
    const result = validateSlotAvailability({
      availability: makeAvailability(),
      holidays: [],
      durationMinutes: 30,
      instant: at("10:00"),
    });
    expect(result.ok).toBe(true);
  });

  it("recusa profissional sem disponibilidade", () => {
    const result = validateSlotAvailability({
      availability: null,
      holidays: [],
      durationMinutes: 30,
      instant: at("10:00"),
    });
    expect(result.ok).toBe(false);
  });

  it("recusa horário fora do expediente", () => {
    const result = validateSlotAvailability({
      availability: makeAvailability(),
      holidays: [],
      durationMinutes: 30,
      instant: at("08:00"),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("expediente");
  });

  it("recusa serviço que ultrapassa o fim do expediente", () => {
    const result = validateSlotAvailability({
      availability: makeAvailability(),
      holidays: [],
      durationMinutes: 60,
      instant: at("17:30"),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("expediente");
  });

  it("recusa horário que cruza um intervalo de pausa", () => {
    const result = validateSlotAvailability({
      availability: makeAvailability(),
      holidays: [],
      durationMinutes: 30,
      instant: at("12:30"),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("pausa");
  });

  it("aprova horário logo após o intervalo", () => {
    const result = validateSlotAvailability({
      availability: makeAvailability(),
      holidays: [],
      durationMinutes: 30,
      instant: at("13:00"),
    });
    expect(result.ok).toBe(true);
  });

  it("recusa dia de folga", () => {
    const result = validateSlotAvailability({
      availability: makeAvailability({ daysOff: [MONDAY] }),
      holidays: [],
      durationMinutes: 30,
      instant: at("10:00"),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("folga");
  });

  it("recusa data bloqueada", () => {
    const result = validateSlotAvailability({
      availability: makeAvailability({ blockedDates: [MONDAY] }),
      holidays: [],
      durationMinutes: 30,
      instant: at("10:00"),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("bloqueada");
  });

  it("recusa período de férias", () => {
    const result = validateSlotAvailability({
      availability: makeAvailability({ vacations: [{ id: "v1", startDate: "2025-05-01", endDate: "2025-05-10" }] }),
      holidays: [],
      durationMinutes: 30,
      instant: at("10:00"),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("férias");
  });

  it("recusa feriado do tenant", () => {
    const holidays: Holiday[] = [{ id: "h1", tenantId: "t1", date: MONDAY, name: "Feriado" }];
    const result = validateSlotAvailability({
      availability: makeAvailability(),
      holidays,
      durationMinutes: 30,
      instant: at("10:00"),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Feriado");
  });

  it("aplica exceção com horário especial", () => {
    const availability = makeAvailability({
      exceptions: [{ id: "e1", tenantId: "t1", date: MONDAY, startTime: "13:00", endTime: "17:00", reason: "Especial" }],
    });
    const before = validateSlotAvailability({ availability, holidays: [], durationMinutes: 30, instant: at("10:00") });
    expect(before.ok).toBe(false);

    const during = validateSlotAvailability({ availability, holidays: [], durationMinutes: 30, instant: at("14:00") });
    expect(during.ok).toBe(true);
  });

  it("recusa exceção de expediente fechado", () => {
    const availability = makeAvailability({
      exceptions: [{ id: "e1", tenantId: "t1", date: MONDAY, reason: "Fechado" }],
    });
    const result = validateSlotAvailability({ availability, holidays: [], durationMinutes: 30, instant: at("10:00") });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("fechado");
  });
});
