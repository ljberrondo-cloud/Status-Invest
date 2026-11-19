import { describe, expect, it } from "vitest";
import { planContribution } from "@/lib/contribution";
import { valuePortfolio } from "@/lib/valuation";
import type { Asset, Quote, Targets } from "@/lib/types";

const q = (ticker: string, price: number): Quote => ({ ticker, price, previousClose: price, changePct: 0, asOf: "", source: "t", kind: "market" });
const targets: Targets = { concentration: { max_asset_pct: 50, max_class_pct: 80 }, allocation: { acciones: 40, fiis: 40, cripto: 10, otros: 10 }, tolerance_pct: 5 };

const assets: Asset[] = [
  { ticker: "AAA3", class: "acciones", quantity: 100, accounts: { c1: { quantity: 100 } } }, // 1.000
  { ticker: "BBB3", class: "acciones", quantity: 10, accounts: { c2: { quantity: 10 } } }, // 100 → muy atrasado
  { ticker: "FII11", class: "fiis", quantity: 40, accounts: { c1: { quantity: 20 }, c2: { quantity: 20 } } }, // 4.000 (34,8% tras el aporte, objetivo 40%)
  { ticker: "BTC", class: "cripto", quantity: 0.01 }, // 3.000 → pasado
  { ticker: "FGTS", class: "otros", quantity: 1, provider: "manual", manual_value: 1900 },
];
const v = valuePortfolio(
  assets,
  new Map([
    ["AAA3", q("AAA3", 10)],
    ["BBB3", q("BBB3", 10)],
    ["FII11", q("FII11", 100)],
    ["BTC", q("BTC", 300000)],
    ["FGTS", { ...q("FGTS", 1900), kind: "manual" as const }],
  ]),
);

describe("dónde invertir el aporte", () => {
  const plan = planContribution(v.positions, targets, [
    { id: "c1", label: "Conta 1", amount: 1000 },
    { id: "c2", label: "Conta 2", amount: 505 },
  ]);

  it("sólo compra activos de la cartera, nunca FGTS, y prioriza los más atrasados", () => {
    // BTC está por encima de su objetivo y FGTS no se compra: nunca aparecen.
    expect(plan.buys.some((b) => b.ticker === "BTC" || b.ticker === "FGTS")).toBe(false);
    expect(plan.buys.every((b) => ["AAA3", "BBB3", "FII11"].includes(b.ticker))).toBe(true);
    const bbb = plan.buys.filter((b) => b.ticker === "BBB3").reduce((s, b) => s + b.amount, 0);
    const aaa = plan.buys.filter((b) => b.ticker === "AAA3").reduce((s, b) => s + b.amount, 0);
    expect(bbb).toBeGreaterThan(aaa);
  });

  it("cuotas enteras y no se gasta más de lo disponible", () => {
    for (const b of plan.buys) expect(Number.isInteger(b.units)).toBe(true);
    expect(plan.invested).toBeLessThanOrEqual(1505);
    expect(plan.invested + Object.values(plan.leftover).reduce((s, x) => s + x, 0)).toBeCloseTo(1505, 6);
    expect(1505 - plan.invested).toBeLessThan(10); // sobra menos que una cuota
  });

  it("asigna a quien ya tiene el activo cuando le alcanza", () => {
    const bbb = plan.buys.filter((b) => b.ticker === "BBB3");
    expect(bbb[0].account).toBe("c2");
    const spent = (id: string) => plan.buys.filter((b) => b.account === id).reduce((s, b) => s + b.amount, 0);
    expect(spent("c1")).toBeLessThanOrEqual(1000 + 1e-6);
    expect(spent("c2")).toBeLessThanOrEqual(505 + 1e-6);
  });

  it("cripto en fracciones y sin aporte no compra nada", () => {
    const onlyCrypto = planContribution(v.positions, { ...targets, allocation: { cripto: 100 } }, [{ id: "c1", label: "Conta 1", amount: 6000 }]);
    expect(onlyCrypto.buys.map((b) => b.ticker)).toEqual(["BTC"]);
    expect(onlyCrypto.buys[0].units).toBeCloseTo(0.02, 8);
    expect(planContribution(v.positions, targets, [{ id: "c1", label: "Conta 1", amount: 0 }]).buys).toEqual([]);
  });

  it("las clases se acercan al objetivo", () => {
    const acc = plan.classesAfter.find((c) => c.class === "acciones")!;
    expect(acc.after).toBeGreaterThan(acc.before);
    expect(Math.abs(acc.after - acc.target)).toBeLessThan(Math.abs(acc.before - acc.target));
  });
});

describe("pesos por activo dentro de la clase", () => {
  it("activos con peso 0 se mantienen pero no reciben aporte", () => {
    const a: Asset[] = [
      { ticker: "BTC", class: "cripto", quantity: 0.01 },
      { ticker: "DOGE", class: "cripto", quantity: 100 },
    ];
    const vv = valuePortfolio(a, new Map([["BTC", q("BTC", 300000)], ["DOGE", q("DOGE", 0.3)]]));
    const t: Targets = { ...targets, allocation: { cripto: 100 }, asset_weights: { cripto: { BTC: 100 } } };
    const p = planContribution(vv.positions, t, [{ id: "c1", label: "Conta 1", amount: 1000 }]);
    expect(p.buys.map((b) => b.ticker)).toEqual(["BTC"]);
  });
});

describe("control por clase", () => {
  it("una clase por encima del objetivo no recibe aportes aunque un activo esté atrasado", () => {
    const a: Asset[] = [
      { ticker: "BIG11", class: "fiis", quantity: 100 }, // 10.000
      { ticker: "SMALL11", class: "fiis", quantity: 1 }, // 100 → atrasado dentro de la clase
      { ticker: "AAA3", class: "acciones", quantity: 100 }, // 1.000
    ];
    const vv = valuePortfolio(a, new Map([["BIG11", q("BIG11", 100)], ["SMALL11", q("SMALL11", 100)], ["AAA3", q("AAA3", 10)]]));
    // FIIs 90% de la cartera con objetivo 50%: el aporte va todo a acciones.
    const p = planContribution(vv.positions, { ...targets, allocation: { fiis: 50, acciones: 50 } }, [{ id: "c1", label: "Conta 1", amount: 1000 }]);
    expect(p.buys.map((b) => b.ticker)).toEqual(["AAA3"]);
  });
});
