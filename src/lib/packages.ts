import type { CustomerPackage, CustomerPackageItem, PackageItem, ServicePackage } from "@/types";

/**
 * Pacotes (Fase 3.8).
 *
 * Lógica pura de pacotes de serviços: criação, consumo e validação de
 * validade. A empresa vende pacotes (ex.: 10 cortes) que o cliente consome
 * ao longo do tempo, com controle de quantidade por serviço.
 */

export function isPackageValid(pkg: Pick<ServicePackage, "items" | "price">): boolean {
  if (!Number.isFinite(pkg.price) || pkg.price < 0) return false;
  return pkg.items.length > 0 && pkg.items.every((i) => isPackageItemValid(i));
}

export function isPackageItemValid(item: PackageItem): boolean {
  return (
    Boolean(item.serviceId?.trim()) &&
    Number.isInteger(item.quantity) &&
    item.quantity > 0
  );
}

/** Converte os itens de um pacote em itens de consumo do cliente (nada consumido). */
export function buildCustomerPackageItems(pkg: ServicePackage): CustomerPackageItem[] {
  return pkg.items.map((i) => ({
    serviceId: i.serviceId,
    serviceName: i.serviceName,
    total: i.quantity,
    used: 0,
  }));
}

export interface PackageConsumeResult {
  ok: boolean;
  items?: CustomerPackageItem[];
  error?: string;
  remaining?: number;
}

/** Idade em dias desde a compra (negativo se a data de compra é futura). */
export function packageAgeDays(purchasedAt: Date, now: Date): number {
  return Math.floor((now.getTime() - purchasedAt.getTime()) / 86400000);
}

export function isPackageExpired(
  pkg: Pick<CustomerPackage, "expiresAt">,
  now: Date
): boolean {
  if (!pkg.expiresAt) return false;
  const expires = pkg.expiresAt instanceof Date ? pkg.expiresAt : pkg.expiresAt.toDate?.() ?? new Date(String(pkg.expiresAt));
  return now.getTime() > expires.getTime();
}

export function isPackageFullyUsed(pkg: Pick<CustomerPackage, "items">): boolean {
  return pkg.items.every((i) => i.used >= i.total);
}

/**
 * Consome uma utilização do serviço no pacote do cliente.
 * Valida status ativo, validade e saldo disponível.
 */
export function consumePackageService(
  pkg: Pick<CustomerPackage, "status" | "expiresAt" | "items">,
  serviceId: string,
  now: Date
): PackageConsumeResult {
  if (pkg.status !== "active") {
    return { ok: false, error: "Este pacote não está ativo." };
  }
  if (isPackageExpired(pkg, now)) {
    return { ok: false, error: "Este pacote está vencido." };
  }
  const item = pkg.items.find((i) => i.serviceId === serviceId);
  if (!item) {
    return { ok: false, error: "Este serviço não faz parte do pacote." };
  }
  const remaining = item.total - item.used;
  if (remaining <= 0) {
    return { ok: false, error: "Você já utilizou todas as sessões deste serviço no pacote." };
  }

  const items = pkg.items.map((i) =>
    i.serviceId === serviceId ? { ...i, used: i.used + 1 } : i
  );
  return { ok: true, items, remaining: remaining - 1 };
}

/** Deriva o status do pacote do cliente a partir de validade e consumo. */
export function deriveCustomerPackageStatus(
  pkg: Pick<CustomerPackage, "status" | "expiresAt" | "items">,
  now: Date
): CustomerPackage["status"] {
  if (pkg.status !== "active") return pkg.status;
  if (isPackageExpired(pkg, now)) return "expired";
  if (isPackageFullyUsed(pkg)) return "used";
  return "active";
}
