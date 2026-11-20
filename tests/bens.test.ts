import { describe, expect, it } from "vitest";
import { median, valueBem } from "@/lib/bens";

describe("bienes", () => {
  it("mediana", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
  it("auto: promedio entre FIPE y mediana de anuncios", () => {
    const v = valueBem({ id: "a", kind: "veiculo", name: "A", fipe: { value: 100, ref: "2026-11", source: "x" }, market: [{ price: 90, source: "x" }, { price: 110, source: "x" }, { price: 130, source: "x" }] });
    expect(v.marketValue).toBe(110);
    expect(v.value).toBe(105);
  });
  it("inmueble: mediana del R$/m² × área propia", () => {
    const v = valueBem({ id: "c", kind: "imovel", name: "C", area_m2: 90, market: [{ price: 450000, area_m2: 90, source: "x" }, { price: 500000, area_m2: 100, source: "x" }, { price: 600000, area_m2: 100, source: "x" }] });
    expect(v.marketValue).toBe(450000); // mediana 5.000/m² × 90
    expect(v.value).toBe(450000);
  });
});

describe("valor informado", () => {
  it("prevalece sobre la estimación, que queda como referencia de mercado", () => {
    const v = valueBem({ id: "c", kind: "imovel", name: "C", area_m2: 90, owner_value: 520000, market: [{ price: 450000, area_m2: 90, source: "x" }] });
    expect(v.value).toBe(520000);
    expect(v.marketValue).toBe(450000);
    expect(v.method).toBe("Valor informado por vocês");
  });
});
