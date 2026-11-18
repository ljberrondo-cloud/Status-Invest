export const ASSET_CLASSES = ["acciones", "fiis", "etfs", "cripto", "tesouro", "renta_fija", "fondos", "otros"] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

export const CLASS_LABELS: Record<AssetClass, string> = {
  acciones: "Acciones Brasil",
  fiis: "Fondos Inmobiliarios",
  etfs: "ETFs",
  cripto: "Criptomonedas",
  tesouro: "Tesouro Directo",
  renta_fija: "Renta fija",
  fondos: "Fondos de Inversión",
  otros: "FGTS",
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
  /** Precio medio de compra en BRL por unidad. Permite calcular invertido, ganancia y rentabilidad. */
  avg_price?: number;
  /** Cantidad por cuenta (activos de B3). `quantity` es la suma. */
  accounts?: Record<string, { quantity: number; invested?: number }>;
  manual_value?: number;
  manual_date?: string; // YYYY-MM-DD
  note?: string;
}

export interface Portfolio {
  base_currency?: "BRL";
  /** Hasta qué fecha están aplicadas las posiciones de B3 de cada cuenta. */
  positions_as_of?: Record<string, string>;
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
  id: "cdi" | "selic" | "ipca12m" | "ipcaMes" | "usd" | "usdArs" | "usdArsBlue" | "usdArsMep" | "brlArs";
  label: string;
  value: number;
  unit: "% a.a." | "% mes" | "% 12m" | "R$" | "AR$";
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
  /** Costo = cantidad × precio medio. null si no hay precio medio. */
  cost: number | null;
  /** Ganancia de capital en R$ y % sobre el costo. */
  gain: number | null;
  gainPct: number | null;
}

export interface ClassSummary {
  class: AssetClass;
  label: string;
  value: number;
  dayChange: number;
  dayChangePct: number | null;
  weight: number;
  count: number;
  /** Costo de las posiciones con precio medio, y su valor actual (para comparar en igualdad). */
  cost: number;
  costedValue: number;
  gain: number;
  gainPct: number | null;
}

export interface Valuation {
  total: number;
  dayChange: number;
  dayChangePct: number | null;
  positions: Position[];
  byClass: ClassSummary[];
  missing: string[];
  /** Valor invertido (suma de costos conocidos) y ganancia de capital sobre esas posiciones. */
  invested: number;
  gain: number;
  gainPct: number | null;
}

export interface PortfolioResponse extends Valuation {
  /** Hasta qué fecha están aplicadas las posiciones de B3 de cada cuenta. */
  positionsAsOf?: Record<string, string>;
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
  invested?: number;
  by_class: Partial<Record<AssetClass, number>>;
}

export interface Snapshot {
  date: string;
  generated_at: string;
  total: number;
  invested?: number;
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
