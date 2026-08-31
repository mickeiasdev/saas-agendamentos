import { describe, expect, it } from "vitest";
import { clampPageSize, pageOffset, paginate, totalPages } from "./pagination";

describe("pagination (Fase 3.22)", () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1);

  it("retorna a página solicitada", () => {
    const page = paginate(items, 2, 10);
    expect(page.items).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(page.page).toBe(2);
    expect(page.total).toBe(25);
    expect(page.totalPages).toBe(3);
    expect(page.hasNext).toBe(true);
    expect(page.hasPrevious).toBe(true);
  });

  it("clampa página fora do intervalo", () => {
    const page = paginate(items, 99, 10);
    expect(page.page).toBe(3);
    expect(page.items).toEqual([21, 22, 23, 24, 25]);
    expect(page.hasNext).toBe(false);
  });

  it("trata página e tamanho inválidos", () => {
    expect(paginate(items, 0, 0).page).toBe(1);
    expect(paginate([], 1, 10).items).toEqual([]);
    expect(paginate([], 1, 10).totalPages).toBe(1);
  });

  it("calcula offset, clamp e total de páginas", () => {
    expect(pageOffset(1, 10)).toBe(0);
    expect(pageOffset(3, 10)).toBe(20);
    expect(clampPageSize(500, 100)).toBe(100);
    expect(clampPageSize(0, 100)).toBe(1);
    expect(totalPages(25, 10)).toBe(3);
    expect(totalPages(0, 10)).toBe(1);
  });
});
