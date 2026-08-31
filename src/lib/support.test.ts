import { describe, expect, it } from "vitest";
import {
  canTransitionTicketStatus,
  compareTickets,
  isTicketBodyValid,
  isTicketTitleValid,
  priorityOf,
  ticketPriorityLabel,
  ticketStatusLabel,
} from "./support";
import type { SupportTicket } from "@/types";

function makeTicket(overrides: Partial<SupportTicket> = {}): SupportTicket {
  const now = new Date("2026-01-10T12:00:00Z");
  return {
    id: "t1",
    tenantId: "tenant-a",
    subject: "Não consigo agendar",
    priority: "normal",
    status: "open",
    createdBy: "user-1",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("support (Fase 3.15)", () => {
  it("valida título e corpo", () => {
    expect(isTicketTitleValid("Erro ao agendar")).toBe(true);
    expect(isTicketTitleValid("ab")).toBe(false);
    expect(isTicketBodyValid("Detalhes do problema")).toBe(true);
    expect(isTicketBodyValid("  ")).toBe(false);
  });

  it("controla transições de status", () => {
    expect(canTransitionTicketStatus("open", "in_progress")).toBe(true);
    expect(canTransitionTicketStatus("open", "closed")).toBe(true);
    expect(canTransitionTicketStatus("open", "open")).toBe(false);
    expect(canTransitionTicketStatus("closed", "open")).toBe(false);
    expect(canTransitionTicketStatus("in_progress", "waiting")).toBe(true);
  });

  it("mapeia prioridade para nível", () => {
    expect(priorityOf("urgent")).toBe(4);
    expect(priorityOf("normal")).toBe(2);
    expect(priorityOf("low")).toBe(1);
  });

  it("ordena por prioridade e depois por criação", () => {
    const urgent = makeTicket({ id: "a", priority: "urgent", createdAt: new Date("2026-01-01T00:00:00Z") });
    const normal = makeTicket({ id: "b", priority: "normal", createdAt: new Date("2026-01-02T00:00:00Z") });
    const normal2 = makeTicket({ id: "c", priority: "normal", createdAt: new Date("2026-01-03T00:00:00Z") });
    const sorted = [normal2, normal, urgent].sort(compareTickets);
    expect(sorted.map((t) => t.id)).toEqual(["a", "c", "b"]);
  });

  it("retorna rótulos", () => {
    expect(ticketStatusLabel("in_progress")).toBe("Em andamento");
    expect(ticketPriorityLabel("urgent")).toBe("Urgente");
  });
});
