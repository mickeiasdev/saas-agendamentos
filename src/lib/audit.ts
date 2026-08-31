import type { AuditLog } from "@/types";

/**
 * Auditoria (Fase 3.17).
 *
 * Lógica pura de construção e validação de registros de auditoria. Cada evento
 * sensível (login, alterações, exclusões, pagamentos, permissões, configurações,
 * acesso administrativo) gera um AuditLog imutável (sem update/delete nas rules).
 */

export interface AuditEntryInput {
  tenantId?: string;
  userId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

const SENSITIVE_KEYS = ["password", "token", "secret", "apiKey", "keyHash", "authorization", "creditCard"];

/** Remove campos sensíveis do metadata antes de persistir. */
export function sanitizeAuditMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s.toLowerCase()))) continue;
    result[key] = value;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

export function buildAuditEntry(input: AuditEntryInput): Omit<AuditLog, "id"> {
  const action = input.action.trim();
  if (!action) throw new Error("Ação de auditoria é obrigatória.");
  return {
    tenantId: input.tenantId,
    userId: input.userId,
    action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: sanitizeAuditMetadata(input.metadata),
    createdAt: new Date(),
  };
}

export const AUDIT_ACTIONS = {
  LOGIN: "auth.login",
  LOGOUT: "auth.logout",
  PASSWORD_CHANGE: "auth.password_change",
  TENANT_CREATE: "tenant.create",
  TENANT_UPDATE: "tenant.update",
  TENANT_DELETE: "tenant.delete",
  USER_CREATE: "user.create",
  USER_UPDATE: "user.update",
  USER_DELETE: "user.delete",
  APPOINTMENT_CREATE: "appointment.create",
  APPOINTMENT_UPDATE: "appointment.update",
  APPOINTMENT_CANCEL: "appointment.cancel",
  PAYMENT_CREATE: "payment.create",
  PAYMENT_UPDATE: "payment.update",
  SETTINGS_UPDATE: "settings.update",
  PERMISSION_CHANGE: "permission.change",
  ADMIN_ACCESS: "admin.access",
  IMPERSONATION_START: "impersonation.start",
  IMPERSONATION_END: "impersonation.end",
  LGPD_EXPORT: "lgpd.export",
  LGPD_DELETE: "lgpd.delete",
} as const;

export function describeAuditAction(action: string): string {
  const map: Record<string, string> = {
    "auth.login": "Login realizado",
    "auth.logout": "Logout realizado",
    "auth.password_change": "Senha alterada",
    "tenant.create": "Empresa criada",
    "tenant.update": "Empresa atualizada",
    "tenant.delete": "Empresa excluída",
    "user.create": "Usuário criado",
    "user.update": "Usuário atualizado",
    "user.delete": "Usuário excluído",
    "appointment.create": "Agendamento criado",
    "appointment.update": "Agendamento atualizado",
    "appointment.cancel": "Agendamento cancelado",
    "payment.create": "Pagamento registrado",
    "payment.update": "Pagamento atualizado",
    "settings.update": "Configurações alteradas",
    "permission.change": "Permissões alteradas",
    "admin.access": "Acesso administrativo",
    "impersonation.start": "Impersonação iniciada",
    "impersonation.end": "Impersonação encerrada",
    "lgpd.export": "Exportação LGPD",
    "lgpd.delete": "Exclusão LGPD",
  };
  return map[action] ?? action;
}
