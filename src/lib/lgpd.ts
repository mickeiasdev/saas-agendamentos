import type { Customer, LgpdConsent, UserProfile } from "@/types";

/**
 * LGPD (Fase 3.19).
 *
 * Lógica pura de consentimento, exportação, exclusão e anonimização de dados.
 * O foco é dar ao titular (cliente/usuário) o controle sobre seus dados:
 * - consentimento rastreável por tipo;
 * - exportação de dados pessoais;
 * - anonimização (substitui PII por valores neutros) em vez de apagar
 *   registros que participam de regras de negócio (histórico financeiro).
 */

export interface ConsentRecord {
  tenantId: string;
  subject: "customer" | "user";
  subjectId: string;
  consentType: LgpdConsent["consentType"];
  granted: boolean;
  createdAt: Date;
}

export function buildConsentRecord(
  input: Omit<ConsentRecord, "createdAt">,
  now = new Date()
): Omit<LgpdConsent, "id"> {
  return {
    tenantId: input.tenantId,
    subject: input.subject,
    subjectId: input.subjectId,
    consentType: input.consentType,
    granted: input.granted,
    grantedAt: input.granted ? now : null,
    revokedAt: input.granted ? null : now,
    createdAt: now,
  };
}

/** Verifica se há consentimento vigente para o tipo. */
export function hasConsent(
  consents: Pick<LgpdConsent, "consentType" | "granted">[],
  consentType: LgpdConsent["consentType"]
): boolean {
  const match = consents.find((c) => c.consentType === consentType);
  return Boolean(match?.granted);
}

const PII_FIELDS = ["name", "email", "phone", "whatsapp", "birthDate", "notes"] as const;

/** Anonimiza campos pessoais de um cliente, mantendo dados de negócio. */
export function anonymizeCustomer(customer: Customer): Customer {
  const anonymized = { ...customer };
  for (const field of PII_FIELDS) {
    if (field in anonymized) {
      (anonymized as Record<string, unknown>)[field] = undefined;
    }
  }
  return anonymized;
}

/** Constrói o pacote de exportação LGPD de um cliente. */
export function buildCustomerExport(
  customer: Customer,
  extras: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    exportedAt: new Date().toISOString(),
    data: {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      whatsapp: customer.whatsapp,
      birthDate: customer.birthDate,
      createdAt: customer.createdAt,
    },
    ...extras,
  };
}

/** Constrói o pacote de exportação de um usuário da plataforma. */
export function buildUserExport(
  user: Pick<UserProfile, "uid" | "email" | "displayName" | "phone" | "createdAt">
): Record<string, unknown> {
  return {
    exportedAt: new Date().toISOString(),
    data: {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      phone: user.phone,
      createdAt: user.createdAt,
    },
  };
}

/** Mantém apenas o essencial para reter histórico (anonimização para LGPD). */
export function retentionSafeCustomer(customer: Customer): Partial<Customer> {
  return {
    id: customer.id,
    tenantId: customer.tenantId,
    name: "Titular anonimizado",
    tags: [],
    totalSpent: customer.totalSpent,
    visitCount: customer.visitCount,
  };
}
