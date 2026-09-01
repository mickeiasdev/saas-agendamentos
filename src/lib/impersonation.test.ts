import { describe, expect, it } from "vitest";
import {
  IMPERSONATION_MAX_MINUTES,
  buildImpersonationSession,
  endImpersonationSession,
  impersonationDurationMinutes,
  isImpersonationActive,
  isReasonValid,
} from "./impersonation";
import type { ImpersonationSession } from "@/types";

describe("impersonation (Fase 3.16)", () => {
  const now = new Date("2026-01-10T12:00:00Z");

  it("valida motivo", () => {
    expect(isReasonValid("Atendendo chamado #123")).toBe(true);
    expect(isReasonValid("ab")).toBe(false);
  });

  it("constrói sessão de impersonação", () => {
    const session = buildImpersonationSession(
      { adminUid: "admin-1", adminEmail: "suporte@plataforma.com", tenantId: "tenant-a", reason: "Atendendo chamado #123" },
      now
    );
    expect(session).toMatchObject({
      adminUid: "admin-1",
      tenantId: "tenant-a",
      status: "active",
      startedAt: now,
      endedAt: null,
    });
  });

  it("exige motivo válido", () => {
    expect(() =>
      buildImpersonationSession({ adminUid: "a", tenantId: "t", reason: "x" }, now)
    ).toThrow();
  });

  it("verifica se a sessão está ativa", () => {
    const active = buildImpersonationSession(
      { adminUid: "a", tenantId: "t", reason: "Motivo válido" },
      now
    ) as ImpersonationSession;
    expect(isImpersonationActive(active, now)).toBe(true);

    const expired = { ...active, startedAt: new Date(now.getTime() - (IMPERSONATION_MAX_MINUTES + 5) * 60000) };
    expect(isImpersonationActive(expired, now)).toBe(false);

    const ended = { ...active, endedAt: now };
    expect(isImpersonationActive(ended, now)).toBe(false);
  });

  it("encerra a sessão", () => {
    const ended = endImpersonationSession({ status: "active" }, now);
    expect(ended).toEqual({ status: "ended", endedAt: now });
  });

  it("calcula duração", () => {
    const start = new Date("2026-01-10T12:00:00Z");
    const end = new Date("2026-01-10T12:30:00Z");
    expect(impersonationDurationMinutes({ startedAt: start, endedAt: end })).toBe(30);
    expect(impersonationDurationMinutes({ startedAt: start, endedAt: null }, new Date("2026-01-10T12:15:00Z"))).toBe(15);
  });
});
