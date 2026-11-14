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
