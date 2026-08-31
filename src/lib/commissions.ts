import type { Appointment, Professional, Service } from "@/types";

/**
 * Comissões (Fase 2.19).
 *
 * Cálculo automático: preço do serviço x percentual de comissão configurado
 * no serviço. Quando o serviço não define percentual, nenhuma comissão é
 * gerada.
 */

export function calculateCommission(price: number, percent: number): number {
  if (percent <= 0) return 0;
  return Math.round(price * (percent / 100) * 100) / 100;
}

export function commissionForService(service: Pick<Service, "price" | "commissionPercent">): number {
  if (!service.commissionPercent) return 0;
  return calculateCommission(service.price, service.commissionPercent);
}

export interface ProfessionalCommissionRow {
  professional: Professional;
  appointments: number;
  revenue: number;
  commission: number;
}

export function commissionsByProfessional(
  appointments: Appointment[],
  professionals: Professional[],
  services: Service[],
  opts: { onlyPaidStatuses?: Appointment["status"][] } = {}
): ProfessionalCommissionRow[] {
  const revenueStatuses = opts.onlyPaidStatuses ?? ["confirmed", "in_progress", "completed"];
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  return professionals.map((professional) => {
    const rows = appointments.filter(
      (a) =>
        a.professionalId === professional.id &&
        revenueStatuses.includes(a.status) &&
        a.paymentStatus !== "refunded"
    );
    const revenue = rows.reduce((sum, a) => sum + (a.price ?? 0), 0);
    const commission = rows.reduce((sum, a) => {
      const service = serviceMap.get(a.serviceId);
      if (!service?.commissionPercent) return sum;
      return sum + calculateCommission(a.price ?? 0, service.commissionPercent);
    }, 0);
    return {
      professional,
      appointments: rows.length,
      revenue,
      commission: Math.round(commission * 100) / 100,
    };
  });
}
