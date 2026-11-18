import type { Asset } from "@/lib/types";
import { bcbCdiProvider, bcbIndicatorProvider } from "./bcb";
import { brapiDividendProvider, brapiProvider } from "./brapi";
import { coingeckoProvider } from "./coingecko";
import { dolarApiProvider } from "./dolarapi";
import { manualProvider } from "./manual";
import { tesouroProvider } from "./tesouro";
import type { DividendProvider, IndicatorProvider, PriceProvider } from "./types";

/** Registro de proveedores. El orden importa: el primero que soporta un activo lo cotiza. */
export const priceProviders: PriceProvider[] = [manualProvider, bcbCdiProvider, tesouroProvider, coingeckoProvider, brapiProvider];
export const dividendProviders: DividendProvider[] = [brapiDividendProvider];
/** Tasas de Brasil (BCB) y cotizaciones del peso argentino (DolarAPI). */
export const indicatorProviders: IndicatorProvider[] = [bcbIndicatorProvider, dolarApiProvider];

export function routeAssets(assets: Asset[], providers: PriceProvider[] = priceProviders) {
  const groups = new Map<PriceProvider, Asset[]>();
  const unsupported: Asset[] = [];
  for (const a of assets) {
    const p = providers.find((p) => p.supports(a));
    if (!p) unsupported.push(a);
    else groups.set(p, [...(groups.get(p) ?? []), a]);
  }
  return { groups, unsupported };
}

export type { DividendProvider, IndicatorProvider, PriceProvider } from "./types";
