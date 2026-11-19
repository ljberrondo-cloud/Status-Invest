/**
 * Historial de precios diarios y datos fundamentales básicos para el análisis.
 * brapi (plan gratis): hasta 3 meses de cierres + P/L, LPA y rango de 52 semanas.
 * CoinGecko: 1 año de cierres en reales.
 */
import { config, SLOW_TAG } from "@/lib/config";
import { brapiHeaders } from "./brapi";
import { fetchJson } from "./http";

export interface PriceHistory {
  closes: { date: string; close: number }[];
  pe: number | null;
  low52: number | null;
  high52: number | null;
  source: "brapi" | "coingecko";
}

interface BrapiHist {
  results?: {
    priceEarnings?: number | null;
    fiftyTwoWeekLow?: number | null;
    fiftyTwoWeekHigh?: number | null;
    historicalDataPrice?: { date: number; close: number | null }[] | null;
  }[];
}

const finite = (n: unknown): number | null => (typeof n === "number" && Number.isFinite(n) ? n : null);
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export async function b3History(ticker: string): Promise<PriceHistory> {
  const j = await fetchJson<BrapiHist>(`https://brapi.dev/api/quote/${encodeURIComponent(ticker)}?range=3mo&interval=1d&fundamental=true`, {
    revalidate: config.slowRevalidate,
    tags: [SLOW_TAG, "brapi-history"],
    headers: brapiHeaders(),
  });
  const r = j.results?.[0];
  if (!r) throw new Error("Sem dados");
  const closes = (r.historicalDataPrice ?? [])
    .filter((p) => typeof p.close === "number" && p.close > 0)
    .map((p) => ({ date: day(p.date * 1000), close: p.close as number }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return { closes, pe: finite(r.priceEarnings), low52: finite(r.fiftyTwoWeekLow), high52: finite(r.fiftyTwoWeekHigh), source: "brapi" };
}

export async function cryptoHistory(coinId: string): Promise<PriceHistory> {
  const key = config.coingeckoKey;
  const j = await fetchJson<{ prices?: [number, number][] }>(
    `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=brl&days=365&interval=daily`,
    { revalidate: config.slowRevalidate, tags: [SLOW_TAG, "coingecko-history"], headers: key ? { "x-cg-demo-api-key": key } : undefined },
  );
  // Un punto por día (el último del día gana: CoinGecko agrega el precio actual al final).
  const byDay = new Map<string, number>();
  for (const [t, p] of j.prices ?? []) if (p > 0) byDay.set(day(t), p);
  const closes = [...byDay].map(([date, close]) => ({ date, close })).sort((a, b) => a.date.localeCompare(b.date));
  const last365 = closes.map((c) => c.close);
  return {
    closes,
    pe: null,
    low52: last365.length ? Math.min(...last365) : null,
    high52: last365.length ? Math.max(...last365) : null,
    source: "coingecko",
  };
}
