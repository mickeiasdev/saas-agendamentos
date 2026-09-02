import { describe, expect, it } from "vitest";
import {
  allocateUniqueSlug,
  firstSlugAttempt,
  slugCandidate,
  validateTenantSlug,
} from "./uniqueSlug";

describe("validateTenantSlug", () => {
  it("normaliza o nome da empresa", () => {
    expect(validateTenantSlug("Barbearia São João")).toBe("barbearia-sao-joao");
  });

  it("rejeita nome sem letras/números", () => {
    expect(() => validateTenantSlug("!!!")).toThrow(/pelo menos 2/);
  });
});

describe("slugCandidate", () => {
  it("usa o base na primeira tentativa e sufixo depois", () => {
    expect(slugCandidate("barbearia", 1)).toBe("barbearia");
    expect(slugCandidate("barbearia", 2)).toBe("barbearia-2");
    expect(slugCandidate("barbearia", 3)).toBe("barbearia-3");
  });
});

describe("allocateUniqueSlug", () => {
  it("devolve o slug livre", async () => {
    const taken = new Set<string>();
    await expect(allocateUniqueSlug("Barbearia Central", (s) => Promise.resolve(taken.has(s)))).resolves.toBe(
      "barbearia-central"
    );
  });

  it("gera sufixo quando o slug já existe", async () => {
    const taken = new Set(["barbearia-central", "barbearia-central-2"]);
    await expect(allocateUniqueSlug("Barbearia Central", (s) => Promise.resolve(taken.has(s)))).resolves.toBe(
      "barbearia-central-3"
    );
  });

  it("pula slugs reservados (app, login, www)", async () => {
    expect(firstSlugAttempt("app")).toBe(2);
    await expect(allocateUniqueSlug("app", async () => false)).resolves.toBe("app-2");
  });
});
