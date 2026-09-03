import { isTenantInviteRole, roleLevel, type TenantInviteRole } from "@/lib/rbac/roles";
import type { Role, TenantInvite, TenantInviteStatus, TenantUser } from "@/types";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const INVITE_EMAIL_MISMATCH = "Este convite foi enviado para outro e-mail. Entre com a conta convidada.";
export const INVITE_EXPIRED = "Este convite expirou. Peça um novo convite à empresa.";
export const INVITE_NOT_PENDING = "Este convite não está mais pendente.";
export const INVITE_ALREADY_MEMBER = "Este e-mail já faz parte da empresa.";
export const INVITE_PENDING_EXISTS = "Já existe um convite pendente para este e-mail.";
export const INVITE_ROLE_DENIED = "Você não pode convidar este papel.";
export const INVITE_SELF = "Você não pode convidar o próprio e-mail.";

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function canInviteRole(actorRole: Role, targetRole: string): targetRole is TenantInviteRole {
  if (!isTenantInviteRole(targetRole)) return false;
  if (roleLevel(actorRole) < roleLevel("TENANT_ADMIN")) return false;
  return roleLevel(actorRole) > roleLevel(targetRole);
}

export function inviteExpiresAt(from = Date.now(), ttlMs = INVITE_TTL_MS): Date {
  return new Date(from + ttlMs);
}

export function isInviteExpired(
  invite: Pick<TenantInvite, "expiresAt" | "status">,
  now = Date.now()
): boolean {
  const raw = invite.expiresAt as { toMillis?: () => number; toDate?: () => Date } | Date | string | number;
  let ms = 0;
  if (raw instanceof Date) ms = raw.getTime();
  else if (typeof raw === "number") ms = raw;
  else if (typeof raw === "string") ms = new Date(raw).getTime();
  else if (raw && typeof raw.toMillis === "function") ms = raw.toMillis();
  else if (raw && typeof raw.toDate === "function") ms = raw.toDate().getTime();
  return !Number.isFinite(ms) || ms <= now;
}

export function assertInviteAcceptable(input: {
  invite: Pick<TenantInvite, "email" | "status" | "expiresAt" | "tenantId" | "role"> | null;
  actorEmail: string;
  memberships: Array<Pick<TenantUser, "tenantId" | "status">>;
  now?: number;
}): { tenantId: string; role: Role } {
  const { invite, actorEmail, memberships, now = Date.now() } = input;
  if (!invite) throw new Error("Convite não encontrado.");
  if (invite.status !== "pending") throw new Error(INVITE_NOT_PENDING);
  if (isInviteExpired(invite, now)) throw new Error(INVITE_EXPIRED);
  if (normalizeInviteEmail(invite.email) !== normalizeInviteEmail(actorEmail)) {
    throw new Error(INVITE_EMAIL_MISMATCH);
  }
  const existing = memberships.find((m) => m.tenantId === invite.tenantId && m.status !== "disabled");
  if (existing) throw new Error(INVITE_ALREADY_MEMBER);
  return { tenantId: invite.tenantId, role: invite.role };
}

export function assertCanCreateInvite(input: {
  actorRole: Role;
  actorEmail: string;
  targetEmail: string;
  targetRole: string;
  members: Array<Pick<TenantUser, "email" | "userId" | "status">>;
  pendingEmails: string[];
}): TenantInviteRole {
  const email = normalizeInviteEmail(input.targetEmail);
  if (!email || !email.includes("@")) throw new Error("Informe um e-mail válido.");
  if (email === normalizeInviteEmail(input.actorEmail)) throw new Error(INVITE_SELF);
  if (!canInviteRole(input.actorRole, input.targetRole)) throw new Error(INVITE_ROLE_DENIED);
  const already = input.members.some(
    (m) => m.status !== "disabled" && normalizeInviteEmail(m.email ?? "") === email
  );
  if (already) throw new Error(INVITE_ALREADY_MEMBER);
  if (input.pendingEmails.map(normalizeInviteEmail).includes(email)) {
    throw new Error(INVITE_PENDING_EXISTS);
  }
  return input.targetRole;
}

export function publicInviteView(invite: TenantInvite): {
  tenantName: string;
  email: string;
  role: Role;
  status: TenantInviteStatus;
  expired: boolean;
} {
  return {
    tenantName: invite.tenantName,
    email: invite.email,
    role: invite.role,
    status: invite.status,
    expired: invite.status === "pending" && isInviteExpired(invite),
  };
}
