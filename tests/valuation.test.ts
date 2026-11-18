import { describe, expect, it } from "vitest";
import { accrueCdi, positionDayChange, valuePortfolio, valuePosition } from "@/lib/valuation";
import type { Asset, Quote } from "@/lib/types";

const q = (ticker: string, price: number, previousClose: number | null, extra: Partial<Quote> = {}): Quote => ({
  ticker,
  price,
  previousClose,
  changePct: previousClose ? ((price - previousClose) / previousClose) * 100 : null,
  asOf: "2026-11-13T20:00:00Z",
  source: "test",
  kind: "market",
  ...extra,
});

const assets: Asset[] = [
  { ticker: "AAA3", class: "acciones", quantity: 100 },
  { ticker: "BBB11", class: "fiis", quantity: 10 },
  { ticker: "BTC", class: "cripto", quantity: 0.5 },
  { ticker: "FGTS", class: "renta_fija", quantity: 1, provider: "manual", manual_value: 1000 },
];

describe("valuePosition", () => {
  it("valor = cantidad × precio", () => {
    const p = valuePosition(assets[0], q("AAA3", 12.34, 12));
    expect(p.value).toBeCloseTo(1234, 10);
    expect(p.price).toBe(12.34);
    expect(p.status).toBe("fresh");
  });

  it("variación del día en R$ y % desde el cierre anterior", () => {
    const p = valuePosition(assets[0], q("AAA3", 11, 10));
    expect(p.dayChange).toBeCloseTo(100, 10); // 100 × (11 − 10)
    expect(p.dayChangePct).toBeCloseTo(10, 10);
  });

  it("usa changePct si no hay cierre anterior", () => {
    expect(positionDayChange(2, q("X", 110, null, { changePct: 10 }))).toBeCloseTo(20, 10);
  });

  it("sin cotización: valor null y estado missing (no inventa precio)", () => {
    const p = valuePosition(assets[0], null);
    expect(p.value).toBeNull();
    expect(p.status).toBe("missing");
  });

  it("manual y fallback no aportan variación diaria", () => {
    expect(valuePosition(assets[3], q("FGTS", 1000, null, { kind: "manual" })).dayChange).toBeNull();
    const stale = valuePosition(assets[0], q("AAA3", 11, 10, { kind: "fallback" }));
    expect(stale.dayChange).toBeNull();
    expect(stale.status).toBe("stale");
    expect(stale.value).toBe(1100);
  });
});

describe("valuePortfolio", () => {
  const quotes = new Map<string, Quote>([
    ["AAA3", q("AAA3", 11, 10)], // 1100, +100
    ["BBB11", q("BBB11", 90, 100)], // 900, −100
    ["BTC", q("BTC", 400_000, 380_000)], // 200000, +10000
    ["FGTS", q("FGTS", 1000, null, { kind: "manual" })], // 1000, 0
  ]);
  const v = valuePortfolio(assets, quotes);

  it("total = suma de posiciones", () => {
    expect(v.total).toBeCloseTo(1100 + 900 + 200_000 + 1000, 6);
  });

  it("variación total en R$ y % sobre el patrimonio del día anterior", () => {
    expect(v.dayChange).toBeCloseTo(10_000, 6);
    const prev = v.total - 10_000;
    expect(v.dayChangePct).toBeCloseTo((10_000 / prev) * 100, 10);
  });

  it("pesos suman 100%", () => {
    const sum = v.positions.reduce((s, p) => s + (p.weight ?? 0), 0);
    expect(sum).toBeCloseTo(100, 10);
    expect(v.byClass.reduce((s, c) => s + c.weight, 0)).toBeCloseTo(100, 10);
  });

  it("resumen por clase", () => {
    const fiis = v.byClass.find((c) => c.class === "fiis")!;
    expect(fiis.value).toBe(900);
    expect(fiis.dayChange).toBe(-100);
    expect(fiis.dayChangePct).toBeCloseTo(-10, 10);
    expect(fiis.count).toBe(1);
  });

  it("activos sin cotización quedan fuera del total y se listan", () => {
    const partial = valuePortfolio(assets, new Map([["AAA3", q("AAA3", 10, 10)]]));
    expect(partial.total).toBe(1000);
    expect(partial.missing).toEqual(["BBB11", "BTC", "FGTS"]);
  });

  it("acepta un objeto plano como mapa de cotizaciones", () => {
    const v2 = valuePortfolio([assets[0]], { AAA3: q("AAA3", 5, 5) });
    expect(v2.total).toBe(500);
    expect(v2.dayChangePct).toBe(0);
  });

  it("cartera vacía no divide por cero", () => {
    const e = valuePortfolio([], new Map());
    expect(e.total).toBe(0);
    expect(e.dayChangePct).toBeNull();
  });
});

describe("accrueCdi", () => {
  const rates = [
    { date: "2026-11-10", ratePct: 0.05 },
    { date: "2026-11-11", ratePct: 0.05 },
    { date: "2026-11-12", ratePct: 0.05 },
  ];

  it("devenga sólo días posteriores a la fecha base", () => {
    const r = accrueCdi(10_000, "2026-11-10", rates, 100);
    expect(r.days).toBe(2);
    expect(r.value).toBeCloseTo(10_000 * 1.0005 ** 2, 8);
    expect(r.previousValue).toBeCloseTo(10_000 * 1.0005, 8);
    expect(r.asOf).toBe("2026-11-12");
  });

  it("respeta el % del CDI", () => {
    const r = accrueCdi(10_000, "2026-11-09", rates, 110);
    expect(r.value).toBeCloseTo(10_000 * (1 + 0.0005 * 1.1) ** 3, 8);
  });

  it("sin tasas nuevas devuelve el valor base", () => {
    const r = accrueCdi(15_870, "2026-11-14", rates);
    expect(r.value).toBe(15_870);
    expect(r.previousValue).toBeNull();
    expect(r.asOf).toBe("2026-11-14");
  });
});

describe("costo y ganancia (precio medio)", () => {
  const withPm: Asset[] = [
    { ticker: "AAA3", class: "acciones", quantity: 10, avg_price: 20 }, // costo 200
    { ticker: "BBB11", class: "fiis", quantity: 100, avg_price: 9 }, // costo 900
    { ticker: "CCC3", class: "acciones", quantity: 5 }, // sin precio medio
  ];
  const v = valuePortfolio(
    withPm,
    new Map([
      ["AAA3", q("AAA3", 25, 25)], // 250 → +50 (+25%)
      ["BBB11", q("BBB11", 8.1, 8.1)], // 810 → −90 (−10%)
      ["CCC3", q("CCC3", 10, 10)], // 50, fuera del cálculo de ganancia
    ]),
  );

  it("por posición", () => {
    const by = (t: string) => v.positions.find((p) => p.asset.ticker === t)!;
    const a = by("AAA3");
    expect(a.cost).toBe(200);
    expect(a.gain).toBe(50);
    expect(a.gainPct).toBeCloseTo(25, 10);
    expect(by("CCC3").cost).toBeNull();
    expect(by("CCC3").gain).toBeNull();
  });

  it("totales: invertido y ganancia sólo sobre posiciones con precio medio", () => {
    expect(v.invested).toBe(1100);
    expect(v.gain).toBeCloseTo(-40, 10);
    expect(v.gainPct).toBeCloseTo((-40 / 1100) * 100, 10);
    expect(v.total).toBeCloseTo(1110, 10); // incluye CCC3
  });

  it("por clase", () => {
    const acc = v.byClass.find((c) => c.class === "acciones")!;
    expect(acc.cost).toBe(200);
    expect(acc.costedValue).toBe(250);
    expect(acc.gainPct).toBeCloseTo(25, 10);
  });
});

describe("orden", () => {
  it("clases y posiciones de mayor a menor valor; sin cotización al final", () => {
    const v = valuePortfolio(
      [
        { ticker: "CHICO3", class: "acciones", quantity: 1 },
        { ticker: "SINPRECIO3", class: "acciones", quantity: 1 },
        { ticker: "GRANDE11", class: "fiis", quantity: 1 },
      ],
      new Map([
        ["CHICO3", q("CHICO3", 10, 10)],
        ["GRANDE11", q("GRANDE11", 100, 100)],
      ]),
    );
    expect(v.byClass.map((c) => c.class)).toEqual(["fiis", "acciones"]);
    expect(v.positions.map((p) => p.asset.ticker)).toEqual(["GRANDE11", "CHICO3", "SINPRECIO3"]);
    expect(v.missing).toEqual(["SINPRECIO3"]);
  });
});
