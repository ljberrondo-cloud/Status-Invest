/**
 * Posiciones por cuenta a partir del relatório consolidado mensual de B3.
 *
 * Cada activo de B3 (acciones, FIIs, ETFs, Tesouro) guarda cuánto tiene cada cuenta (`accounts`);
 * la cantidad total es la suma. Al llegar un relatório mensual más nuevo que lo que hay, se reemplaza la
 * posición de esa cuenta, se actualiza el precio medio con las compras del mes y se agregan activos nuevos.
 * Cripto, previdencia, FGTS y CDB no están en B3: siguen siendo manuales.
 */
import type { Sheet } from "./b3-xlsx";
import { brToIso } from "./dates";
import type { Asset, AssetClass, Portfolio } from "./types";

export interface AccountPosition {
  ticker: string;
  name?: string;
  class: AssetClass;
  quantity: number;
  /** Tesouro: "Tipo;DD/MM/AAAA" como en el CSV de Tesouro Transparente. */
  tesouroId?: string;
  /** Tesouro: valor aplicado (costo) informado por B3. */
  invested?: number;
}

export interface Trade {
  ticker: string;
  buyQty: number;
  sellQty: number;
  buyAvg: number;
  /** Primera operación del período (YYYY-MM-DD): las anteriores a lo ya aplicado se ignoran. */
  from?: string;
}

/** data/b3/<cuenta>/posicion-AAAA-MM.json */
export interface PositionFile {
  account: string;
  asOf: string; // último día del mes del relatório
  positions: AccountPosition[];
  trades: Trade[];
}

const MONTHS: Record<string, string> = {
  janeiro: "01", fevereiro: "02", marco: "03", abril: "04", maio: "05", junho: "06",
  julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
};
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() && v.trim() !== "-" ? Number(v.replace(/\./g, "").replace(",", ".")) : NaN);

/** "relatorio-consolidado-mensal-2026-outubro.xlsx" → "2026-10-31" */
export function monthEndFromName(name: string): string | null {
  const m = plain(name).match(/mensal[^0-9]*(\d{4})[^a-z]*([a-z]+)/);
  if (!m || !MONTHS[m[2]]) return null;
  const y = Number(m[1]);
  const mo = Number(MONTHS[m[2]]);
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return `${y}-${MONTHS[m[2]]}-${String(last).padStart(2, "0")}`;
}

/** Mercado fraccionario: "VALE3F" es VALE3. */
export const baseTicker = (t: string) => t.trim().toUpperCase().replace(/^([A-Z]{4}\d{1,2})F$/, "$1");

const SHEET_CLASS: [RegExp, AssetClass][] = [
  [/^posicao - acoes$/, "acciones"],
  [/^posicao - emprestimos$/, "acciones"],
  [/^posicao - etf$/, "etfs"],
  [/^posicao - fundos$/, "fiis"],
  [/^posicao - bdr$/, "acciones"],
];

export function parsePositions(sheets: Sheet[], account: string, fileName: string): PositionFile | null {
  const asOf = monthEndFromName(fileName);
  if (!asOf) return null;
  const byTicker = new Map<string, AccountPosition>();
  const add = (p: AccountPosition) => {
    const prev = byTicker.get(p.ticker);
    if (prev) {
      prev.quantity += p.quantity;
      if (p.invested !== undefined) prev.invested = (prev.invested ?? 0) + p.invested;
    } else byTicker.set(p.ticker, { ...p });
  };

  for (const s of sheets) {
    const name = plain(s.name);
    const cls = SHEET_CLASS.find(([re]) => re.test(name))?.[1];
    if (cls) {
      for (const r of s.rows) {
        const produto = typeof r["Produto"] === "string" ? r["Produto"] : "";
        const code = String(r["Código de Negociação"] ?? produto.split(" - ")[0] ?? "").trim();
        const q = num(r["Quantidade"]);
        if (!/^[A-Z]{4}\d{1,2}F?$/.test(code) || !Number.isFinite(q) || q <= 0) continue;
        // Empréstimos: sólo cuenta lo prestado (doador), que sigue siendo tuyo.
        if (name === "posicao - emprestimos" && plain(String(r["Natureza"] ?? "")) !== "doador") continue;
        add({ ticker: baseTicker(code), name: produto.split(" - ").slice(1).join(" - ").trim() || undefined, class: cls, quantity: q });
      }
    }
    if (name === "posicao - tesouro direto") {
      for (const r of s.rows) {
        const produto = String(r["Produto"] ?? "").trim();
        const venc = String(r["Vencimento"] ?? "").trim();
        const q = num(r["Quantidade"]);
        const m = produto.match(/^(Tesouro .+?)\s+(\d{4})$/);
        if (!m || !/^\d{2}\/\d{2}\/\d{4}$/.test(venc) || !Number.isFinite(q) || q <= 0) continue;
        const inv = num(r["Valor Aplicado"]);
        add({
          ticker: tesouroTicker(m[1], m[2]),
          name: produto,
          class: "tesouro",
          quantity: q,
          tesouroId: `${m[1]};${venc}`,
          invested: Number.isFinite(inv) ? inv : undefined,
        });
      }
    }
  }

  const trades: Trade[] = [];
  const neg = sheets.find((s) => plain(s.name) === "negociacoes");
  for (const r of neg?.rows ?? []) {
    const code = String(r["Código de Negociação"] ?? "").trim();
    if (!/^[A-Z]{4}\d{1,2}F?$/.test(code)) continue;
    const buyQty = num(r["Quantidade (Compra)"]);
    const sellQty = num(r["Quantidade (Venda)"]);
    const buyAvg = num(r["Preço Médio (Compra)"]);
    const ini = String(r["Período (Inicial)"] ?? "").trim();
    const t: Trade = {
      ticker: baseTicker(code),
      buyQty: Number.isFinite(buyQty) ? buyQty : 0,
      sellQty: Number.isFinite(sellQty) ? sellQty : 0,
      buyAvg: Number.isFinite(buyAvg) ? buyAvg : 0,
      ...(/^\d{2}\/\d{2}\/\d{4}$/.test(ini) ? { from: brToIso(ini) } : {}),
    };
    const prev = trades.find((x) => x.ticker === t.ticker);
    if (prev) {
      const q = prev.buyQty + t.buyQty;
      prev.buyAvg = q > 0 ? (prev.buyAvg * prev.buyQty + t.buyAvg * t.buyQty) / q : 0;
      prev.buyQty = q;
      prev.sellQty += t.sellQty;
      if (t.from && (!prev.from || t.from < prev.from)) prev.from = t.from;
    } else trades.push(t);
  }

  if (!byTicker.size && !trades.length) return null;
  return { account, asOf, positions: [...byTicker.values()], trades };
}

/** "Tesouro IPCA+" 2029 → "IPCA+2029"; "Tesouro Selic" 2031 → "SELIC2031" (mismo criterio que portfolio.json). */
export function tesouroTicker(tipo: string, year: string): string {
  const t = tipo.replace(/^Tesouro\s+/i, "").replace(/\s+com Juros Semestrais/i, "-JS").replace(/\s+/g, "").toUpperCase();
  return t === "IPCA+" ? `IPCA+${year}` : `${t}${year}`;
}

/** Activos que vienen de B3 (los demás son manuales). */
export const isB3Asset = (a: Asset) => ["acciones", "fiis", "etfs", "tesouro"].includes(a.class) && a.provider !== "manual" && a.provider !== "cdi";

const round = (n: number, d = 8) => Math.round(n * 10 ** d) / 10 ** d;

export interface PositionChange {
  account: string;
  asOf: string;
  ticker: string;
  before: number;
  after: number;
  avgBefore?: number;
  avgAfter?: number;
  added?: boolean;
}

/**
 * Aplica archivos de posición más nuevos que la última fecha aplicada de cada cuenta.
 * Función pura: devuelve una cartera nueva y la lista de cambios.
 */
export function applyPositionFiles(portfolio: Portfolio, files: PositionFile[]): { portfolio: Portfolio; changes: PositionChange[] } {
  const p: Portfolio = structuredClone(portfolio);
  const asOf = { ...(p.positions_as_of ?? {}) };
  const changes: PositionChange[] = [];
  const total = (a: Asset) => Object.values(a.accounts ?? {}).reduce((s, x) => s + x.quantity, 0);

  for (const f of [...files].sort((a, b) => a.asOf.localeCompare(b.asOf))) {
    if (asOf[f.account] && f.asOf <= asOf[f.account]) continue; // ya aplicado o más viejo
    const seen = new Set<string>();

    for (const pos of f.positions) {
      seen.add(pos.ticker);
      let a = p.assets.find((x) => x.ticker === pos.ticker || (pos.tesouroId && x.provider_id === pos.tesouroId));
      if (!a) {
        a = { ticker: pos.ticker, name: pos.name, class: pos.class, quantity: 0, accounts: {} };
        if (pos.tesouroId) Object.assign(a, { provider: "tesouro", provider_id: pos.tesouroId });
        p.assets.push(a);
        changes.push({ account: f.account, asOf: f.asOf, ticker: a.ticker, before: 0, after: pos.quantity, added: true });
      }
      a.accounts ??= {};
      const before = total(a);
      const prevAcc = a.accounts[f.account]?.quantity ?? 0;
      const avgBefore = a.avg_price;

      // Precio medio: compras del mes de esta cuenta (las ventas no lo cambian). Las compras de antes
      // de la última fecha aplicada ya están en los datos de partida y no se vuelven a contar.
      const tr = f.trades.find((t) => t.ticker === a!.ticker && (!asOf[f.account] || !t.from || t.from > asOf[f.account]));
      const after = before - prevAcc + pos.quantity;
      if (pos.class !== "tesouro" && tr && tr.buyQty > 0 && tr.buyAvg > 0) {
        const oldUnits = Math.max(0, after - tr.buyQty);
        a.avg_price = round((oldUnits * (a.avg_price ?? tr.buyAvg) + tr.buyQty * tr.buyAvg) / (oldUnits + tr.buyQty), 4);
      }

      a.accounts[f.account] = { quantity: pos.quantity, ...(pos.invested !== undefined ? { invested: pos.invested } : {}) };
      a.quantity = round(total(a));
      // Tesouro: precio medio = invertido total ÷ cantidad total (si todas las cuentas informan invertido).
      if (pos.class === "tesouro") {
        const accs = Object.values(a.accounts);
        if (accs.every((x) => x.invested !== undefined) && a.quantity > 0) a.avg_price = round(accs.reduce((s, x) => s + (x.invested ?? 0), 0) / a.quantity, 2);
      }
      if (before !== a.quantity || avgBefore !== a.avg_price) {
        changes.push({ account: f.account, asOf: f.asOf, ticker: a.ticker, before, after: a.quantity, avgBefore, avgAfter: a.avg_price });
      }
    }

    // Lo que esta cuenta tenía y ya no aparece: vendido.
    for (const a of p.assets) {
      if (!isB3Asset(a) || seen.has(a.ticker) || !a.accounts?.[f.account]?.quantity) continue;
      const before = total(a);
      a.accounts[f.account] = { quantity: 0 };
      a.quantity = round(total(a));
      changes.push({ account: f.account, asOf: f.asOf, ticker: a.ticker, before, after: a.quantity });
    }
    asOf[f.account] = f.asOf;
  }

  p.assets = p.assets.filter((a) => !isB3Asset(a) || a.quantity > 0 || !a.accounts);
  p.positions_as_of = asOf;
  return { portfolio: p, changes };
}
