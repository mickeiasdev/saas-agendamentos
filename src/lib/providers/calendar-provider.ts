/**
 * Calendários (Fase 3.5).
 *
 * Abstração de integração com Google Calendar e Outlook. A integração real
 * exige OAuth e APIs externas; quando houver free tier oficial adequado, o
 * provider pode ser ativado. Enquanto isso, a interface e os modelos de dados
 * (calendar_integrations) ficam prontos e o provider permanece desativado.
 */

export interface CalendarEventInput {
  title: string;
  description?: string;
  start: Date;
  end: Date;
  attendees?: string[];
  location?: string;
}

export interface CalendarProvider {
  readonly id: string;
  isEnabled(): boolean;
  createEvent(input: CalendarEventInput): Promise<{ ok: boolean; eventId?: string; error?: string }>;
  updateEvent(eventId: string, input: Partial<CalendarEventInput>): Promise<{ ok: boolean; error?: string }>;
  deleteEvent(eventId: string): Promise<{ ok: boolean; error?: string }>;
  /** Exporta os eventos do agendamento para o calendário externo. */
  syncAppointment(input: CalendarEventInput & { externalEventId?: string }): Promise<{
    ok: boolean;
    eventId?: string;
    error?: string;
  }>;
}

export class DisabledCalendarProvider implements CalendarProvider {
  readonly id = "disabled";

  isEnabled(): boolean {
    return false;
  }

  private disabled(): Promise<{ ok: false; error: string }> {
    return Promise.resolve({
      ok: false,
      error: "Integração de calendário não configurada. Ative um provider com free tier oficial.",
    });
  }

  createEvent(_input: CalendarEventInput) {
    return this.disabled();
  }

  updateEvent(_eventId: string, _input: Partial<CalendarEventInput>) {
    return this.disabled();
  }

  deleteEvent(_eventId: string) {
    return this.disabled();
  }

  syncAppointment(_input: CalendarEventInput & { externalEventId?: string }) {
    return this.disabled();
  }
}

/** Seletor de provider: retorna o provider ativo ou o desativado. */
export function getCalendarProvider(enabled = false): CalendarProvider {
  return enabled ? new DisabledCalendarProvider() : new DisabledCalendarProvider();
}
