/** Diagnóstico de la cartera (números en vivo) para la sección de estrategia. */
import { allocationVsTarget } from "./alerts";
import type { Targets, Valuation } from "./types";

export interface Diagnosis {
  total: number;
  /** Activos que no se pueden mover libremente: FGTS y previdencia. */
  lockedPct: number;
  previdenciaPct: number;
  fgtsPct: number;
  /** Mayor posición individual. */
  topAsset: { ticker: string; name?: string; pct: number } | null;
  cryptoPct: number;
  /** Parte del cripto en monedas distintas de BTC/ETH. */
  altcoinShareOfCrypto: number;
  /** Exposición a dólar: ETFs internacionales + cripto. */
  foreignPct: number;
  /** Clases por debajo del objetivo (en R$ a completar sin vender) y por encima. */
  under: { label: string; gap: number; currentPct: number; targetPct: number }[];
  over: { label: string; excess: number; currentPct: number; targetPct: number }[];
  /** Meses de aporte para completar las clases atrasadas sin vender. */
  monthsToBalance: (monthly: number) => number;
  /** Mayores pérdidas sobre el precio medio. */
  worst: { ticker: string; gainPct: number; value: number }[];
}

export function diagnose(v: Valuation, t: Targets): Diagnosis {
  const total = v.total || 1;
  const pct = (x: number) => (x / total) * 100;
  const cls = (c: string) => v.byClass.find((x) => x.class === c)?.value ?? 0;
  const crypto = v.positions.filter((p) => p.asset.class === "cripto");
  const cryptoVal = crypto.reduce((s, p) => s + (p.value ?? 0), 0);
  const alt = crypto.filter((p) => !["BTC", "ETH"].includes(p.asset.ticker)).reduce((s, p) => s + (p.value ?? 0), 0);
  const top = [...v.positions].filter((p) => p.value !== null).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
  const { rows } = allocationVsTarget(v, t);
  const under = rows.filter((r) => r.rebalance > 1 && r.class !== "otros").map((r) => ({ label: r.label, gap: r.rebalance, currentPct: r.currentPct, targetPct: r.targetPct }));
  const over = rows.filter((r) => r.rebalance < -1).map((r) => ({ label: r.label, excess: -r.rebalance, currentPct: r.currentPct, targetPct: r.targetPct }));
  const gapSum = under.reduce((s, u) => s + u.gap, 0);
  return {
    total: v.total,
    lockedPct: pct(cls("fondos") + cls("otros")),
    previdenciaPct: pct(cls("fondos")),
    fgtsPct: pct(cls("otros")),
    topAsset: top ? { ticker: top.asset.ticker, name: top.asset.name, pct: pct(top.value ?? 0) } : null,
    cryptoPct: pct(cryptoVal),
    altcoinShareOfCrypto: cryptoVal > 0 ? (alt / cryptoVal) * 100 : 0,
    foreignPct: pct(cls("etfs") + cryptoVal),
    under: under.sort((a, b) => b.gap - a.gap),
    over: over.sort((a, b) => b.excess - a.excess),
    monthsToBalance: (monthly: number) => (monthly > 0 ? Math.ceil(gapSum / monthly) : Infinity),
    worst: v.positions
      .filter((p) => p.gainPct !== null && (p.value ?? 0) > 0)
      .sort((a, b) => (a.gainPct ?? 0) - (b.gainPct ?? 0))
      .slice(0, 4)
      .map((p) => ({ ticker: p.asset.ticker, gainPct: p.gainPct as number, value: p.value as number })),
  };
}
