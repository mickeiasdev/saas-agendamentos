import { describe, expect, it } from "vitest";
import { configuredOwnerEmail, resolveBootstrapRole } from "./platform";

describe("bootstrap PLATFORM_OWNER", () => {
  it("promove o primeiro usuário quando não há dono", () => {
    expect(
      resolveBootstrapRole({
        email: "dono@plataforma.com",
        ownerAlreadyExists: false,
      })
    ).toBe("PLATFORM_OWNER");
  });

  it("não promove quando já existe um dono", () => {
    expect(
      resolveBootstrapRole({
        email: "outro@plataforma.com",
        ownerAlreadyExists: true,
      })
    ).toBe("USER");
  });

  it("só promove o e-mail configurado em PLATFORM_OWNER_EMAIL", () => {
    expect(
      resolveBootstrapRole({
        email: "dono@plataforma.com",
        ownerAlreadyExists: false,
        configuredOwnerEmail: "dono@plataforma.com",
      })
    ).toBe("PLATFORM_OWNER");
    expect(
      resolveBootstrapRole({
        email: "outro@plataforma.com",
        ownerAlreadyExists: false,
        configuredOwnerEmail: "dono@plataforma.com",
      })
    ).toBe("USER");
  });

  it("lê PLATFORM_OWNER_EMAIL normalizado", () => {
    expect(configuredOwnerEmail({ PLATFORM_OWNER_EMAIL: "  Dono@Plataforma.com " })).toBe(
      "dono@plataforma.com"
    );
  });
});
