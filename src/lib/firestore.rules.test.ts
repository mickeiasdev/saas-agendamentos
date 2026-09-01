import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const rules = readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8");

describe("Firestore Rules — isolamento Tenant A -> Tenant B", () => {
  it("exige autenticação para ler o documento do tenant", () => {
    expect(rules).toMatch(/match \/tenants\/\{tenantId\}/);
    expect(rules).toMatch(/isTenantMember\(tenantId\)/);
  });

  it("amarra subcoleções ao membro do tenant (não há leitura pública no Firestore)", () => {
    for (const col of ["categories", "services", "professionals", "availability", "customers", "appointments"]) {
      expect(rules).toContain(`match /${col}/{docId}`);
    }
    expect(rules).toMatch(/allow read: if isMember\(\)/);
  });

  it("associa o papel via tenant_users/{uid_tenantId} (A não acessa B)", () => {
    expect(rules).toContain("request.auth.uid + '_' + tenantId");
    expect(rules).toMatch(/role.status == 'active'/);
  });

  it("impede delete de agendamentos e create público direto no Firestore", () => {
    expect(rules).toMatch(/allow delete: if false/);
    expect(rules).toContain("allow create: if isMember() && hasRole(['TENANT_OWNER', 'TENANT_ADMIN', 'MANAGER', 'PROFESSIONAL'])");
  });
});
