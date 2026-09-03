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
    expect(rules).toMatch(/getTenantRole\(tenantId\)\.status == 'active'/);
  });

  it("só o TENANT_OWNER nasce no cliente; convites ficam no Admin SDK", () => {
    expect(rules).toContain("request.resource.data.role in ['TENANT_OWNER']");
    expect(rules).toContain("match /invites/{token}");
    expect(rules).toMatch(/match \/invites\/\{token\}[\s\S]*allow read, write: if false/);
  });

  it("trava slugs/{slug} como create-only (endereço público único)", () => {
    expect(rules).toContain("match /slugs/{slug}");
    expect(rules).toMatch(/allow list: if false/);
    expect(rules).toContain("allow update, delete: if false");
  });

  it("impede delete de agendamentos e create público direto no Firestore", () => {
    expect(rules).toMatch(/allow delete: if false/);
    expect(rules).toContain("allow create: if isMember() && hasRole(['TENANT_OWNER', 'TENANT_ADMIN', 'MANAGER', 'PROFESSIONAL'])");
  });

  it("trava platformRole no perfil (cliente não se promove)", () => {
    expect(rules).toContain("request.resource.data.platformRole == 'USER'");
    expect(rules).toContain("request.resource.data.platformRole == resource.data.platformRole");
    expect(rules).toContain("match /platform/{docId}");
  });

  it("só TENANT_OWNER/TENANT_ADMIN atualizam o tenant e não alteram status/planId", () => {
    expect(rules).toContain("hasRole(['TENANT_OWNER', 'TENANT_ADMIN'])");
    expect(rules).toContain("request.resource.data.status == resource.data.status");
    expect(rules).toContain("request.resource.data.planId == resource.data.planId");
  });
});
