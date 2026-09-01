import { describe, expect, it } from "vitest";
import { FakeFirestore, type FakeFirestore as FakeDb } from "@/lib/booking/fakeFirestore";
import {
  ApiValidationError,
  apiCreateAppointment,
  apiCreateCustomer,
  apiListAppointments,
  apiListCustomers,
  apiListProfessionals,
  apiListServices,
} from "./publicApi";

const MONDAY = "2030-01-14";

function seedTenant(db: FakeDb, opts: { slug?: string } = {}) {
  const tenantId = "t1";
  const slug = opts.slug ?? "tena";
  db.store.set(`tenants/${tenantId}`, {
    id: tenantId,
    slug,
    name: "Empresa Teste",
    status: "active",
    planId: "ALL",
    ownerUserId: "owner1",
    settings: {
      timezone: "America/Sao_Paulo",
      currency: "BRL",
      slotIntervalMinutes: 30,
      bookingLeadTimeMinutes: 60,
      bookingCancelWindowMinutes: 120,
      confirmationRequired: false,
      allowOnlinePayments: false,
    },
  });
  db.store.set(`tenants/${tenantId}/services/svc1`, {
    id: "svc1",
    tenantId,
    name: "Corte",
    price: 100,
    durationMinutes: 30,
    status: "active",
    requiresProfessional: true,
    professionals: ["pro1"],
  });
  db.store.set(`tenants/${tenantId}/services/svc2`, {
    id: "svc2",
    tenantId,
    name: "Inativo",
    price: 50,
    durationMinutes: 30,
    status: "inactive",
    requiresProfessional: true,
    professionals: [],
  });
  db.store.set(`tenants/${tenantId}/professionals/pro1`, {
    id: "pro1",
    tenantId,
    name: "Profissional A",
    active: true,
    serviceIds: ["svc1"],
    color: "#6366f1",
  });
  db.store.set(`tenants/${tenantId}/professionals/pro2`, {
    id: "pro2",
    tenantId,
    name: "Profissional Inativo",
    active: false,
    serviceIds: [],
    color: "#111",
  });
  db.store.set(`tenants/${tenantId}/availability/av1`, {
    id: "av1",
    tenantId,
    professionalId: "pro1",
    workDays: [{ dayOfWeek: 1, enabled: true, startTime: "09:00", endTime: "18:00", breaks: [] }],
    daysOff: [],
    vacations: [],
    blockedDates: [],
    exceptions: [],
    updatedAt: new Date("2029-01-01T00:00:00Z"),
  });
  return tenantId;
}

describe("publicApi (Fase 3.12)", () => {
  it("lista apenas serviços ativos", async () => {
    const db = new FakeFirestore();
    const tenantId = seedTenant(db);
    const services = await apiListServices(db as never, tenantId);
    expect(services.map((s) => s.name)).toEqual(["Corte"]);
  });

  it("lista apenas profissionais ativos", async () => {
    const db = new FakeFirestore();
    const tenantId = seedTenant(db);
    const professionals = await apiListProfessionals(db as never, tenantId);
    expect(professionals.map((p) => p.name)).toEqual(["Profissional A"]);
  });

  it("lista clientes com paginação por cursor", async () => {
    const db = new FakeFirestore();
    const tenantId = "t1";
    for (const name of ["Ana", "Bia", "Carlos"]) {
      db.store.set(`tenants/${tenantId}/customers/c_${name}`, {
        id: `c_${name}`,
        tenantId,
        name,
        tags: [],
        totalSpent: 0,
        visitCount: 0,
      });
    }

    const page1 = await apiListCustomers(db as never, tenantId, { limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).toBeTruthy();

    const page2 = await apiListCustomers(db as never, tenantId, { limit: 2, cursor: page1.nextCursor! });
    expect(page2.items).toHaveLength(1);
    expect(page2.nextCursor).toBeNull();

    const search = await apiListCustomers(db as never, tenantId, { search: "ana" });
    expect(search.items.map((c) => c.name)).toEqual(["Ana"]);
  });

  it("cria cliente validando nome", async () => {
    const db = new FakeFirestore();
    const tenantId = "t1";
    const created = await apiCreateCustomer(db as never, tenantId, {
      name: "João Silva",
      phone: "11999999999",
      tags: ["vip"],
    });
    expect(created.id).toBeTruthy();
    const snap = await db.collection("tenants").doc(tenantId).collection("customers").doc(created.id).get();
    expect(snap.data().name).toBe("João Silva");
    expect(snap.data().totalSpent).toBe(0);
    expect(snap.data().source).toBe("api");

    await expect(apiCreateCustomer(db as never, tenantId, { name: "" })).rejects.toBeInstanceOf(
      ApiValidationError
    );
  });

  it("lista agendamentos com filtro de status e intervalo", async () => {
    const db = new FakeFirestore();
    const tenantId = "t1";
    db.store.set(`tenants/${tenantId}/appointments/a1`, {
      id: "a1",
      tenantId,
      professionalId: "pro1",
      serviceId: "svc1",
      customerId: "c1",
      startAt: new Date("2030-01-14T10:00:00Z"),
      endAt: new Date("2030-01-14T10:30:00Z"),
      status: "confirmed",
      price: 100,
    });
    db.store.set(`tenants/${tenantId}/appointments/a2`, {
      id: "a2",
      tenantId,
      professionalId: "pro1",
      serviceId: "svc1",
      customerId: "c1",
      startAt: new Date("2030-02-01T10:00:00Z"),
      endAt: new Date("2030-02-01T10:30:00Z"),
      status: "pending",
      price: 100,
    });

    const confirmed = await apiListAppointments(db as never, tenantId, { status: "confirmed" });
    expect(confirmed.items).toHaveLength(1);
    expect(confirmed.items[0].id).toBe("a1");

    const ranged = await apiListAppointments(db as never, tenantId, {
      from: "2030-01-01T00:00:00Z",
      to: "2030-01-31T00:00:00Z",
    });
    expect(ranged.items.map((a) => a.id)).toEqual(["a1"]);
  });

  it("cria agendamento via motor de booking", async () => {
    const db = new FakeFirestore();
    seedTenant(db);
    const result = await apiCreateAppointment(db as never, "t1", {
      serviceId: "svc1",
      professionalId: "pro1",
      date: MONDAY,
      time: "10:00",
      customer: { name: "João Silva", phone: "11999999999" },
    });
    expect(result.appointmentId).toMatch(/^pro1_\d+$/);
    expect(result.price).toBe(100);
  });

  it("valida dados obrigatórios ao criar agendamento", async () => {
    const db = new FakeFirestore();
    seedTenant(db);
    await expect(
      apiCreateAppointment(db as never, "t1", {
        serviceId: "svc1",
        professionalId: "pro1",
        date: MONDAY,
        time: "10:00",
        customer: {},
      })
    ).rejects.toBeInstanceOf(ApiValidationError);
  });
});
