import { describe, expect, it } from "vitest";
import {
  SUBSCRIPTION_FLOW,
  canTransition,
  daysLeftInTrial,
  isOperational,
  subscriptionStatusLabel,
  subscriptionStatusTone,
} from "./subscriptions";

describe("subscriptions (Fase 2.4)", () => {
  it("considera ACTIVE e TRIAL como status operacionais", () => {
    expect(isOperational("ACTIVE")).toBe(true);
    expect(isOperational("TRIAL")).toBe(true);
    expect(isOperational("PAST_DUE")).toBe(false);
    expect(isOperational("SUSPENDED")).toBe(false);
    expect(isOperational("CANCELLED")).toBe(false);
  });

  it("permite transições válidas e bloqueia inválidas", () => {
    expect(canTransition("TRIAL", "ACTIVE")).toBe(true);
    expect(canTransition("ACTIVE", "PAST_DUE")).toBe(true);
    expect(canTransition("PAST_DUE", "SUSPENDED")).toBe(true);
    expect(canTransition("SUSPENDED", "ACTIVE")).toBe(true);
    expect(canTransition("ACTIVE", "CANCELLED")).toBe(true);
    expect(canTransition("TRIAL", "SUSPENDED")).toBe(false);
    expect(canTransition("CANCELLED", "ACTIVE")).toBe(false);
  });

  it("CANCELLED é terminal", () => {
    expect(SUBSCRIPTION_FLOW.CANCELLED).toEqual([]);
  });

  it("retorna rótulos legíveis e tons de status", () => {
    expect(subscriptionStatusLabel("ACTIVE")).toBe("Ativa");
    expect(subscriptionStatusLabel("SUSPENDED")).toBe("Suspensa");
    expect(subscriptionStatusTone("ACTIVE")).toContain("emerald");
    expect(subscriptionStatusTone("CANCELLED")).toContain("red");
  });

  it("calcula dias restantes de trial", () => {
    const now = new Date("2030-01-10T00:00:00Z");
    expect(daysLeftInTrial(now, new Date("2030-01-17T00:00:00Z"))).toBe(7);
    expect(daysLeftInTrial(now, new Date("2030-01-05T00:00:00Z"))).toBe(0);
    expect(daysLeftInTrial(now, null)).toBeNull();
  });
});
