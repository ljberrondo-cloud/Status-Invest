import { describe, expect, it } from "vitest";
import { summarizeByAccount, UNASSIGNED } from "@/lib/by-account";
import { valuePortfolio } from "@/lib/valuation";
import type { Asset, Quote } from "@/lib/types";

const q = (ticker: string, price: number): Quote => ({ ticker, price, previousClose: price, changePct: 0, asOf: "", source: "t", kind: "market" });
const ACC = [
  { id: "mi-cuenta", label: "Mi Cuenta" },
  { id: "esposa", label: "Esposa" },
] as const;

describe("patrimonio por cuenta", () => {
  const assets: Asset[] = [
    { ticker: "HFOF11", class: "fiis", quantity: 100, avg_price: 5, accounts: { "mi-cuenta": { quantity: 40 }, esposa: { quantity: 60 } } },
    { ticker: "BBAS3", class: "acciones", quantity: 10, avg_price: 20, accounts: { "mi-cuenta": { quantity: 10 } } },
    { ticker: "SELIC2031", class: "tesouro", quantity: 1, avg_price: 9000, accounts: { esposa: { quantity: 1, invested: 9500 } } },
    { ticker: "BTC", class: "cripto", quantity: 1, avg_price: 300, owner: "mi-cuenta" },
    { ticker: "FGTS", class: "otros", quantity: 1, provider: "manual", manual_value: 1000 },
  ];
  const v = valuePortfolio(
    assets,
    new Map([
      ["HFOF11", q("HFOF11", 6)],
      ["BBAS3", q("BBAS3", 15)],
      ["SELIC2031", q("SELIC2031", 10000)],
      ["BTC", q("BTC", 400)],
      ["FGTS", { ...q("FGTS", 1000), kind: "manual" as const }],
    ]),
  );
  const s = summarizeByAccount(v.positions, ACC);

  it("reparte por cantidad de cada cuenta y respeta owner", () => {
    expect(s.map((a) => [a.id, a.count, a.value])).toEqual([
      ["mi-cuenta", 3, 240 + 150 + 400],
      ["esposa", 2, 360 + 10000],
      [UNASSIGNED, 1, 1000],
    ]);
  });

  it("invertido por cuenta: cantidad × precio medio, Tesouro con su valor aplicado", () => {
    const mi = s.find((a) => a.id === "mi-cuenta")!;
    expect(mi.invested).toBe(40 * 5 + 10 * 20 + 300);
    expect(mi.gain).toBeCloseTo(790 - 700, 10);
    const esposa = s.find((a) => a.id === "esposa")!;
    expect(esposa.invested).toBe(60 * 5 + 9500);
  });

  it("los porcentajes suman 100 y el total cuadra con la cartera", () => {
    expect(s.reduce((t, a) => t + a.weight, 0)).toBeCloseTo(100, 10);
    expect(s.reduce((t, a) => t + a.value, 0)).toBeCloseTo(v.total, 8);
  });
});
