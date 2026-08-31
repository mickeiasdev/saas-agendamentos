import { describe, expect, it } from "vitest";
import {
  buildCustomerPackageItems,
  consumePackageService,
  deriveCustomerPackageStatus,
  isPackageExpired,
  isPackageFullyUsed,
  isPackageItemValid,
  isPackageValid,
} from "./packages";
import type { CustomerPackage, ServicePackage } from "@/types";

function makePackage(overrides: Partial<ServicePackage> = {}): ServicePackage {
  const now = new Date("2026-01-10T12:00:00Z");
  return {
    id: "pkg-1",
    tenantId: "tenant-a",
    name: "Combo Corte",
    items: [{ serviceId: "svc-corte", serviceName: "Corte", quantity: 5 }],
    price: 250,
    validDays: 90,
    active: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeCustomerPackage(overrides: Partial<CustomerPackage> = {}): CustomerPackage {
  const now = new Date("2026-01-10T12:00:00Z");
  return {
    id: "cp-1",
    tenantId: "tenant-a",
    packageId: "pkg-1",
    packageName: "Combo Corte",
    customerId: "cust-1",
    customerName: "Maria",
    items: buildCustomerPackageItems(makePackage()),
    price: 250,
    purchasedAt: now,
    expiresAt: new Date("2026-04-10T12:00:00Z"),
    status: "active",
    createdAt: now,
    ...overrides,
  };
}

describe("packages (Fase 3.8)", () => {
  it("valida pacote e itens", () => {
    expect(isPackageValid(makePackage())).toBe(true);
    expect(isPackageValid({ ...makePackage(), price: -1 })).toBe(false);
    expect(isPackageValid({ ...makePackage(), items: [] })).toBe(false);
    expect(isPackageItemValid({ serviceId: "x", serviceName: "X", quantity: 0 })).toBe(false);
  });

  it("constrói itens de consumo zerados", () => {
    const items = buildCustomerPackageItems(makePackage());
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ serviceId: "svc-corte", total: 5, used: 0 });
  });

  it("detecta expiração e consumo total", () => {
    const now = new Date("2026-05-01T12:00:00Z");
    expect(isPackageExpired(makeCustomerPackage(), now)).toBe(true);
    expect(isPackageExpired(makeCustomerPackage(), new Date("2026-02-01T12:00:00Z"))).toBe(false);
    expect(isPackageExpired(makeCustomerPackage({ expiresAt: null }), now)).toBe(false);

    const used = makeCustomerPackage({ items: [{ serviceId: "svc-corte", serviceName: "Corte", total: 5, used: 5 }] });
    expect(isPackageFullyUsed(used)).toBe(true);
  });

  it("consome uma sessão do pacote", () => {
    const now = new Date("2026-02-01T12:00:00Z");
    const cp = makeCustomerPackage();
    const result = consumePackageService(cp, "svc-corte", now);
    expect(result.ok).toBe(true);
    expect(result.items?.[0].used).toBe(1);
    expect(result.remaining).toBe(4);
  });

  it("bloqueia consumo de serviço fora do pacote", () => {
    const now = new Date("2026-02-01T12:00:00Z");
    const result = consumePackageService(makeCustomerPackage(), "svc-barba", now);
    expect(result.ok).toBe(false);
  });

  it("bloqueia consumo de pacote vencido, esgotado e inativo", () => {
    const expired = makeCustomerPackage({ expiresAt: new Date("2026-01-01T12:00:00Z") });
    expect(consumePackageService(expired, "svc-corte", new Date("2026-02-01T12:00:00Z")).ok).toBe(false);

    const used = makeCustomerPackage({
      items: [{ serviceId: "svc-corte", serviceName: "Corte", total: 5, used: 5 }],
    });
    expect(consumePackageService(used, "svc-corte", new Date("2026-02-01T12:00:00Z")).ok).toBe(false);

    const inactive = makeCustomerPackage({ status: "expired" });
    expect(consumePackageService(inactive, "svc-corte", new Date("2026-02-01T12:00:00Z")).ok).toBe(false);
  });

  it("deriva status a partir de validade e consumo", () => {
    const now = new Date("2026-02-01T12:00:00Z");
    const active = makeCustomerPackage();
    expect(deriveCustomerPackageStatus(active, now)).toBe("active");

    const expired = makeCustomerPackage({ expiresAt: new Date("2026-01-01T12:00:00Z") });
    expect(deriveCustomerPackageStatus(expired, now)).toBe("expired");

    const used = makeCustomerPackage({
      items: [{ serviceId: "svc-corte", serviceName: "Corte", total: 5, used: 5 }],
    });
    expect(deriveCustomerPackageStatus(used, now)).toBe("used");
  });
});
