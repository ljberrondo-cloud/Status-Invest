import { describe, expect, it } from "vitest";
import { authToken, safeEqual, safeNext } from "@/lib/auth";

describe("acceso con contraseña", () => {
  it("el token depende de la contraseña y no la contiene", async () => {
    const a = await authToken("secreta-1");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(await authToken("secreta-1"));
    expect(a).not.toBe(await authToken("secreta-2"));
    expect(a).not.toContain("secreta");
  });

  it("comparación segura", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "ab")).toBe(false);
  });

  it("después del login sólo redirige dentro de la app", () => {
    expect(safeNext("/activos#fiis")).toBe("/activos#fiis");
    expect(safeNext("https://otro.sitio")).toBe("/");
    expect(safeNext("//otro.sitio")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });
});
