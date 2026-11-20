import { describe, expect, it } from "vitest";
import { allocationVsTarget, computeAlerts } from "@/lib/alerts";
import { dividendsInRange } from "@/lib/dividends";
import { weekRange } from "@/lib/dates";
import { valuePortfolio } from "@/lib/valuation";
import type { Asset, Quote, Targets } from "@/lib/types";

const mk = (ticker: string, price: number): Quote => ({ ticker, price, previousClose: price, changePct: 0, asOf: "", source: "t", kind: "market" });

const assets: Asset[] = [
  { ticker: "AAA3", class: "acciones", quantity: 1 },
  { ticker: "BBB11", class: "fiis", quantity: 1 },
  { ticker: "CCC11", class: "fiis", quantity: 1 },
  { ticker: "FGTS", class: "renta_fija", quantity: 1, provider: "manual" },
];
const v = valuePortfolio(
  assets,
  new Map([
    ["AAA3", mk("AAA3", 500)],
    ["BBB11", mk("BBB11", 200)],
    ["CCC11", mk("CCC11", 100)],
    ["FGTS", { ...mk("FGTS", 200), kind: "manual" as const }],
  ]),
);
const targets: Targets = {
  concentration: { max_asset_pct: 40, max_class_pct: 45 },
  allocation: { acciones: 50, fiis: 50 },
  tolerance_pct: 5,
  exclude_from_allocation: ["FGTS"],
};

describe("alertas", () => {
  it("detecta concentración por activo y por clase", () => {
    const alerts = computeAlerts(v, targets);
    expect(alerts.map((a) => a.id)).toContain("asset-AAA3"); // 50%
    expect(alerts.map((a) => a.id)).toContain("class-acciones"); // 50% > 45%
    expect(alerts.map((a) => a.id)).not.toContain("class-fiis"); // 30%
  });

  it("asignación excluye FGTS de la base y calcula rebalanceo", () => {
    const { base, rows } = allocationVsTarget(v, targets);
    expect(base).toBe(800);
    const acc = rows.find((r) => r.class === "acciones")!;
    expect(acc.currentPct).toBeCloseTo(62.5, 10);
    expect(acc.deviation).toBeCloseTo(12.5, 10);
    expect(acc.rebalance).toBeCloseTo(-100, 10);
    expect(acc.outOfBand).toBe(true);
    const fiis = rows.find((r) => r.class === "fiis")!;
    expect(fiis.rebalance).toBeCloseTo(100, 10);
  });

  it("clases con objetivo pero sin posición aparecen con 0%", () => {
    const { rows } = allocationVsTarget(v, { ...targets, allocation: { ...targets.allocation, cripto: 10 } });
    expect(rows.find((r) => r.class === "cripto")?.currentPct).toBe(0);
  });
});

describe("proventos", () => {
  it("filtra por semana y estima monto = tasa × cantidad", () => {
    const { start, end } = weekRange("2026-11-14"); // sábado
    expect(start).toBe("2026-11-09");
    expect(end).toBe("2026-11-15");
    const rows = dividendsInRange(
      [
        { ticker: "BBB11", label: "RENDIMENTO", rate: 0.1, exDate: "2026-10-31", paymentDate: "2026-11-13" },
        { ticker: "AAA3", label: "JCP", rate: 0.5, exDate: "2026-11-10", paymentDate: "2026-12-20" },
        { ticker: "AAA3", label: "JCP", rate: 0.5, exDate: "2026-11-10", paymentDate: "2026-12-20" }, // duplicado
        { ticker: "CCC11", label: "RENDIMENTO", rate: 1, exDate: "2026-11-30", paymentDate: "2026-12-12" },
      ],
      [
        { ticker: "BBB11", class: "fiis", quantity: 1021 },
        { ticker: "AAA3", class: "acciones", quantity: 94 },
      ],
      start,
      end,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].ticker).toBe("AAA3");
    expect(rows[0].estimated).toBeCloseTo(47, 10);
    expect(rows[0].date).toBe("2026-11-10");
    expect(rows[1].estimated).toBeCloseTo(102.1, 10);
  });
});

import { assetTargets } from "@/lib/alerts";
describe("% ideal por activo", () => {
  it("objetivo de la clase ÷ cantidad de activos, y 'comprar' si pesa menos", () => {
    const t = assetTargets(v, targets);
    // fiis 50% de lo invertible (sin FGTS = 800 de 1.000) / 2 activos = 25% de lo invertible = 20% del total
    expect(t.BBB11.idealPct).toBeCloseTo(20, 10);
    expect(t.FGTS.idealPct).toBe(0);
    expect(t.CCC11.buy).toBe(true); // pesa 10%
    expect(t.AAA3.idealPct).toBeCloseTo(40, 10);
    expect(t.AAA3.buy).toBe(false); // pesa 50%
  });
});

import { classPctOfInvestable, investableBase } from "@/lib/alerts";
import { planContribution } from "@/lib/contribution";
describe("activos excluidos (previdencia de empresa)", () => {
  const tx: Targets = { ...targets, concentration: { max_asset_pct: 60, max_class_pct: 70 }, exclude_from_allocation: ["FGTS"] };
  it("no generan alertas, no tienen objetivo y no reciben aportes", () => {
    expect(investableBase(v, tx)).toBe(800);
    const pct = classPctOfInvestable(v, tx);
    expect(pct.renta_fija).toBeNull(); // la clase de FGTS en este ejemplo
    expect(pct.acciones).toBeCloseTo(62.5, 10);
    expect(computeAlerts(v, tx).some((a) => a.id.includes("FGTS") || a.id.includes("renta_fija"))).toBe(false);
    const plan = planContribution(v.positions, { ...tx, allocation: { acciones: 50, fiis: 50, renta_fija: 50 } }, [{ id: "conta-1", label: "Conta 1", amount: 300 }]);
    expect(plan.buys.some((b) => b.ticker === "FGTS")).toBe(false);
    expect(plan.classesAfter.some((c) => c.class === "renta_fija")).toBe(false);
  });
});
