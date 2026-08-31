import type { Appointment, Automation, AutomationRun, Customer } from "@/types";

/**
 * Marketing automático (Fase 3.7).
 *
 * Motor de automações: cliente inativo, aniversário, lembrete de agendamento
 * amanhã e atendimento concluído (pedido de avaliação). Lógica pura de
 * seleção de alvos e construção de conteúdo.
 */

export function daysSince(date: Date | undefined, now: Date): number | null {
  if (!date) return null;
  const d = date instanceof Date ? date : date?.toDate?.() ?? new Date(String(date));
  return Math.floor((now.getTime() - d.getTime()) / 86400000);
}

export function isBirthday(date: string | undefined, now: Date): boolean {
  if (!date) return false;
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return false;
  const [, , bMonth, bDay] = match;
  return Number(bMonth) === month && Number(bDay) === day;
}

/** Seleciona clientes inativos há pelo menos `days`. */
export function selectInactiveCustomers(
  customers: Customer[],
  days: number,
  now: Date
): Customer[] {
  return customers.filter((c) => {
    const since = daysSince(c.lastVisitAt ?? c.createdAt, now);
    return since !== null && since >= days;
  });
}

export function selectBirthdayCustomers(customers: Customer[], now: Date): Customer[] {
  return customers.filter((c) => isBirthday(c.birthDate, now));
}

/** Seleciona agendamentos que ocorrem amanhã e ainda não têm lembrete enviado. */
export function selectTomorrowAppointments(
  appointments: Appointment[],
  now: Date
): Appointment[] {
  const tomorrow = new Date(now.getTime() + 86400000);
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const target = key(tomorrow);
  return appointments.filter((a) => {
    if (a.status !== "confirmed" && a.status !== "pending") return false;
    const start = a.startAt instanceof Date ? a.startAt : a.startAt?.toDate?.() ?? new Date(String(a.startAt));
    return key(start) === target;
  });
}

/** Seleciona atendimentos concluídos sem avaliação. */
export function selectCompletedUnreviewed(
  appointments: Appointment[],
  reviewedAppointmentIds: Set<string>
): Appointment[] {
  return appointments.filter(
    (a) => a.status === "completed" && !reviewedAppointmentIds.has(a.id)
  );
}

export interface AutomationContent {
  title: string;
  body: string;
}

/** Constrói o conteúdo da automação conforme o gatilho. */
export function buildAutomationContent(
  trigger: Automation["trigger"],
  context: { customerName?: string; appointmentDate?: string; appointmentTime?: string; serviceName?: string }
): AutomationContent {
  switch (trigger) {
    case "customer_inactive":
      return {
        title: "Sentimos sua falta!",
        body: `${context.customerName ?? "Olá"}, faz um tempo que você não nos visita. Vem aproveitar uma condição especial!`,
      };
    case "birthday":
      return {
        title: "Feliz aniversário!",
        body: `${context.customerName ?? "Olá"}, temos uma surpresa para o seu dia especial. Aproveite!`,
      };
    case "appointment_tomorrow":
      return {
        title: "Lembrete de agendamento",
        body: `Lembrete: ${context.serviceName ?? "seu atendimento"} em ${context.appointmentDate ?? ""} às ${context.appointmentTime ?? ""}.`,
      };
    case "appointment_completed":
      return {
        title: "Como foi seu atendimento?",
        body: `${context.customerName ?? "Olá"}, conte como foi seu atendimento e avalie nosso serviço!`,
      };
  }
}

export function isAutomationEnabled(a: Automation): boolean {
  return a.enabled;
}

export function isAutomationRunEligible(
  automation: Automation,
  existingRuns: Pick<AutomationRun, "targetId" | "status">[],
  targetId: string
): boolean {
  if (!automation.enabled) return false;
  return !existingRuns.some(
    (r) => r.targetId === targetId && (r.status === "sent" || r.status === "pending")
  );
}
