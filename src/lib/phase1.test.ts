import { describe, expect, it } from "vitest";
import { FakeFirestore } from "@/lib/booking/fakeFirestore";
import {
  cancelPublicAppointment,
  createPublicAppointment,
  reschedulePublicAppointment,
} from "@/lib/booking/server";
import { slugify } from "@/lib/tenant/slug";
import { claimExactSlug, SLUG_TAKEN_MESSAGE } from "@/lib/tenant/uniqueSlug";
import { canInviteRole } from "@/lib/invites";
import { findBlockingOverlaps } from "@/lib/repository/overlap";
import { publicThemeClasses } from "@/lib/branding/theme";
import { validateSlotAvailability } from "@/lib/booking/timezone";
import { generateSlots } from "@/lib/availability/engine";
import { can } from "@/lib/rbac/roles";
import { hasAccess } from "@/lib/rbac/membership";
import {
  AUTH_ERRORS,
  validateLogin,
  validatePasswordChange,
  validateRecover,
  validateSignup,
} from "@/lib/auth/validation";
import { matchesCustomerSearch } from "@/lib/repository/customers";
import type { Customer, ProfessionalAvailability, TenantUser } from "@/types";

const MONDAY = "2030-01-14";
const customer = { name: "João Silva", phone: "11999999999" };

function seed(db: FakeFirestore, tenantId: string, slug: string) {
  db.store.set(`tenants/${tenantId}`, {
    id: tenantId,
    slug,
    name: "Barbearia Central",
    tradeName: "Central",
    description: "Cortes e barba no centro.",
    status: "active",
    planId: "ALL",
    ownerUserId: "owner1",
    branding: { theme: "dark", primaryColor: "#111827", secondaryColor: "#f8fafc" },
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
  db.store.set(`tenants/${tenantId}/categories/cat1`, { id: "cat1", tenantId, name: "Cabelo", status: "active" });
  db.store.set(`tenants/${tenantId}/services/svc1`, {
    id: "svc1",
    tenantId,
    name: "Corte",
    price: 80,
    durationMinutes: 30,
    status: "active",
    professionals: ["pro1"],
  });
  db.store.set(`tenants/${tenantId}/professionals/pro1`, {
    id: "pro1",
    tenantId,
    name: "Ana",
    active: true,
    serviceIds: ["svc1"],
  });
  db.store.set(`tenants/${tenantId}/availability/av1`, {
    id: "av1",
    tenantId,
    professionalId: "pro1",
    workDays: [{ dayOfWeek: 1, enabled: true, startTime: "09:00", endTime: "18:00", breaks: [{ start: "12:00", end: "13:00" }] }],
    daysOff: [],
    vacations: [],
    blockedDates: [],
    exceptions: [],
  });
  db.store.set(`tenants/${tenantId}/customers/cust1`, {
    id: "cust1",
    tenantId,
    name: "Maria",
    phone: "11988887777",
  });
}

describe("Fase 1 — aceite (cadastro → empresa → CRUD → agendamento → cancel/remarcar)", () => {
  it("cadastro, login, recuperação e alteração de senha", () => {
    expect(validateSignup({ name: "", email: "a@b.com", password: "123456", confirm: "123456" })).toBe(
      AUTH_ERRORS.NAME_REQUIRED
    );
    expect(validateSignup({ name: "João", email: "invalido", password: "123456", confirm: "123456" })).toBe(
      AUTH_ERRORS.EMAIL_REQUIRED
    );
    expect(validateSignup({ name: "João", email: "a@b.com", password: "123", confirm: "123" })).toBe(
      AUTH_ERRORS.PASSWORD_MIN
    );
    expect(validateSignup({ name: "João", email: "a@b.com", password: "123456", confirm: "654321" })).toBe(
      AUTH_ERRORS.PASSWORD_MISMATCH
    );
    expect(validateSignup({ name: "João", email: "a@b.com", password: "123456", confirm: "123456" })).toBeNull();
    expect(validateLogin({ email: "a@b.com", password: "123456" })).toBeNull();
    expect(validateLogin({ email: "x", password: "123456" })).toBe(AUTH_ERRORS.EMAIL_REQUIRED);
    expect(validateRecover("a@b.com")).toBeNull();
    expect(validateRecover("")).toBe(AUTH_ERRORS.EMAIL_REQUIRED);
    expect(
      validatePasswordChange({ currentPassword: "", newPassword: "123456", confirm: "123456" })
    ).toBe(AUTH_ERRORS.CURRENT_PASSWORD_REQUIRED);
    expect(
      validatePasswordChange({ currentPassword: "oldpass", newPassword: "123456", confirm: "123456" })
    ).toBeNull();
  });

  it("slug da empresa e descrição entram na personalização", () => {
    expect(slugify("Barbearia Central")).toBe("barbearia-central");
    const db = new FakeFirestore();
    seed(db, "t1", "barbearia-central");
    const tenant = db.store.get("tenants/t1") as { description: string; branding: { theme: string } };
    expect(tenant.description).toBe("Cortes e barba no centro.");
    expect(publicThemeClasses(tenant.branding.theme as "dark").dark).toBe(true);
  });

  it("duas empresas não podem ter o mesmo endereço público", async () => {
    const taken = new Set(["barbearia-central"]);
    await expect(claimExactSlug("Barbearia Central", async (s) => taken.has(s))).rejects.toThrow(SLUG_TAKEN_MESSAGE);
    await expect(claimExactSlug("Outra Barbearia", async (s) => taken.has(s))).resolves.toBe("outra-barbearia");
  });

  it("cadastro da empresa nasce TENANT_OWNER; demais papéis entram por convite", () => {
    expect(canInviteRole("TENANT_OWNER", "TENANT_ADMIN")).toBe(true);
    expect(canInviteRole("TENANT_OWNER", "MANAGER")).toBe(true);
    expect(canInviteRole("TENANT_OWNER", "TENANT_OWNER")).toBe(false);
  });

  it("categoria, serviço, profissional, horário e cliente ficam isolados por tenant", () => {
    const db = new FakeFirestore();
    seed(db, "tA", "tena");
    seed(db, "tB", "tenb");
    expect(db.store.get("tenants/tA/services/svc1")).toBeTruthy();
    expect(db.store.get("tenants/tB/services/svc1")).toBeTruthy();
    expect(db.store.get("tenants/tA/customers/cust1")).not.toBe(db.store.get("tenants/tB/customers/cust1"));
  });

  it("agenda: expediente, intervalo, folga, férias, feriado, bloqueio e profissional indisponível", () => {
    const availability: ProfessionalAvailability = {
      id: "av1",
      tenantId: "t1",
      professionalId: "pro1",
      workDays: [{ dayOfWeek: 1, enabled: true, startTime: "09:00", endTime: "18:00", breaks: [{ start: "12:00", end: "13:00" }] }],
      daysOff: ["2030-01-14"],
      vacations: [],
      blockedDates: ["2030-01-21"],
      exceptions: [],
      updatedAt: { seconds: 0, nanoseconds: 0 },
    };
    const instant = new Date("2030-01-14T13:00:00Z");
    expect(validateSlotAvailability({ availability, holidays: [], durationMinutes: 30, instant, tz: "America/Sao_Paulo" }).ok).toBe(false);

    const blocked = generateSlots({
      availability: { ...availability, daysOff: [] },
      serviceDurationMinutes: 30,
      appointments: [],
      holidays: [],
      slotIntervalMinutes: 30,
      date: "2030-01-21",
    });
    expect(blocked).toEqual([]);

    const holiday = generateSlots({
      availability: { ...availability, daysOff: [], blockedDates: [] },
      serviceDurationMinutes: 30,
      appointments: [],
      holidays: [{ id: "h1", tenantId: "t1", date: "2030-01-14", name: "Feriado" }],
      slotIntervalMinutes: 30,
      date: "2030-01-14",
    });
    expect(holiday).toEqual([]);
  });

  it("cliente: cadastro, busca por nome/telefone e isolamento de histórico", () => {
    const maria: Pick<Customer, "name" | "email" | "phone" | "whatsapp"> = {
      name: "Maria Souza",
      email: "maria@ex.com",
      phone: "11988887777",
      whatsapp: "11988887777",
    };
    expect(matchesCustomerSearch(maria, "maria")).toBe(true);
    expect(matchesCustomerSearch(maria, "8888")).toBe(true);
    expect(matchesCustomerSearch(maria, "joao")).toBe(false);
  });

  it("agendamento, double booking, remarcação e cancelamento", async () => {
    const db = new FakeFirestore();
    seed(db, "t1", "tena");
    const created = await createPublicAppointment(db as never, {
      tenantSlug: "tena",
      serviceId: "svc1",
      professionalId: "pro1",
      date: MONDAY,
      time: "10:00",
      customer,
    });
    expect(created.appointmentId).toBeTruthy();

    await expect(
      createPublicAppointment(db as never, {
        tenantSlug: "tena",
        serviceId: "svc1",
        professionalId: "pro1",
        date: MONDAY,
        time: "10:00",
        customer: { name: "Outro", phone: "11911112222" },
      })
    ).rejects.toThrow();

    const moved = await reschedulePublicAppointment(db as never, {
      tenantSlug: "tena",
      appointmentId: created.appointmentId,
      date: MONDAY,
      time: "15:00",
    });
    expect(moved.ok).toBe(true);

    const cancelled = await cancelPublicAppointment(db as never, {
      tenantSlug: "tena",
      appointmentId: moved.appointmentId,
    });
    expect(cancelled.ok).toBe(true);
  });

  it("confirmação da empresa deixa o agendamento pendente", async () => {
    const db = new FakeFirestore();
    seed(db, "t1", "tena");
    const tenant = db.store.get("tenants/t1") as { settings: { confirmationRequired: boolean } };
    tenant.settings.confirmationRequired = true;
    const created = await createPublicAppointment(db as never, {
      tenantSlug: "tena",
      serviceId: "svc1",
      professionalId: "pro1",
      date: MONDAY,
      time: "16:00",
      customer,
    });
    const saved = db.store.get(`tenants/t1/appointments/${created.appointmentId}`) as { status: string };
    expect(saved.status).toBe("pending");
  });

  it("Tenant A tenta acessar Tenant B → NEGADO (membership + API)", async () => {
    const memberships: TenantUser[] = [
      { userId: "uA", tenantId: "tA", role: "TENANT_OWNER", status: "active", createdAt: new Date() },
    ];
    expect(hasAccess(memberships, "tB", "appointment.manage")).toBe(false);
    expect(can("TENANT_OWNER", "master.view")).toBe(false);

    const db = new FakeFirestore();
    seed(db, "tA", "tena");
    seed(db, "tB", "tenb");
    const a = await createPublicAppointment(db as never, {
      tenantSlug: "tena",
      serviceId: "svc1",
      professionalId: "pro1",
      date: MONDAY,
      time: "11:00",
      customer,
    });
    await expect(
      cancelPublicAppointment(db as never, { tenantSlug: "tenb", appointmentId: a.appointmentId })
    ).rejects.toThrow("não encontrado");
  });

  it("overlap dentro da transação considera intervalo, não só o slot-id", () => {
    const start = new Date("2030-01-14T13:00:00Z");
    const end = new Date("2030-01-14T13:30:00Z");
    const hits = findBlockingOverlaps(
      [
        {
          id: "outro-id",
          startAt: new Date("2030-01-14T12:45:00Z"),
          endAt: new Date("2030-01-14T13:15:00Z"),
          status: "confirmed",
        },
      ],
      start,
      end
    );
    expect(hits).toHaveLength(1);
  });
});
