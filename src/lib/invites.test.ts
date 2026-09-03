import { describe, expect, it } from "vitest";
import {
  INVITE_ALREADY_MEMBER,
  INVITE_EMAIL_MISMATCH,
  INVITE_EXPIRED,
  INVITE_PENDING_EXISTS,
  INVITE_ROLE_DENIED,
  INVITE_SELF,
  assertCanCreateInvite,
  assertInviteAcceptable,
  canInviteRole,
  inviteExpiresAt,
  isInviteExpired,
  normalizeInviteEmail,
} from "./invites";

describe("convite de papéis", () => {
  it("TENANT_OWNER convida ADMIN/MANAGER/PROFESSIONAL/CUSTOMER, não outro OWNER", () => {
    expect(canInviteRole("TENANT_OWNER", "TENANT_ADMIN")).toBe(true);
    expect(canInviteRole("TENANT_OWNER", "MANAGER")).toBe(true);
    expect(canInviteRole("TENANT_OWNER", "PROFESSIONAL")).toBe(true);
    expect(canInviteRole("TENANT_OWNER", "CUSTOMER")).toBe(true);
    expect(canInviteRole("TENANT_OWNER", "TENANT_OWNER")).toBe(false);
    expect(canInviteRole("TENANT_OWNER", "PLATFORM_ADMIN")).toBe(false);
  });

  it("TENANT_ADMIN convida abaixo, não OWNER nem outro ADMIN", () => {
    expect(canInviteRole("TENANT_ADMIN", "MANAGER")).toBe(true);
    expect(canInviteRole("TENANT_ADMIN", "TENANT_ADMIN")).toBe(false);
    expect(canInviteRole("TENANT_ADMIN", "TENANT_OWNER")).toBe(false);
  });

  it("MANAGER não convida ninguém", () => {
    expect(canInviteRole("MANAGER", "PROFESSIONAL")).toBe(false);
    expect(canInviteRole("PROFESSIONAL", "CUSTOMER")).toBe(false);
  });

  it("rejeita convite para e-mail já membro ou com convite pendente", () => {
    expect(() =>
      assertCanCreateInvite({
        actorRole: "TENANT_OWNER",
        actorEmail: "dono@a.com",
        targetEmail: "ana@a.com",
        targetRole: "MANAGER",
        members: [{ email: "ana@a.com", userId: "u2", status: "active" }],
        pendingEmails: [],
      })
    ).toThrow(INVITE_ALREADY_MEMBER);

    expect(() =>
      assertCanCreateInvite({
        actorRole: "TENANT_OWNER",
        actorEmail: "dono@a.com",
        targetEmail: "ana@a.com",
        targetRole: "MANAGER",
        members: [],
        pendingEmails: ["Ana@a.com"],
      })
    ).toThrow(INVITE_PENDING_EXISTS);
  });

  it("rejeita auto-convite e papel acima do permitido", () => {
    expect(() =>
      assertCanCreateInvite({
        actorRole: "TENANT_OWNER",
        actorEmail: "dono@a.com",
        targetEmail: "DONO@a.com",
        targetRole: "MANAGER",
        members: [],
        pendingEmails: [],
      })
    ).toThrow(INVITE_SELF);

    expect(() =>
      assertCanCreateInvite({
        actorRole: "TENANT_ADMIN",
        actorEmail: "admin@a.com",
        targetEmail: "x@a.com",
        targetRole: "TENANT_ADMIN",
        members: [],
        pendingEmails: [],
      })
    ).toThrow(INVITE_ROLE_DENIED);
  });

  it("aceite só com o e-mail convidado, convite pendente e não expirado", () => {
    const invite = {
      tenantId: "tA",
      email: "ana@a.com",
      status: "pending" as const,
      expiresAt: inviteExpiresAt(Date.now()),
      role: "MANAGER" as const,
    };
    expect(
      assertInviteAcceptable({
        invite,
        actorEmail: "ANA@a.com",
        memberships: [],
      }).role
    ).toBe("MANAGER");

    expect(() =>
      assertInviteAcceptable({
        invite,
        actorEmail: "outro@a.com",
        memberships: [],
      })
    ).toThrow(INVITE_EMAIL_MISMATCH);

    expect(() =>
      assertInviteAcceptable({
        invite: { ...invite, expiresAt: new Date(Date.now() - 1000) },
        actorEmail: "ana@a.com",
        memberships: [],
      })
    ).toThrow(INVITE_EXPIRED);
  });

  it("normaliza e-mail e detecta expiração", () => {
    expect(normalizeInviteEmail("  Ana@A.COM ")).toBe("ana@a.com");
    expect(isInviteExpired({ status: "pending", expiresAt: new Date(Date.now() + 60_000) })).toBe(false);
    expect(isInviteExpired({ status: "pending", expiresAt: new Date(Date.now() - 1) })).toBe(true);
  });
});
