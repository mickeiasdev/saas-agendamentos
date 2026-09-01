import { describe, expect, it } from "vitest";
import {
  isReservedSlug,
  resolveTenantSlugFromHost,
  rewritePathForTenantSlug,
  slugify,
} from "./slug";

describe("slugify", () => {
  it("gera slug a partir do nome da empresa", () => {
    expect(slugify("Barbearia São João")).toBe("barbearia-sao-joao");
  });
});

describe("resolveTenantSlugFromHost", () => {
  const domain = "minhaplataforma.com";

  it("extrai o slug de tenant.minhaplataforma.com", () => {
    expect(resolveTenantSlugFromHost("barbearia.minhaplataforma.com", domain)).toBe("barbearia");
  });

  it("ignora o domínio raiz e www", () => {
    expect(resolveTenantSlugFromHost("minhaplataforma.com", domain)).toBeNull();
    expect(resolveTenantSlugFromHost("www.minhaplataforma.com", domain)).toBeNull();
  });

  it("ignora subdomínios reservados", () => {
    expect(resolveTenantSlugFromHost("app.minhaplataforma.com", domain)).toBeNull();
    expect(resolveTenantSlugFromHost("api.minhaplataforma.com", domain)).toBeNull();
  });

  it("aceita host com porta", () => {
    expect(resolveTenantSlugFromHost("barbearia.minhaplataforma.com:443", domain)).toBe("barbearia");
  });
});

describe("rewritePathForTenantSlug", () => {
  it("reescreve / para /{slug}", () => {
    expect(rewritePathForTenantSlug("/", "barbearia")).toBe("/barbearia");
  });

  it("reescreve /agendar para /{slug}/agendar", () => {
    expect(rewritePathForTenantSlug("/agendar", "barbearia")).toBe("/barbearia/agendar");
  });

  it("não reescreve APIs, painel e auth", () => {
    expect(rewritePathForTenantSlug("/api/public/cancel", "barbearia")).toBeNull();
    expect(rewritePathForTenantSlug("/app/agenda", "barbearia")).toBeNull();
    expect(rewritePathForTenantSlug("/login", "barbearia")).toBeNull();
  });

  it("não duplica o slug quando o caminho já é /{slug}", () => {
    expect(rewritePathForTenantSlug("/barbearia", "barbearia")).toBeNull();
    expect(rewritePathForTenantSlug("/barbearia/agendar", "barbearia")).toBeNull();
  });
});

describe("isReservedSlug", () => {
  it("bloqueia slugs de plataforma", () => {
    expect(isReservedSlug("www")).toBe(true);
    expect(isReservedSlug("login")).toBe(true);
    expect(isReservedSlug("barbearia")).toBe(false);
  });
});
