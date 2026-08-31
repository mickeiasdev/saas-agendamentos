import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, buildAuditEntry, describeAuditAction, sanitizeAuditMetadata } from "./audit";

describe("audit (Fase 3.17)", () => {
  it("constrói entrada de auditoria", () => {
    const entry = buildAuditEntry({
      tenantId: "tenant-a",
      userId: "user-1",
      action: AUDIT_ACTIONS.APPOINTMENT_CREATE,
      entityType: "appointment",
      entityId: "appt-1",
      metadata: { status: "confirmed" },
    });
    expect(entry).toMatchObject({
      tenantId: "tenant-a",
      userId: "user-1",
      action: "appointment.create",
      entityType: "appointment",
      entityId: "appt-1",
    });
    expect(entry.createdAt).toBeInstanceOf(Date);
  });

  it("exige ação", () => {
    expect(() =>
      buildAuditEntry({ userId: "u", action: "   " })
    ).toThrow();
  });

  it("sanitiza campos sensíveis do metadata", () => {
    const sanitized = sanitizeAuditMetadata({
      ok: true,
      password: "x",
      apiKey: "as_123",
      authorization: "Bearer x",
    });
    expect(sanitized).toEqual({ ok: true });
    expect(sanitizeAuditMetadata({ password: "x" })).toBeUndefined();
    expect(sanitizeAuditMetadata(undefined)).toBeUndefined();
  });

  it("descreve ações", () => {
    expect(describeAuditAction(AUDIT_ACTIONS.LOGIN)).toBe("Login realizado");
    expect(describeAuditAction("desconhecida")).toBe("desconhecida");
  });
});
