import { describe, expect, it } from "vitest";
import { applyJobResult, buildJob, canRunJob, jobStatusLabel } from "./jobs";

describe("jobs (Fase 3.23)", () => {
  it("constrói job queued com defaults", () => {
    const now = new Date("2026-01-01T10:00:00Z");
    const job = buildJob({ tenantId: "t1", type: "notify", payload: {} }, now);
    expect(job).toMatchObject({
      tenantId: "t1",
      type: "notify",
      status: "queued",
      attempts: 0,
      maxAttempts: 3,
    });
    expect(job.runAt).toBeInstanceOf(Date);
    expect((job.runAt as Date).getTime()).toBe(now.getTime());
  });

  it("rejeita runAt no passado", () => {
    const now = new Date("2026-01-01T10:00:00Z");
    expect(() => buildJob({ type: "x", payload: {}, runAt: new Date("2026-01-01T09:00:00Z") }, now)).toThrow();
  });

  it("verifica se o job está pronto para execução", () => {
    const now = new Date("2026-01-01T10:00:00Z");
    expect(canRunJob({ status: "queued", runAt: new Date("2026-01-01T10:00:00Z") }, now)).toBe(true);
    expect(canRunJob({ status: "queued", runAt: new Date("2026-01-01T11:00:00Z") }, now)).toBe(false);
    expect(canRunJob({ status: "running", runAt: new Date("2026-01-01T10:00:00Z") }, now)).toBe(false);
  });

  it("marca sucesso como completed", () => {
    const job = { attempts: 1, maxAttempts: 3, runAt: new Date() };
    const result = applyJobResult(job, true);
    expect(result.status).toBe("completed");
    expect(result.attempts).toBe(2);
  });

  it("reagenda com backoff ao falhar", () => {
    const now = new Date("2026-01-01T10:00:00Z");
    const job = { attempts: 1, maxAttempts: 3, runAt: now };
    const result = applyJobResult(job, false, "erro", now);
    expect(result.status).toBe("queued");
    expect(result.attempts).toBe(2);
    expect(result.lastError).toBe("erro");
    expect(result.runAt.getTime()).toBe(now.getTime() + 30_000 * 4);
  });

  it("marca failed quando esgota tentativas", () => {
    const now = new Date("2026-01-01T10:00:00Z");
    const job = { attempts: 3, maxAttempts: 3, runAt: now };
    const result = applyJobResult(job, false, "erro fatal", now);
    expect(result.status).toBe("failed");
    expect(result.lastError).toBe("erro fatal");
  });

  it("rotula status", () => {
    expect(jobStatusLabel("queued")).toBe("Na fila");
    expect(jobStatusLabel("failed")).toBe("Falhou");
  });
});
