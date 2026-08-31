import { describe, expect, it } from "vitest";
import {
  anonymizeCustomer,
  buildConsentRecord,
  buildCustomerExport,
  buildUserExport,
  hasConsent,
  retentionSafeCustomer,
} from "./lgpd";
import type { Customer, LgpdConsent } from "@/types";

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  const now = new Date();
  return {
    id: "c1",
    tenantId: "tenant-a",
    name: "Maria Silva",
    email: "maria@test.com",
    phone: "(11) 99999-9999",
    whatsapp: "(11) 99999-9999",
    birthDate: "1990-01-10",
    notes: "Preferência: manhã",
    tags: ["vip"],
    totalSpent: 250,
    visitCount: 4,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("lgpd (Fase 3.19)", () => {
  it("constrói registro de consentimento", () => {
    const consent = buildConsentRecord(
      { tenantId: "t1", subject: "customer", subjectId: "c1", consentType: "marketing", granted: true },
      new Date("2026-01-01T00:00:00Z")
    );
    expect(consent).toMatchObject({
      consentType: "marketing",
      granted: true,
      grantedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
    });
  });

  it("verifica consentimento vigente", () => {
    const consents = [
      buildConsentRecord({ tenantId: "t1", subject: "customer", subjectId: "c1", consentType: "marketing", granted: true }),
      buildConsentRecord({ tenantId: "t1", subject: "customer", subjectId: "c1", consentType: "data_processing", granted: false }),
    ] as LgpdConsent[];
    expect(hasConsent(consents, "marketing")).toBe(true);
    expect(hasConsent(consents, "data_processing")).toBe(false);
    expect(hasConsent(consents, "policy")).toBe(false);
  });

  it("anonimiza dados pessoais mantendo dados de negócio", () => {
    const anonymized = anonymizeCustomer(makeCustomer());
    expect(anonymized.name).toBeUndefined();
    expect(anonymized.email).toBeUndefined();
    expect(anonymized.phone).toBeUndefined();
    expect(anonymized.totalSpent).toBe(250);
    expect(anonymized.visitCount).toBe(4);
  });

  it("constrói exportações", () => {
    const customer = makeCustomer();
    const exportData = buildCustomerExport(customer, { appointments: 3 });
    expect(exportData.data.name).toBe("Maria Silva");
    expect(exportData.appointments).toBe(3);
    expect(exportData.exportedAt).toBeDefined();

    const userExport = buildUserExport({ uid: "u1", email: "a@b.com", displayName: "Ana", createdAt: new Date() });
    expect(userExport.data.email).toBe("a@b.com");
  });

  it("gera registro seguro para retenção", () => {
    const safe = retentionSafeCustomer(makeCustomer());
    expect(safe.name).toBe("Titular anonimizado");
    expect(safe.email).toBeUndefined();
    expect(safe.totalSpent).toBe(250);
  });
});
