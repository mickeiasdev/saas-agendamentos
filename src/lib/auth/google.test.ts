import { describe, expect, it } from "vitest";
import { hasGoogleProvider, hasPasswordProvider, isPopupFallbackError } from "@/lib/auth/google";
import { authErrorCode, mapAuthError } from "@/lib/auth/errors";

describe("Google login helpers", () => {
  it("detecta provedor Google e senha", () => {
    const googleOnly = { providerData: [{ providerId: "google.com" }] };
    const passwordOnly = { providerData: [{ providerId: "password" }] };
    const both = { providerData: [{ providerId: "google.com" }, { providerId: "password" }] };
    expect(hasGoogleProvider(googleOnly)).toBe(true);
    expect(hasPasswordProvider(googleOnly)).toBe(false);
    expect(hasPasswordProvider(passwordOnly)).toBe(true);
    expect(hasGoogleProvider(passwordOnly)).toBe(false);
    expect(hasGoogleProvider(both)).toBe(true);
    expect(hasPasswordProvider(both)).toBe(true);
    expect(hasGoogleProvider(null)).toBe(false);
    expect(hasPasswordProvider(undefined)).toBe(false);
  });

  it("trata popup bloqueado como fallback para redirect", () => {
    expect(isPopupFallbackError("auth/popup-blocked")).toBe(true);
    expect(isPopupFallbackError("auth/cancelled-popup-request")).toBe(true);
    expect(isPopupFallbackError("auth/popup-closed-by-user")).toBe(false);
  });

  it("traduz erros do Firebase Auth, inclusive Google", () => {
    expect(authErrorCode({ code: "auth/popup-closed-by-user" })).toBe("auth/popup-closed-by-user");
    expect(mapAuthError({ code: "auth/popup-closed-by-user" })).toBe("Login com Google cancelado.");
    expect(mapAuthError({ code: "auth/operation-not-allowed" })).toBe(
      "Login com Google não está habilitado neste projeto Firebase."
    );
    expect(mapAuthError({ code: "auth/unauthorized-domain" })).toBe(
      "Este domínio não está autorizado no Firebase Authentication."
    );
    expect(mapAuthError({ code: "auth/invalid-credential" })).toBe("E-mail ou senha inválidos.");
  });
});
