import { describe, expect, it } from "vitest";
import { dataUrlByteLength, isInlineImageUrl } from "./upload";

describe("imagens inline (sem Firebase Storage)", () => {
  it("reconhece data URL de imagem", () => {
    expect(isInlineImageUrl("data:image/jpeg;base64,AAAA")).toBe(true);
    expect(isInlineImageUrl("https://example.com/logo.png")).toBe(false);
    expect(isInlineImageUrl(undefined)).toBe(false);
  });

  it("calcula o tamanho em bytes de um data URL", () => {
    const raw = "AAAA";
    const dataUrl = `data:image/jpeg;base64,${raw}`;
    expect(dataUrlByteLength(dataUrl)).toBe(3);
  });
});
