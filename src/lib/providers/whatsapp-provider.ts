/**
 * Abstração de integração oficial com WhatsApp (Cloud API).
 * A integração real só será ativada com credenciais oficiais.
 * NUNCA utilizar soluções não oficiais/piratas.
 */

export interface WhatsAppTemplate {
  name: string;
  language: string;
  components: unknown[];
}

export interface WhatsAppProvider {
  readonly id: string;
  isEnabled(): boolean;
  sendText(to: string, text: string): Promise<void>;
  sendTemplate(to: string, template: WhatsAppTemplate): Promise<void>;
}
