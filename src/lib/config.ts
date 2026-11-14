function intEnv(name: string, def: number, min: number, max: number): number {
  const n = Number(process.env[name]);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export const config = {
  /** Caché de precios de mercado (brapi, CoinGecko). Entre 1 y 6 h. */
  get quotesRevalidate() {
    return intEnv("QUOTES_REVALIDATE_SECONDS", 3600, 3600, 21600);
  },
  /** Caché de datos lentos (BCB, Tesouro, proventos). */
  get slowRevalidate() {
    return intEnv("SLOW_REVALIDATE_SECONDS", 21600, 3600, 21600);
  },
  get brapiToken() {
    return process.env.BRAPI_TOKEN?.trim() || undefined;
  },
  get brapiBatchSize() {
    return intEnv("BRAPI_BATCH_SIZE", 10, 1, 20);
  },
  get coingeckoKey() {
    return process.env.COINGECKO_API_KEY?.trim() || undefined;
  },
};

/** Tag común de todas las cotizaciones: el botón "Actualizar" lo invalida. */
export const QUOTES_TAG = "quotes";
