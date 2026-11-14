import type { Asset, DividendEvent, Indicator, ProviderError, Quote } from "@/lib/types";

/** Resultado de un proveedor: nunca lanza, informa errores parciales. */
export interface ProviderResult {
  quotes: Quote[];
  errors: ProviderError[];
}

/**
 * Interfaz común de precios. Para cambiar de proveedor basta con implementar esto
 * y registrarlo en providers/index.ts.
 */
export interface PriceProvider {
  id: string;
  supports(asset: Asset): boolean;
  getQuotes(assets: Asset[]): Promise<ProviderResult>;
}

export interface DividendProvider {
  id: string;
  supports(asset: Asset): boolean;
  getDividends(assets: Asset[]): Promise<{ events: DividendEvent[]; errors: ProviderError[] }>;
}

export interface IndicatorProvider {
  id: string;
  getIndicators(): Promise<{ indicators: Indicator[]; errors: ProviderError[] }>;
}
