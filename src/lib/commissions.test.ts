import { describe, expect, it } from "vitest";
import {
  calculateCommission,
  commissionForService,
  commissionsByProfessional,
} from "./commissions";
import type { Appointment, Professional, Service } from "@/types";

const professional: Professional = {
  id: "p1",
  tenantId: "t1",
  name: "Rafael",
  color: "#000",
  active: true,
  serviceIds: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const service: Service = {
  id: "s1",
  tenantId: "t1",
  name: "Corte",
  price: 100,
  durationMinutes: 30,
  status: "active",
  requiresProfessional: true,
  commissionPercent: 40,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function appointment(price: number, status: Appointment["status"] = "completed"): Appointment {
  return {
    id: `a-${price}`,
    tenantId: "t1",
    professionalId: "p1",
    serviceId: "s1",
    customerId: "c1",
    startAt: new Date(),
    endAt: new Date(),
    status,
    price,
    paymentStatus: "paid",
    createdBy: "customer",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("comissões (Fase 2.19)", () => {
  it("calcula comissão como preço x percentual", () => {
    expect(calculateCommission(100, 40)).toBe(40);
    expect(calculateCommission(95, 20)).toBe(19);
    expect(calculateCommission(33.33, 50)).toBe(16.67);
  });

  it("percentual zero ou negativo não gera comissão", () => {
    expect(calculateCommission(100, 0)).toBe(0);
    expect(calculateCommission(100, -10)).toBe(0);
  });

  it("usa o percentual configurado no serviço", () => {
    expect(commissionForService(service)).toBe(40);
    expect(commissionForService({ price: 200, commissionPercent: 10 })).toBe(20);
    expect(commissionForService({ price: 200, commissionPercent: undefined })).toBe(0);
  });

  it("agrega comissões por profissional considerando apenas status válidos", () => {
    const rows = commissionsByProfessional(
      [appointment(100), appointment(200), appointment(50, "cancelled")],
      [professional],
      [service]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].appointments).toBe(2);
    expect(rows[0].revenue).toBe(300);
    expect(rows[0].commission).toBe(120); // (100 + 200) * 40%
  });

  it("agendamentos cancelados não entram na comissão", () => {
    const rows = commissionsByProfessional([appointment(100, "cancelled")], [professional], [service]);
    expect(rows[0].appointments).toBe(0);
    expect(rows[0].commission).toBe(0);
  });
});
