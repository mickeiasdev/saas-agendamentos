/**
 * Abstração de notificações.
 * O canal interno (painel) é o provider inicial.
 * E-mail e WhatsApp são canais opcionais plugáveis.
 */

export interface SendNotificationInput {
  userId?: string;
  tenantId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  email?: { to: string; subject: string };
  whatsapp?: { to: string; text: string };
}

export interface NotificationProvider {
  readonly id: string;
  isEnabled(): boolean;
  send(input: SendNotificationInput): Promise<void>;
}
