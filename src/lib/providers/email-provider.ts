/**
 * Abstração de provedor de e-mail.
 * Enquanto não houver um provedor com free tier oficial adequado
 * configurado, o provider fica desativado e as notificações usam
 * o sistema interno + logging.
 */

export interface SendEmailInput {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  templateData?: Record<string, unknown>;
}

export interface EmailProvider {
  readonly id: string;
  isEnabled(): boolean;
  send(input: SendEmailInput): Promise<void>;
}
