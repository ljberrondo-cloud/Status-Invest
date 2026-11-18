import { indicatorProviders, priceProviders, routeAssets, dividendProviders } from "@/providers";
import { errorMessage } from "@/providers/http";
import { loadLatestSnapshot, loadPortfolio } from "./data-files";
import { valuePortfolio } from "./valuation";
import type { Asset, DividendEvent, Indicator, PortfolioResponse, ProviderError, Quote, Snapshot } from "./types";

/**
 * Completa las cotizaciones faltantes con el último snapshot guardado,
 * conservando la fecha original de esa cotización. Nunca inventa precios.
 */
export function applyFallback(assets: Asset[], quotes: Map<string, Quote>, snapshot: Snapshot | null): string[] {
  const used: string[] = [];
  if (!snapshot) return used;
  for (const a of assets) {
    if (quotes.has(a.ticker)) continue;
    const old = snapshot.quotes[a.ticker];
    if (!old) continue;
    quotes.set(a.ticker, { ...old, kind: old.kind === "manual" ? "manual" : "fallback" });
    used.push(a.ticker);
  }
  return used;
}

export async function fetchQuotes(assets: Asset[]): Promise<{ quotes: Map<string, Quote>; errors: ProviderError[] }> {
  const { groups, unsupported } = routeAssets(assets, priceProviders);
  const errors: ProviderError[] = [];
  if (unsupported.length) {
    errors.push({ provider: "config", message: "Ningún proveedor soporta estos activos", tickers: unsupported.map((a) => a.ticker) });
  }
  const results = await Promise.allSettled([...groups].map(([p, list]) => p.getQuotes(list)));
  const quotes = new Map<string, Quote>();
  const entries = [...groups];
  results.forEach((r, i) => {
    const [provider, list] = entries[i];
    if (r.status === "fulfilled") {
      for (const q of r.value.quotes) quotes.set(q.ticker, q);
      errors.push(...r.value.errors);
    } else {
      errors.push({ provider: provider.id, message: errorMessage(r.reason), tickers: list.map((a) => a.ticker) });
    }
  });
  return { quotes, errors };
}

async function safeIndicators(): Promise<{ indicators: Indicator[]; errors: ProviderError[] }> {
  const results = await Promise.allSettled(indicatorProviders.map((p) => p.getIndicators()));
  const indicators: Indicator[] = [];
  const errors: ProviderError[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      indicators.push(...r.value.indicators);
      errors.push(...r.value.errors);
    } else errors.push({ provider: indicatorProviders[i].id, message: errorMessage(r.reason), tickers: [] });
  });
  return { indicators, errors };
}

export async function getPortfolioData(): Promise<PortfolioResponse> {
  const [portfolio, snapshot] = await Promise.all([loadPortfolio(), loadLatestSnapshot().catch(() => null)]);
  const [{ quotes, errors }, ind] = await Promise.all([fetchQuotes(portfolio.assets), safeIndicators()]);
  applyFallback(portfolio.assets, quotes, snapshot);
  const valuation = valuePortfolio(portfolio.assets, quotes);
  const got = new Set(ind.indicators.map((i) => i.id));
  const indicators = [...ind.indicators, ...(snapshot?.indicators ?? []).filter((i) => !got.has(i.id))];
  return {
    ...valuation,
    generatedAt: new Date().toISOString(),
    indicators,
    errors: [...errors, ...ind.errors],
  };
}

export async function getDividendEvents(): Promise<{ assets: Asset[]; events: DividendEvent[]; errors: ProviderError[] }> {
  const { assets } = await loadPortfolio();
  const events: DividendEvent[] = [];
  const errors: ProviderError[] = [];
  for (const p of dividendProviders) {
    const list = assets.filter((a) => p.supports(a));
    try {
      const r = await p.getDividends(list);
      events.push(...r.events);
      errors.push(...r.errors);
    } catch (e) {
      errors.push({ provider: p.id, message: errorMessage(e), tickers: list.map((a) => a.ticker) });
    }
  }
  return { assets, events, errors };
}
