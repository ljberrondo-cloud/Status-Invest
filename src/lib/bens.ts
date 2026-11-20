/**
 * Bienes fuera de la cartera (casa, autos): suman al patrimonio total pero no tienen meta ni entran en la
 * rentabilidad. Valor = promedio entre la tabla FIPE y la mediana de los anuncios del mercado; sin FIPE
 * (inmuebles), la mediana del R$/m² de los anuncios comparables × el área propia.
 */

export interface MarketListing {
  price: number;
  area_m2?: number;
  source: string;
}

export interface Bem {
  id: string;
  kind: "imovel" | "veiculo";
  name: string;
  details?: string;
  area_m2?: number;
  fipe?: { value: number; ref: string; source: string };
  market: MarketListing[];
  note?: string;
}

export interface BensFile {
  as_of: string;
  items: Bem[];
}

export interface BemValue extends Bem {
  /** Mediana de los anuncios (precio, o R$/m² × área si es inmueble con áreas). */
  marketValue: number | null;
  value: number;
  method: string;
}

export function median(xs: number[]): number | null {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

const round = (n: number) => Math.round(n);

export function valueBem(b: Bem): BemValue {
  const withArea = b.area_m2 ? b.market.filter((l) => l.area_m2 && l.area_m2 > 0) : [];
  const perM2 = withArea.length ? median(withArea.map((l) => l.price / l.area_m2!)) : null;
  const marketValue = perM2 !== null && b.area_m2 ? round(perM2 * b.area_m2) : (() => {
    const m = median(b.market.map((l) => l.price));
    return m === null ? null : round(m);
  })();
  if (b.fipe && marketValue !== null) return { ...b, marketValue, value: round((b.fipe.value + marketValue) / 2), method: "Média entre FIPE e mediana do mercado" };
  if (b.fipe) return { ...b, marketValue, value: b.fipe.value, method: "Tabela FIPE" };
  return { ...b, marketValue, value: marketValue ?? 0, method: perM2 !== null ? "Mediana do R$/m² dos anúncios × área" : "Mediana dos anúncios" };
}
