import { classPctOfInvestable, investableBase, isExcluded } from "./alerts";
import { loadReceived, loadTargets } from "./data-files";
import { isoDateSP } from "./dates";
import { incomeStats } from "./income-stats";
import { getPortfolioData } from "./portfolio-service";
import { buildSignal, type SignalResult } from "./signals";
import { summarize, type TechSummary } from "./technical";
import { CLASS_LABELS, type AssetClass, type ProviderError } from "./types";
import { b3History, cryptoHistory, type PriceHistory } from "@/providers/history";
import { errorMessage, HttpError } from "@/providers/http";

export interface AnalysisRow extends SignalResult {
  ticker: string;
  name: string;
  cls: AssetClass;
  classLabel: string;
  value: number | null;
  price: number | null;
  indicators: Pick<TechSummary, "rsi" | "trend" | "ret1m" | "retPeriod" | "points" | "fromHigh"> | null;
  pe: number | null;
  dy: number | null;
  /** Cierres para el minigráfico (hasta 60 puntos). */
  spark: number[];
  /** "3 meses" (B3) o "1 año" (cripto). */
  period: string | null;
  /** Fecha del último cierre usado. */
  asOf: string | null;
}

export interface AnalysisResponse {
  rows: AnalysisRow[];
  errors: ProviderError[];
  generatedAt: string;
}

const B3_CLASSES: AssetClass[] = ["acciones", "fiis", "etfs"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Reintenta ante 429 (límite de pedidos), esperando cada vez más. */
async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= tries - 1 || !(e instanceof HttpError && e.status === 429)) throw e;
      await sleep(1500 * (i + 1) * (i + 1));
    }
  }
}

function downsample(v: number[], n = 60): number[] {
  if (v.length <= n) return v;
  const step = (v.length - 1) / (n - 1);
  return Array.from({ length: n }, (_, i) => v[Math.round(i * step)]);
}

export async function getAnalysis(): Promise<AnalysisResponse> {
  const [data, targets, received] = await Promise.all([getPortfolioData(), loadTargets(), loadReceived()]);
  const today = isoDateSP();
  const payments = received?.payments ?? [];
  const classPct = targets ? classPctOfInvestable(data, targets) : {};
  const base = targets ? investableBase(data, targets) : data.total;
  const errors: ProviderError[] = [];

  // Un pedido a la vez por proveedor (brapi gratis no acepta simultáneos; CoinGecko limita por minuto).
  const kind = (p: (typeof data.positions)[number]) => {
    const a = p.asset;
    if (a.provider ? a.provider === "brapi" : B3_CLASSES.includes(a.class)) return "brapi" as const;
    if (a.provider ? a.provider === "coingecko" : a.class === "cripto") return "coingecko" as const;
    return null;
  };
  const histories = new Map<string, PriceHistory>();
  const queue = async (provider: "brapi" | "coingecko") => {
    for (const p of data.positions.filter((x) => kind(x) === provider)) {
      const a = p.asset;
      try {
        histories.set(a.ticker, await withRetry(() => (provider === "brapi" ? b3History(a.ticker) : cryptoHistory((a.provider_id ?? a.ticker).toLowerCase()))));
      } catch (e) {
        errors.push({ provider, message: `Historial: ${errorMessage(e)}`, tickers: [a.ticker] });
      }
    }
  };
  await Promise.all([queue("brapi"), queue("coingecko")]);

  const rows = data.positions.map((p): AnalysisRow => {
    const a = p.asset;
    const h = histories.get(a.ticker) ?? null;
    const closes = h?.closes.map((c) => c.close) ?? [];
    const tech = summarize(closes);
    const excluded = targets ? isExcluded(a.ticker, targets) : false;
    const income = incomeStats(payments, a.ticker, p.price, today, a.class === "fiis");
    const target = targets?.allocation[a.class];
    const cur = classPct[a.class];
    const sig = buildSignal({
      cls: a.class,
      excluded,
      tech,
      pe: h?.pe ?? null,
      low52: h?.low52 ?? null,
      high52: h?.high52 ?? null,
      price: p.price,
      dy: income.dy,
      incomeTrend: income.trend,
      weight: p.value !== null && base > 0 && !excluded ? (p.value / base) * 100 : null,
      maxAssetPct: targets?.concentration.max_asset_pct ?? 100,
      classGap: target !== undefined && cur != null ? cur - target : null,
      tolerance: targets?.tolerance_pct ?? 5,
    });
    return {
      ...sig,
      ticker: a.ticker,
      name: a.name ?? a.ticker,
      cls: a.class,
      classLabel: CLASS_LABELS[a.class],
      value: p.value,
      price: p.price,
      indicators: tech ? { rsi: tech.rsi, trend: tech.trend, ret1m: tech.ret1m, retPeriod: tech.retPeriod, points: tech.points, fromHigh: tech.fromHigh } : null,
      pe: h?.pe ?? null,
      dy: income.dy,
      spark: downsample(closes),
      period: h ? (h.source === "coingecko" ? "1 año" : "3 meses") : null,
      asOf: h?.closes.at(-1)?.date ?? null,
    };
  });
  rows.sort((x, y) => (y.value ?? 0) - (x.value ?? 0));
  return { rows, errors, generatedAt: new Date().toISOString() };
}
