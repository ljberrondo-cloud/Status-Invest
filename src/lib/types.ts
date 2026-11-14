export const ASSET_CLASSES = ["acciones", "fiis", "etfs", "cripto", "renta_fija"] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

export const CLASS_LABELS: Record<AssetClass, string> = {
  acciones: "Acciones",
  fiis: "FIIs",
  etfs: "ETFs",
  cripto: "Cripto",
  renta_fija: "Renta fija",
};

export type ProviderName = "brapi" | "coingecko" | "tesouro" | "cdi" | "manual";

/** Una posición tal como figura en data/portfolio.json. */
export interface Asset {
  ticker: string;
  name?: string;
  class: AssetClass;
  quantity: number;
  provider?: ProviderName;
  provider_id?: string;
  cdi_percent?: number;
  manual_value?: number;
  manual_date?: string; // YYYY-MM-DD
  note?: string;
}

export interface Portfolio {
  base_currency?: "BRL";
  assets: Asset[];
}

/**
 * Cotización normalizada que devuelve cualquier proveedor.
 * `price` es el valor en BRL de UNA unidad (para manual/cdi, quantity suele ser 1 y price = valor total).
 */
export interface Quote {
  ticker: string;
  price: number;
  /** Cierre anterior en BRL por unidad, si se conoce. */
  previousClose: number | null;
  /** Variación del día en %, si se conoce. */
  changePct: number | null;
  /** Momento de la cotización (ISO 8601). */
  asOf: string;
  source: string;
  /**
   * market: dato del proveedor · fallback: último snapshot guardado (proveedor caído)
   * manual: valor cargado a mano · accrual: valor calculado (p.ej. CDB que rinde CDI)
   */
  kind: "market" | "fallback" | "manual" | "accrual";
}

export interface ProviderError {
  provider: string;
  message: string;
  tickers: string[];
}

export interface Indicator {
  id: "cdi" | "selic" | "ipca12m" | "ipcaMes" | "usd";
  label: string;
  value: number;
  unit: "% a.a." | "% mes" | "% 12m" | "R$";
  date: string; // YYYY-MM-DD
}

export type PositionStatus = "fresh" | "stale" | "manual" | "missing";

export interface Position {
  asset: Asset;
  quote: Quote | null;
  price: number | null;
  value: number | null;
  /** Variación del día en R$. */
  dayChange: number | null;
  dayChangePct: number | null;
  /** % sobre el patrimonio total. */
  weight: number | null;
  status: PositionStatus;
}

export interface ClassSummary {
  class: AssetClass;
  label: string;
  value: number;
  dayChange: number;
  dayChangePct: number | null;
  weight: number;
  count: number;
}

export interface Valuation {
  total: number;
  dayChange: number;
  dayChangePct: number | null;
  positions: Position[];
  byClass: ClassSummary[];
  missing: string[];
}

export interface PortfolioResponse extends Valuation {
  generatedAt: string;
  indicators: Indicator[];
  errors: ProviderError[];
}

export interface Targets {
  concentration: { max_asset_pct: number; max_class_pct: number };
  allocation: Partial<Record<AssetClass, number>>;
  tolerance_pct: number;
  exclude_from_allocation?: string[];
}

export interface HistoryPoint {
  date: string;
  total: number;
  by_class: Partial<Record<AssetClass, number>>;
}

export interface Snapshot {
  date: string;
  generated_at: string;
  total: number;
  day_change: number;
  by_class: Partial<Record<AssetClass, number>>;
  quotes: Record<string, Quote>;
  indicators: Indicator[];
}

export interface DividendEvent {
  ticker: string;
  /** DIVIDENDO, JCP, RENDIMENTO... */
  label: string;
  /** BRL por unidad (bruto). */
  rate: number;
  /** Fecha "data com" (último día con derecho). YYYY-MM-DD */
  exDate: string | null;
  paymentDate: string | null;
  relatedTo?: string;
}
