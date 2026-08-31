import { describe, expect, it } from "vitest";
import {
  WEBHOOK_STATUS_FLOW,
  buildWebhookHeaders,
  buildWebhookPayload,
  canTransitionWebhook,
  hashString,
  isPublicWebhookEvent,
  makeIdempotencyKey,
  shouldDeliver,
  webhookStatusLabel,
} from "./webhooks";

describe("webhooks (Fase 2.8)", () => {
  it("gera chave de idempotência determinística", () => {
    const payload = { id: "abc", amount: 100 };
    const a = makeIdempotencyKey("mercadopago", "payment.approved", payload);
    const b = makeIdempotencyKey("mercadopago", "payment.approved", payload);
    expect(a).toBe(b);
  });

  it("chave muda quando o payload ou evento muda", () => {
    const payload = { id: "abc" };
    const base = makeIdempotencyKey("gw", "payment.approved", payload);
    expect(makeIdempotencyKey("gw", "payment.refunded", payload)).not.toBe(base);
    expect(makeIdempotencyKey("gw", "payment.approved", { id: "xyz" })).not.toBe(base);
  });

  it("chave é estável entre ordenações do mesmo payload", () => {
    const a = makeIdempotencyKey("gw", "e", { x: 1, y: [2, 3] });
    const b = makeIdempotencyKey("gw", "e", { y: [2, 3], x: 1 });
    expect(a).toBe(b);
  });

  it("hashString é determinístico", () => {
    expect(hashString("hello")).toBe(hashString("hello"));
    expect(hashString("hello")).not.toBe(hashString("world"));
  });

  it("processado é terminal e falhas podem ser reprocessadas", () => {
    expect(WEBHOOK_STATUS_FLOW.processed).toEqual([]);
    expect(canTransitionWebhook("failed", "processing")).toBe(true);
    expect(canTransitionWebhook("received", "processing")).toBe(true);
    expect(canTransitionWebhook("processing", "processed")).toBe(true);
    expect(canTransitionWebhook("processed", "processing")).toBe(false);
  });

  it("retorna rótulos legíveis", () => {
    expect(webhookStatusLabel("processed")).toBe("Processado");
    expect(webhookStatusLabel("failed")).toBe("Falhou");
  });
});

describe("public webhooks (Fase 3.14)", () => {
  it("reconhece eventos públicos", () => {
    expect(isPublicWebhookEvent("appointment.created")).toBe(true);
    expect(isPublicWebhookEvent("payment.approved")).toBe(true);
    expect(isPublicWebhookEvent("outro.evento")).toBe(false);
  });

  it("verifica se o webhook deve entregar o evento", () => {
    expect(shouldDeliver(["appointment.created", "payment.approved"], "appointment.created")).toBe(true);
    expect(shouldDeliver(["appointment.created"], "payment.approved")).toBe(false);
  });

  it("constrói payload com evento, tenant e timestamp", () => {
    const payload = buildWebhookPayload("appointment.created", "t1", { id: "a1" });
    expect(payload.event).toBe("appointment.created");
    expect(payload.tenantId).toBe("t1");
    expect(payload.data).toEqual({ id: "a1" });
    expect(payload.timestamp).toBeDefined();
  });

  it("constrói cabeçalhos de entrega", () => {
    const headers = buildWebhookHeaders("sig", "delivery-1", "appointment.created");
    expect(headers["X-Agenda-Signature"]).toBe("sig");
    expect(headers["X-Agenda-Delivery"]).toBe("delivery-1");
    expect(headers["X-Agenda-Event"]).toBe("appointment.created");
  });
});
