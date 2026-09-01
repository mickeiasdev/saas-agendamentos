import { describe, expect, it } from "vitest";
import { publicThemeClasses } from "./theme";

describe("publicThemeClasses", () => {
  it("aplica o tema claro por padrão", () => {
    const light = publicThemeClasses("light");
    expect(light.dark).toBe(false);
    expect(light.page).toContain("bg-white");
  });

  it("aplica o tema escuro de verdade (não só a cor primária)", () => {
    const dark = publicThemeClasses("dark");
    expect(dark.dark).toBe(true);
    expect(dark.page).toContain("bg-slate-950");
    expect(dark.heading).toContain("slate-50");
    expect(dark.card).toContain("bg-slate-900");
  });
});
