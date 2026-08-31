import { describe, expect, it } from "vitest";
import {
  WEBHOOK_STATUS_FLOW,
  canTransitionWebhook,
  hashString,
  makeIdempotencyKey,
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
