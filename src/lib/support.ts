import type { SupportTicket, SupportTicketPriority, SupportTicketStatus } from "@/types";

/**
 * Suporte (Fase 3.15).
 *
 * Lógica pura de tickets de suporte: validação, transições de status e
 * ordenação por prioridade.
 */

export const TICKET_PRIORITY_LEVEL: Record<SupportTicketPriority, number> = {
  low: 1,
  normal: 2,
  high: 3,
  urgent: 4,
};

export const TICKET_STATUS_FLOW: Record<SupportTicketStatus, SupportTicketStatus[]> = {
  open: ["in_progress", "resolved", "closed"],
  in_progress: ["waiting", "open", "resolved", "closed"],
  waiting: ["in_progress", "resolved", "closed"],
  resolved: ["closed", "in_progress"],
  closed: [],
};

export function canTransitionTicketStatus(
  from: SupportTicketStatus,
  to: SupportTicketStatus
): boolean {
  return (TICKET_STATUS_FLOW[from] ?? []).includes(to);
}

export function isTicketTitleValid(title: string): boolean {
  return title.trim().length >= 3;
}

export function isTicketBodyValid(body: string): boolean {
  return body.trim().length >= 3;
}

/** Prioridade numérica para ordenação. */
export function priorityOf(priority: SupportTicketPriority): number {
  return TICKET_PRIORITY_LEVEL[priority] ?? 1;
}

export function compareTickets(a: SupportTicket, b: SupportTicket): number {
  const byPriority = priorityOf(b.priority) - priorityOf(a.priority);
  if (byPriority !== 0) return byPriority;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export function ticketStatusLabel(status: SupportTicketStatus): string {
  const labels: Record<SupportTicketStatus, string> = {
    open: "Aberto",
    in_progress: "Em andamento",
    waiting: "Aguardando cliente",
    resolved: "Resolvido",
    closed: "Fechado",
  };
  return labels[status] ?? status;
}

export function ticketPriorityLabel(priority: SupportTicketPriority): string {
  const labels: Record<SupportTicketPriority, string> = {
    low: "Baixa",
    normal: "Normal",
    high: "Alta",
    urgent: "Urgente",
  };
  return labels[priority] ?? priority;
}
