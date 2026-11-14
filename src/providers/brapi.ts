import { config, QUOTES_TAG, SLOW_TAG } from "@/lib/config";
import { isoDateSP } from "@/lib/dates";
import type { Asset, DividendEvent, ProviderError, Quote } from "@/lib/types";
import { errorMessage, fetchJson } from "./http";
import type { DividendProvider, PriceProvider, ProviderResult } from "./types";

const BASE = "https://brapi.dev/api/quote";

interface BrapiQuote {
  symbol: string;
  regularMarketPrice?: number | null;
  regularMarketPreviousClose?: number | null;
  regularMarketChangePercent?: number | null;
  regularMarketTime?: string | null;
  dividendsData?: { cashDividends?: BrapiCashDividend[] } | null;
}

interface BrapiCashDividend {
  assetIssued?: string;
  paymentDate?: string | null;
  rate?: number;
  relatedTo?: string;
  label?: string;
  lastDatePrior?: string | null;
}

interface BrapiResponse {
  results?: BrapiQuote[];
  error?: boolean;
  message?: string;
}

const isB3 = (a: Asset) => (a.provider ? a.provider === "brapi" : ["acciones", "fiis", "etfs"].includes(a.class));

function headers(): Record<string, string> {
  const token = config.brapiToken;
  return token ? { authorization: `Bearer ${token}` } : {};
}

export function mapBrapiQuote(r: BrapiQuote): Quote | null {
  const price = r.regularMarketPrice;
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) return null;
  const prev = r.regularMarketPreviousClose ?? null;
  const pct =
    r.regularMarketChangePercent ?? (prev && prev > 0 ? ((price - prev) / prev) * 100 : null);
  return {
    ticker: r.symbol.toUpperCase(),
    price,
    previousClose: typeof prev === "number" && prev > 0 ? prev : null,
    changePct: typeof pct === "number" && Number.isFinite(pct) ? pct : null,
    asOf: r.regularMarketTime ?? new Date().toISOString(),
    source: "brapi",
    kind: "market",
  };
}

async function requestQuotes(tickers: string[], extra = ""): Promise<BrapiQuote[]> {
  const url = `${BASE}/${tickers.map(encodeURIComponent).join(",")}${extra}`;
  const json = await fetchJson<BrapiResponse>(url, {
    revalidate: extra ? config.slowRevalidate : config.quotesRevalidate,
    tags: extra ? [SLOW_TAG, "brapi-dividends"] : [QUOTES_TAG, "brapi"],
    headers: headers(),
  });
  if (json.error || !json.results) throw new Error(json.message ?? "Respuesta inválida de brapi");
  return json.results;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Pide en lotes; si un lote falla (p.ej. plan que limita tickers por request), reintenta de a uno. */
async function fetchAll(tickers: string[], extra = "") {
  const ok: BrapiQuote[] = [];
  const failed: { ticker: string; message: string }[] = [];
  for (const batch of chunk(tickers, config.brapiBatchSize)) {
    try {
      ok.push(...(await requestQuotes(batch, extra)));
    } catch (batchErr) {
      if (batch.length === 1) {
        failed.push({ ticker: batch[0], message: errorMessage(batchErr) });
        continue;
      }
      const single = await Promise.allSettled(batch.map((t) => requestQuotes([t], extra)));
      single.forEach((r, i) => {
        if (r.status === "fulfilled") ok.push(...r.value);
        else failed.push({ ticker: batch[i], message: errorMessage(r.reason) });
      });
    }
  }
  return { ok, failed };
}

function groupErrors(provider: string, failed: { ticker: string; message: string }[]): ProviderError[] {
  const byMsg = new Map<string, string[]>();
  for (const f of failed) byMsg.set(f.message, [...(byMsg.get(f.message) ?? []), f.ticker]);
  return [...byMsg].map(([message, tickers]) => ({ provider, message, tickers }));
}

export const brapiProvider: PriceProvider = {
  id: "brapi",
  supports: isB3,
  async getQuotes(assets): Promise<ProviderResult> {
    const tickers = [...new Set(assets.map((a) => a.ticker.toUpperCase()))];
    if (!tickers.length) return { quotes: [], errors: [] };
    const { ok, failed } = await fetchAll(tickers);
    const quotes: Quote[] = [];
    for (const r of ok) {
      const q = mapBrapiQuote(r);
      if (q) quotes.push(q);
    }
    const got = new Set(quotes.map((q) => q.ticker));
    const noPrice = tickers.filter((t) => !got.has(t) && !failed.some((f) => f.ticker === t));
    const errors = groupErrors("brapi", failed);
    if (noPrice.length) errors.push({ provider: "brapi", message: "Sin cotización en la respuesta", tickers: noPrice });
    return { quotes, errors };
  },
};

export function mapBrapiDividends(r: BrapiQuote): DividendEvent[] {
  const list = r.dividendsData?.cashDividends ?? [];
  return list
    .filter((d) => typeof d.rate === "number" && d.rate > 0)
    .map((d) => ({
      ticker: r.symbol.toUpperCase(),
      label: (d.label ?? "PROVENTO").toUpperCase(),
      rate: d.rate as number,
      exDate: d.lastDatePrior ? isoDateSP(d.lastDatePrior) : null,
      paymentDate: d.paymentDate ? isoDateSP(d.paymentDate) : null,
      relatedTo: d.relatedTo,
    }));
}

export const brapiDividendProvider: DividendProvider = {
  id: "brapi",
  supports: (a) => isB3(a) && (a.class === "acciones" || a.class === "fiis"),
  async getDividends(assets) {
    const tickers = [...new Set(assets.map((a) => a.ticker.toUpperCase()))];
    if (!tickers.length) return { events: [], errors: [] };
    const { ok, failed } = await fetchAll(tickers, "?dividends=true");
    return { events: ok.flatMap(mapBrapiDividends), errors: groupErrors("brapi (proventos)", failed) };
  },
};
