import { describe, expect, it } from "vitest";
import {
  buildAutomationContent,
  daysSince,
  isAutomationRunEligible,
  isBirthday,
  selectBirthdayCustomers,
  selectCompletedUnreviewed,
  selectInactiveCustomers,
  selectTomorrowAppointments,
} from "./automations";
import type { Appointment, Automation, AutomationRun, Customer } from "@/types";

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  const now = new Date("2026-01-10T12:00:00Z");
  return {
    id: "c1",
    tenantId: "tenant-a",
    name: "Maria",
    tags: [],
    totalSpent: 0,
    visitCount: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  const now = new Date("2026-01-10T12:00:00Z");
  return {
    id: "a1",
    tenantId: "tenant-a",
    professionalId: "pro-1",
    serviceId: "svc-1",
    customerId: "c1",
    startAt: now,
    endAt: new Date(now.getTime() + 3600000),
    status: "confirmed",
    price: 50,
    paymentStatus: "pending",
    createdBy: "customer",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("automations (Fase 3.7)", () => {
  const now = new Date("2026-01-10T12:00:00Z");

  it("calcula dias desde uma data", () => {
    const past = new Date("2026-01-05T12:00:00Z");
    expect(daysSince(past, now)).toBe(5);
    expect(daysSince(undefined, now)).toBeNull();
  });

  it("detecta aniversário", () => {
    expect(isBirthday("1990-01-10", now)).toBe(true);
    expect(isBirthday("1990-01-11", now)).toBe(false);
    expect(isBirthday(undefined, now)).toBe(false);
  });

  it("seleciona clientes inativos", () => {
    const customers = [
      makeCustomer({ id: "c1", lastVisitAt: new Date("2025-12-01T12:00:00Z") }),
      makeCustomer({ id: "c2", lastVisitAt: new Date("2026-01-09T12:00:00Z") }),
      makeCustomer({ id: "c3", lastVisitAt: undefined }),
    ];
    const result = selectInactiveCustomers(customers, 30, now);
    expect(result.map((c) => c.id)).toEqual(["c1"]);
  });

  it("seleciona aniversariantes do dia", () => {
    const customers = [
      makeCustomer({ id: "c1", birthDate: "1990-01-10" }),
      makeCustomer({ id: "c2", birthDate: "1990-01-11" }),
      makeCustomer({ id: "c3", birthDate: undefined }),
    ];
    expect(selectBirthdayCustomers(customers, now).map((c) => c.id)).toEqual(["c1"]);
  });

  it("seleciona agendamentos de amanhã", () => {
    const tomorrow = new Date("2026-01-11T14:00:00Z");
    const appointments = [
      makeAppointment({ id: "a1", startAt: tomorrow, status: "confirmed" }),
      makeAppointment({ id: "a2", startAt: tomorrow, status: "cancelled" }),
      makeAppointment({ id: "a3", startAt: new Date("2026-01-12T14:00:00Z"), status: "confirmed" }),
    ];
    expect(selectTomorrowAppointments(appointments, now).map((a) => a.id)).toEqual(["a1"]);
  });

  it("seleciona concluídos sem avaliação", () => {
    const appointments = [
      makeAppointment({ id: "a1", status: "completed" }),
      makeAppointment({ id: "a2", status: "completed" }),
      makeAppointment({ id: "a3", status: "confirmed" }),
    ];
    const reviewed = new Set(["a2"]);
    expect(selectCompletedUnreviewed(appointments, reviewed).map((a) => a.id)).toEqual(["a1"]);
  });

  it("constrói conteúdo por gatilho", () => {
    expect(buildAutomationContent("birthday", { customerName: "Maria" }).title).toBe("Feliz aniversário!");
    expect(buildAutomationContent("appointment_tomorrow", { serviceName: "Corte", appointmentDate: "11/01", appointmentTime: "14:00" }).body).toContain("Corte");
    expect(buildAutomationContent("customer_inactive", {}).title).toBe("Sentimos sua falta!");
    expect(buildAutomationContent("appointment_completed", {}).title).toContain("Como foi");
  });

  it("verifica elegibilidade de execução (idempotência)", () => {
    const automation = { enabled: true } as Automation;
    const runs: Pick<AutomationRun, "targetId" | "status">[] = [
      { targetId: "x", status: "sent" },
    ];
    expect(isAutomationRunEligible(automation, runs, "y")).toBe(true);
    expect(isAutomationRunEligible(automation, runs, "x")).toBe(false);
    expect(isAutomationRunEligible({ enabled: false } as Automation, [], "y")).toBe(false);
  });
});
