import { describe, expect, it } from "vitest";
import { FakeFirestore, type FakeFirestore as FakeDb } from "./fakeFirestore";
import {
  BookingError,
  cancelPublicAppointment,
  createPublicAppointment,
  listPublicSlots,
  reschedulePublicAppointment,
} from "./server";
import { getPlan } from "@/lib/plans";

const MONDAY = "2030-01-14";

interface SeedOptions {
  tenantId?: string;
  slug?: string;
  status?: "active" | "suspended";
  planId?: "ALL";
  servicePrice?: number;
  serviceDuration?: number;
  leadTime?: number;
  cancelWindow?: number;
  withCoupon?: boolean;
  appointmentsInMonth?: number;
}

function seedTenant(db: FakeDb, opts: SeedOptions = {}): { tenantId: string; serviceId: string; professionalId: string } {
  const tenantId = opts.tenantId ?? "t1";
  const slug = opts.slug ?? "tena";
  const serviceId = "svc1";
  const professionalId = "pro1";

  db.store.set(`tenants/${tenantId}`, {
    id: tenantId,
    slug,
    name: "Empresa Teste",
    status: opts.status ?? "active",
    planId: opts.planId ?? "ALL",
    ownerUserId: "owner1",
    settings: {
      timezone: "America/Sao_Paulo",
      currency: "BRL",
      slotIntervalMinutes: 30,
      bookingLeadTimeMinutes: opts.leadTime ?? 60,
      bookingCancelWindowMinutes: opts.cancelWindow ?? 120,
      confirmationRequired: false,
      allowOnlinePayments: false,
    },
  });

  db.store.set(`tenants/${tenantId}/services/${serviceId}`, {
    id: serviceId,
    tenantId,
    name: "Corte",
    price: opts.servicePrice ?? 100,
    durationMinutes: opts.serviceDuration ?? 30,
    status: "active",
    professionals: [professionalId],
    requiresProfessional: true,
  });

  db.store.set(`tenants/${tenantId}/professionals/${professionalId}`, {
    id: professionalId,
    tenantId,
    name: "Profissional A",
    active: true,
    serviceIds: [serviceId],
    color: "#6366f1",
  });

  db.store.set(`tenants/${tenantId}/availability/av1`, {
    id: "av1",
    tenantId,
    professionalId,
    workDays: [
      { dayOfWeek: 1, enabled: true, startTime: "09:00", endTime: "18:00", breaks: [] },
    ],
    daysOff: [],
    vacations: [],
    blockedDates: [],
    exceptions: [],
    updatedAt: new Date("2029-01-01T00:00:00Z"),
  });

  if (opts.withCoupon) {
    db.store.set(`tenants/${tenantId}/coupons/c1`, {
      id: "c1",
      tenantId,
      code: "PROMO10",
      type: "percent",
      value: 10,
      active: true,
      usageLimit: null,
      usedCount: 0,
    });
  }

  if (opts.appointmentsInMonth) {
    const base = new Date(Date.UTC(2030, 0, 2, 9, 0, 0));
    for (let i = 0; i < opts.appointmentsInMonth; i++) {
      db.store.set(`tenants/${tenantId}/appointments/seed_${i}`, {
        id: `seed_${i}`,
        tenantId,
        professionalId,
        serviceId,
        customerId: "cust-seed",
        startAt: new Date(base.getTime() + i * 60000),
        endAt: new Date(base.getTime() + i * 60000 + 30 * 60000),
        status: "confirmed",
        price: 50,
      });
    }
  }

  return { tenantId, serviceId, professionalId };
}

const customer = { name: "João Silva", phone: "11999999999" };

async function createBooking(db: FakeDb, overrides: Record<string, unknown> = {}) {
  return createPublicAppointment(db as never, {
    tenantSlug: "tena",
    serviceId: "svc1",
    professionalId: "pro1",
    date: MONDAY,
    time: "10:00",
    customer,
    ...overrides,
  } as never);
}

describe("createPublicAppointment", () => {
  it("cria um agendamento confirmado e retorna o preço integral", async () => {
    const db = new FakeFirestore();
    seedTenant(db);
    const result = await createBooking(db);

    expect(result.couponApplied).toBe(false);
    expect(result.price).toBe(100);
    expect(result.appointmentId).toMatch(/^pro1_\d+$/);
    expect(result.customerId).toBeTruthy();

    const appt = db.store.get(`tenants/t1/appointments/${result.appointmentId}`);
    expect(appt).toBeTruthy();
    expect(appt!.status).toBe("confirmed");
    expect(appt!.createdBy).toBe("customer");
    expect(appt!.startAt).toBeInstanceOf(Date);
  });

  it("reusa o cliente existente quando o telefone já está cadastrado", async () => {
    const db = new FakeFirestore();
    seedTenant(db);
    const first = await createBooking(db);
    const second = await createBooking(db, { time: "11:00" });

    expect(second.customerId).toBe(first.customerId);
  });

  it("rejeita agendamento em empresa suspensa", async () => {
    const db = new FakeFirestore();
    seedTenant(db, { status: "suspended" });
    await expect(createBooking(db)).rejects.toThrow("suspensa");
  });

  it("rejeita horário no passado (lead time)", async () => {
    const db = new FakeFirestore();
    seedTenant(db);
    await expect(createBooking(db, { date: "2000-01-10", time: "10:00" })).rejects.toThrow(
      BookingError
    );
  });

  it("rejeita horário fora do expediente", async () => {
    const db = new FakeFirestore();
    seedTenant(db);
    await expect(createBooking(db, { time: "20:00" })).rejects.toThrow("fora do expediente");
  });

  it("rejeita profissional que não realiza o serviço", async () => {
    const db = new FakeFirestore();
    seedTenant(db);
    db.store.set(`tenants/t1/services/svc1`, {
      ...db.store.get(`tenants/t1/services/svc1`)!,
      professionals: ["outro-prof"],
    });
    await expect(createBooking(db)).rejects.toThrow("não realiza este serviço");
  });
});

describe("prevenção de double booking", () => {
  it("recusa o segundo cliente no MESMO horário (ID determinístico)", async () => {
    const db = new FakeFirestore();
    seedTenant(db);
    await createBooking(db);
    await expect(createBooking(db)).rejects.toThrow("acabou de ser reservado");
  });

  it("recusa horário que sobrepõe agendamento existente", async () => {
    const db = new FakeFirestore();
    seedTenant(db);
    await createBooking(db, { time: "10:00" });
    await expect(createBooking(db, { time: "10:15" })).rejects.toThrow("já existe um agendamento");
  });

  it("permite horário adjacente sem sobreposição", async () => {
    const db = new FakeFirestore();
    seedTenant(db);
    await createBooking(db, { time: "10:00" });
    const result = await createBooking(db, { time: "10:30" });
    expect(result.appointmentId).toBeTruthy();
  });
});

describe("cupons no fluxo de agendamento", () => {
  it("aplica cupom percentual e incrementa o uso", async () => {
    const db = new FakeFirestore();
    seedTenant(db, { withCoupon: true });
    const result = await createBooking(db, { couponCode: "promo10" });

    expect(result.couponApplied).toBe(true);
    expect(result.price).toBe(90);
    expect(db.store.get("tenants/t1/coupons/c1")!.usedCount).toBe(1);
  });

  it("rejeita cupom inexistente", async () => {
    const db = new FakeFirestore();
    seedTenant(db, { withCoupon: false });
    await expect(createBooking(db, { couponCode: "NAOEXISTE" })).rejects.toThrow(
      "Cupom não encontrado"
    );
  });

  it("rejeita cupom com valor mínimo não atingido", async () => {
    const db = new FakeFirestore();
    seedTenant(db, { withCoupon: true, servicePrice: 50 });
    db.store.set("tenants/t1/coupons/c1", {
      ...db.store.get("tenants/t1/coupons/c1")!,
      minValue: 80,
    });
    await expect(createBooking(db, { couponCode: "PROMO10" })).rejects.toThrow("Valor mínimo");
  });

  it("rejeita cupom expirado", async () => {
    const db = new FakeFirestore();
    seedTenant(db, { withCoupon: true });
    db.store.set("tenants/t1/coupons/c1", {
      ...db.store.get("tenants/t1/coupons/c1")!,
      validUntil: "2020-01-01",
    });
    await expect(createBooking(db, { couponCode: "PROMO10" })).rejects.toThrow("expirou");
  });

  it("esgota cupom com limite de uso", async () => {
    const db = new FakeFirestore();
    seedTenant(db, { withCoupon: true });
    db.store.set("tenants/t1/coupons/c1", {
      ...db.store.get("tenants/t1/coupons/c1")!,
      usageLimit: 1,
    });
    await createBooking(db, { couponCode: "PROMO10", time: "10:00" });
    await expect(createBooking(db, { couponCode: "PROMO10", time: "11:00" })).rejects.toThrow(
      "esgotou"
    );
  });
});

describe("planos e limites", () => {
  it("não bloqueia agendamento mesmo com muitos agendamentos no mês (plano único sem limites)", async () => {
    const db = new FakeFirestore();
    seedTenant(db, { planId: "ALL", appointmentsInMonth: 5000 });
    const result = await createBooking(db);
    expect(result.appointmentId).toBeTruthy();
  });

  it("permite agendamento normalmente no plano único", async () => {
    const db = new FakeFirestore();
    seedTenant(db, { planId: "ALL", appointmentsInMonth: 499 });
    const result = await createBooking(db);
    expect(result.appointmentId).toBeTruthy();
  });

  it("mantém a arquitetura de limites preparada, mas não aplicada (ilimitado)", async () => {
    const plan = getPlan("ALL");
    expect(plan.limits.maxAppointmentsPerMonth).toBe(-1);
    expect(plan.limits.maxProfessionals).toBe(-1);
    expect(plan.limits.maxCustomers).toBe(-1);
  });
});

describe("cancelamento", () => {
  it("cancela um agendamento futuro", async () => {
    const db = new FakeFirestore();
    seedTenant(db);
    const { appointmentId } = await createBooking(db);

    const result = await cancelPublicAppointment(db as never, {
      tenantSlug: "tena",
      appointmentId,
      reason: "Cliente desistiu",
    });
    expect(result.ok).toBe(true);

    const appt = db.store.get(`tenants/t1/appointments/${appointmentId}`);
    expect(appt!.status).toBe("cancelled");
    expect(appt!.cancellationReason).toBe("Cliente desistiu");
  });

  it("rejeita cancelamento duplicado", async () => {
    const db = new FakeFirestore();
    seedTenant(db);
    const { appointmentId } = await createBooking(db);
    await cancelPublicAppointment(db as never, { tenantSlug: "tena", appointmentId });
    await expect(
      cancelPublicAppointment(db as never, { tenantSlug: "tena", appointmentId })
    ).rejects.toThrow("já foi cancelado");
  });

  it("rejeita cancelamento de agendamento já concluído", async () => {
    const db = new FakeFirestore();
    seedTenant(db);
    const { appointmentId } = await createBooking(db);
    db.store.set(`tenants/t1/appointments/${appointmentId}`, {
      ...db.store.get(`tenants/t1/appointments/${appointmentId}`)!,
      status: "completed",
    });
    await expect(
      cancelPublicAppointment(db as never, { tenantSlug: "tena", appointmentId })
    ).rejects.toThrow("não pode mais ser cancelado");
  });

  it("rejeita cancelamento fora da janela (menos de X min de antecedência)", async () => {
    const db = new FakeFirestore();
    seedTenant(db, { cancelWindow: 60 });
    const { appointmentId } = await createBooking(db);
    db.store.set(`tenants/t1/appointments/${appointmentId}`, {
      ...db.store.get(`tenants/t1/appointments/${appointmentId}`)!,
      startAt: new Date(Date.now() + 10 * 60000),
      endAt: new Date(Date.now() + 40 * 60000),
    });
    await expect(
      cancelPublicAppointment(db as never, { tenantSlug: "tena", appointmentId })
    ).rejects.toThrow("antecedência");
  });
});

describe("isolamento multi-tenant (Tenant A -> Tenant B)", () => {
  it("não enxerga nem cancela agendamento do Tenant A usando o slug do Tenant B", async () => {
    const db = new FakeFirestore();
    seedTenant(db, { tenantId: "tA", slug: "tena" });
    seedTenant(db, { tenantId: "tB", slug: "tenb" });

    const { appointmentId } = await createBooking(db);

    const a = db.store.get(`tenants/tA/appointments/${appointmentId}`);
    expect(a).toBeTruthy();

    await expect(
      cancelPublicAppointment(db as never, {
        tenantSlug: "tenb",
        appointmentId,
        reason: "tentativa cross-tenant",
      })
    ).rejects.toThrow("não encontrado");

    expect(db.store.get(`tenants/tA/appointments/${appointmentId}`)!.status).not.toBe("cancelled");
  });

  it("mantém agendamentos de tenants distintos isolados no mesmo horário", async () => {
    const db = new FakeFirestore();
    seedTenant(db, { tenantId: "tA", slug: "tena" });
    seedTenant(db, { tenantId: "tB", slug: "tenb", servicePrice: 200 });

    const a = await createPublicAppointment(db as never, {
      tenantSlug: "tena",
      serviceId: "svc1",
      professionalId: "pro1",
      date: MONDAY,
      time: "10:00",
      customer,
    } as never);

    const b = await createPublicAppointment(db as never, {
      tenantSlug: "tenb",
      serviceId: "svc1",
      professionalId: "pro1",
      date: MONDAY,
      time: "10:00",
      customer: { name: "Maria", phone: "11988888888" },
    } as never);

    // O ID determinístico é o mesmo por design (profissional + instante), mas cada
    // documento vive na subcoleção do próprio tenant. O agendamento no Tenant B
    // não conflita com o do Tenant A (sobreposição é checada dentro do tenant) e
    // os dados ficam independentes — a prova de isolamento.
    expect(a.appointmentId).toBe(b.appointmentId);
    expect(db.store.get(`tenants/tA/appointments/${a.appointmentId}`)!.price).toBe(100);
    expect(db.store.get(`tenants/tB/appointments/${b.appointmentId}`)!.price).toBe(200);
    expect(db.store.get(`tenants/tA/appointments/${a.appointmentId}`)!.customerId).not.toBe(
      db.store.get(`tenants/tB/appointments/${b.appointmentId}`)!.customerId
    );
  });
});

describe("remarcação", () => {
  it("remarca um agendamento futuro para outro horário", async () => {
    const db = new FakeFirestore();
    seedTenant(db);
    const { appointmentId } = await createBooking(db, { time: "10:00" });

    const result = await reschedulePublicAppointment(db as never, {
      tenantSlug: "tena",
      appointmentId,
      date: MONDAY,
      time: "14:00",
    });
    expect(result.ok).toBe(true);
    expect(result.appointmentId).not.toBe(appointmentId);

    const old = db.store.get(`tenants/t1/appointments/${appointmentId}`);
    expect(old!.status).toBe("cancelled");
    expect(old!.cancellationReason).toBe("remarcado");
    expect(old!.rescheduledTo).toBe(result.appointmentId);

    const next = db.store.get(`tenants/t1/appointments/${result.appointmentId}`);
    expect(next).toBeTruthy();
    expect(next!.status).toBe("confirmed");
    expect(next!.customerId).toBe(old!.customerId);
  });

  it("rejeita remarcação para horário já ocupado", async () => {
    const db = new FakeFirestore();
    seedTenant(db);
    const first = await createBooking(db, { time: "10:00" });
    await createBooking(db, { time: "14:00" });
    await expect(
      reschedulePublicAppointment(db as never, {
        tenantSlug: "tena",
        appointmentId: first.appointmentId,
        date: MONDAY,
        time: "14:00",
      })
    ).rejects.toThrow("indisponível");
  });

  it("rejeita remarcação de agendamento já cancelado", async () => {
    const db = new FakeFirestore();
    seedTenant(db);
    const { appointmentId } = await createBooking(db);
    await cancelPublicAppointment(db as never, { tenantSlug: "tena", appointmentId });
    await expect(
      reschedulePublicAppointment(db as never, {
        tenantSlug: "tena",
        appointmentId,
        date: MONDAY,
        time: "15:00",
      })
    ).rejects.toThrow("já foi cancelado");
  });

  it("não remarca agendamento do Tenant A usando o slug do Tenant B", async () => {
    const db = new FakeFirestore();
    seedTenant(db, { tenantId: "tA", slug: "tena" });
    seedTenant(db, { tenantId: "tB", slug: "tenb" });
    const { appointmentId } = await createBooking(db);
    await expect(
      reschedulePublicAppointment(db as never, {
        tenantSlug: "tenb",
        appointmentId,
        date: MONDAY,
        time: "15:00",
      })
    ).rejects.toThrow("não encontrado");
    expect(db.store.get(`tenants/tA/appointments/${appointmentId}`)!.status).not.toBe("cancelled");
  });
});

describe("listPublicSlots", () => {
  it("lista horários dentro do expediente para a data informada", async () => {
    const db = new FakeFirestore();
    seedTenant(db);
    const result = await listPublicSlots(db as never, {
      tenantSlug: "tena",
      serviceId: "svc1",
      professionalId: "pro1",
      date: MONDAY,
    });

    expect(result.timezone).toBe("America/Sao_Paulo");
    expect(result.slots).toContain("10:00");
    expect(result.slots).not.toContain("20:00");
  });

  it("retorna lista vazia em feriado do tenant", async () => {
    const db = new FakeFirestore();
    seedTenant(db);
    db.store.set("tenants/t1/holidays/h1", { id: "h1", tenantId: "t1", date: MONDAY, name: "Feriado" });
    const result = await listPublicSlots(db as never, {
      tenantSlug: "tena",
      serviceId: "svc1",
      professionalId: "pro1",
      date: MONDAY,
    });
    expect(result.slots).toEqual([]);
  });

  it("retorna lista vazia em folga do profissional", async () => {
    const db = new FakeFirestore();
    seedTenant(db);
    db.store.set("tenants/t1/availability/av1", {
      ...db.store.get("tenants/t1/availability/av1")!,
      daysOff: [MONDAY],
    });
    const result = await listPublicSlots(db as never, {
      tenantSlug: "tena",
      serviceId: "svc1",
      professionalId: "pro1",
      date: MONDAY,
    });
    expect(result.slots).toEqual([]);
  });

  it("exclui horários que sobrepõem um agendamento existente", async () => {
    const db = new FakeFirestore();
    seedTenant(db);
    await createBooking(db, { time: "10:00" });
    const result = await listPublicSlots(db as never, {
      tenantSlug: "tena",
      serviceId: "svc1",
      professionalId: "pro1",
      date: MONDAY,
    });
    expect(result.slots).not.toContain("10:00");
    expect(result.slots).toContain("10:30");
  });

  it("aplica exceção de expediente (horário especial)", async () => {
    const db = new FakeFirestore();
    seedTenant(db);
    db.store.set("tenants/t1/availability/av1", {
      ...db.store.get("tenants/t1/availability/av1")!,
      exceptions: [
        { id: "exc1", tenantId: "t1", date: MONDAY, startTime: "13:00", endTime: "17:00", reason: "Atendimento especial" },
      ],
    });
    const result = await listPublicSlots(db as never, {
      tenantSlug: "tena",
      serviceId: "svc1",
      professionalId: "pro1",
      date: MONDAY,
    });
    expect(result.slots).not.toContain("09:00");
    expect(result.slots).toContain("13:00");
    expect(result.slots).not.toContain("18:00");
  });
});
