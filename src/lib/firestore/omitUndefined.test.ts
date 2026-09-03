import { describe, expect, it } from "vitest";
import { omitUndefined } from "./omitUndefined";

describe("omitUndefined", () => {
  it("remove campos undefined no primeiro nível", () => {
    expect(omitUndefined({ uid: "1", photoUrl: undefined, email: "a@b.c" })).toEqual({
      uid: "1",
      email: "a@b.c",
    });
  });

  it("remove undefined aninhado e preserva objetos vazios", () => {
    expect(
      omitUndefined({
        name: "Barbearia",
        tradeName: undefined,
        address: { street: undefined, city: "SP" },
        branding: { socialLinks: {} },
      })
    ).toEqual({
      name: "Barbearia",
      address: { city: "SP" },
      branding: { socialLinks: {} },
    });
  });

  it("preserva arrays, null, false e 0", () => {
    expect(omitUndefined({ tags: ["a"], n: 0, ok: false, note: null })).toEqual({
      tags: ["a"],
      n: 0,
      ok: false,
      note: null,
    });
  });
});
