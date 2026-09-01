import { describe, expect, it } from "vitest";
import { findBlockingOverlaps, isBlockingStatus, rangesOverlap } from "./overlap";

describe("rangesOverlap", () => {
  it("detecta sobreposição parcial", () => {
    expect(rangesOverlap(new Date("2030-01-14T10:00:00Z"), new Date("2030-01-14T10:30:00Z"), new Date("2030-01-14T10:15:00Z"), new Date("2030-01-14T10:45:00Z"))).toBe(true);
  });

  it("permite horários adjacentes sem sobreposição", () => {
    expect(rangesOverlap(new Date("2030-01-14T10:00:00Z"), new Date("2030-01-14T10:30:00Z"), new Date("2030-01-14T10:30:00Z"), new Date("2030-01-14T11:00:00Z"))).toBe(false);
  });
});

describe("findBlockingOverlaps", () => {
  const start = new Date("2030-01-14T13:00:00Z");
  const end = new Date("2030-01-14T13:30:00Z");

  it("ignora cancelados e no_show", () => {
    const overlaps = findBlockingOverlaps(
      [
        { id: "a", startAt: start, endAt: end, status: "cancelled" },
        { id: "b", startAt: start, endAt: end, status: "no_show" },
      ],
      start,
      end
    );
    expect(overlaps).toHaveLength(0);
  });

  it("bloqueia pending/confirmed no mesmo intervalo", () => {
    const overlaps = findBlockingOverlaps(
      [{ id: "a", startAt: start, endAt: end, status: "confirmed" }],
      start,
      end
    );
    expect(overlaps.map((d) => d.id)).toEqual(["a"]);
  });

  it("ignora o próprio slot-id (não só o id determinístico)", () => {
    const overlaps = findBlockingOverlaps(
      [{ id: "pro1_123", startAt: start, endAt: end, status: "pending" }],
      start,
      end,
      ["pro1_123"]
    );
    expect(overlaps).toHaveLength(0);
  });
});

describe("isBlockingStatus", () => {
  it("só cancelled e no_show liberam o horário", () => {
    expect(isBlockingStatus("cancelled")).toBe(false);
    expect(isBlockingStatus("no_show")).toBe(false);
    expect(isBlockingStatus("pending")).toBe(true);
    expect(isBlockingStatus("confirmed")).toBe(true);
  });
});
