/**
 * Paginação (Fase 3.22).
 *
 * Helpers puros de paginação para listas potencialmente grandes (clientes,
 * agendamentos, empresas, logs, notificações). Reduz leituras no Firestore
 * carregando apenas a página solicitada.
 */

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number
): Page<T> {
  const safePage = Math.max(1, Math.floor(page) || 1);
  const safeSize = Math.max(1, Math.floor(pageSize) || 1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safeSize));
  const clampedPage = Math.min(safePage, totalPages);
  const start = (clampedPage - 1) * safeSize;
  const slice = items.slice(start, start + safeSize);
  return {
    items: slice,
    page: clampedPage,
    pageSize: safeSize,
    total,
    totalPages,
    hasNext: clampedPage < totalPages,
    hasPrevious: clampedPage > 1,
  };
}

export function pageOffset(page: number, pageSize: number): number {
  return (Math.max(1, page) - 1) * Math.max(1, pageSize);
}

export function clampPageSize(pageSize: number, max = 100): number {
  return Math.min(Math.max(1, Math.floor(pageSize) || 1), max);
}

/** Calcula total de páginas. */
export function totalPages(total: number, pageSize: number): number {
  const size = Math.max(1, pageSize);
  return Math.max(1, Math.ceil(total / size));
}
