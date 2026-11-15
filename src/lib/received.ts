/**
 * Proventos efectivamente recibidos, importados del extracto de "Movimentação" de la Área do Investidor de B3.
 * Lógica pura: normalización de filas + agregados para la UI.
 */

export type ReceivedType = "dividendo" | "jcp" | "rendimento" | "outro";

export const RECEIVED_LABELS: Record<ReceivedType, string> = {
  dividendo: "Dividendos",
  jcp: "JCP",
  rendimento: "Rendimientos (FII y ETF)",
  outro: "Otros",
};

export interface ReceivedPayment {
  date: string; // YYYY-MM-DD
  ticker: string;
  type: ReceivedType;
  /** Texto original de la columna "Movimentação". */
  label: string;
  quantity: number | null;
  unitValue: number | null;
  amount: number;
  institution?: string;
  /** Titular de la cuenta (nombre de la subcarpeta de data/b3/). */
  owner?: string;
}

export interface ReceivedFile {
  imported_at: string;
  source_files: string[];
  payments: ReceivedPayment[];
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Clasifica la columna "Movimentação". null = no es un provento (compra, transferencia, etc.). */
export function classifyMovement(mov: string): ReceivedType | null {
  const m = norm(mov);
  if (m.includes("juros sobre capital")) return "jcp";
  if (m.startsWith("dividendo")) return "dividendo";
  if (m.startsWith("rendimento")) return "rendimento";
  if (m.startsWith("amortizacao") || m.startsWith("restituicao de capital")) return "outro";
  return null;
}

/** "R$ 1.234,56" | "1234.56" | 1234.56 | "-" → número o null. */
export function parseMoney(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.replace(/R\$\s?/g, "").trim();
  if (!s || s === "-") return null;
  // Formato brasileño: 1.234,56
  const n = s.includes(",") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s);
  return Number.isFinite(n) ? n : null;
}

/** "14/11/2026" | Date | "2026-11-14" → "2026-11-14" */
export function parseB3Date(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v !== "string") return null;
  const br = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  const iso = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

/** "MXRF11 - MAXI RENDA FUNDO..." → "MXRF11" */
export function tickerFromProduct(p: string): string {
  return p.split(" - ")[0].trim().toUpperCase();
}

/** Busca una columna por nombre normalizado (tolera acentos, mayúsculas y variantes). */
function pick(row: Record<string, unknown>, ...names: string[]): unknown {
  const keys = Object.keys(row);
  for (const name of names) {
    const k = keys.find((k) => norm(k) === norm(name));
    if (k !== undefined) return row[k];
  }
  return undefined;
}

/**
 * Convierte filas del extracto (objetos encabezado → valor) en pagos recibidos.
 * Ignora débitos y movimientos que no son proventos.
 */
export function parseMovimentacaoRows(rows: Record<string, unknown>[]): ReceivedPayment[] {
  const out: ReceivedPayment[] = [];
  for (const row of rows) {
    const direction = String(pick(row, "Entrada/Saída", "Entrada/Saida") ?? "Credito");
    if (norm(direction).startsWith("debito")) continue;
    const label = String(pick(row, "Movimentação", "Movimentacao") ?? "").trim();
    const type = classifyMovement(label);
    if (!type) continue;
    const date = parseB3Date(pick(row, "Data"));
    const product = String(pick(row, "Produto") ?? "");
    const amount = parseMoney(pick(row, "Valor da Operação", "Valor da Operacao"));
    if (!date || !product || amount === null || amount <= 0) continue;
    const inst = pick(row, "Instituição", "Instituicao");
    out.push({
      date,
      ticker: tickerFromProduct(product),
      type,
      label,
      quantity: parseMoney(pick(row, "Quantidade")),
      unitValue: parseMoney(pick(row, "Preço unitário", "Preco unitario")),
      amount: Math.round(amount * 100) / 100,
      ...(inst ? { institution: String(inst).trim() } : {}),
    });
  }
  return out;
}

/**
 * Une pagos de varios extractos sin duplicar.
 * Clave: titular + fecha + ticker + tipo + monto + institución (dos titulares con el mismo pago cuentan ambos). "Dividendo" y "Dividendo - Transferido" del mismo
 * evento comparten clave y cuentan una sola vez.
 */
export function mergePayments(...lists: ReceivedPayment[][]): ReceivedPayment[] {
  const map = new Map<string, ReceivedPayment>();
  for (const p of lists.flat()) {
    const key = `${p.owner ?? ""}|${p.date}|${p.ticker}|${p.type}|${p.amount.toFixed(2)}|${p.institution ?? ""}`;
    if (!map.has(key)) map.set(key, p);
  }
  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date) || a.ticker.localeCompare(b.ticker));
}

type ByType = Record<ReceivedType, number>;
const emptyByType = (): ByType => ({ dividendo: 0, jcp: 0, rendimento: 0, outro: 0 });

export interface ReceivedSummary {
  total: number;
  last12m: number;
  ytd: number;
  lastDate: string | null;
  /** Primer pago importado: los totales sólo cubren desde acá. */
  firstDate: string | null;
  byType: ByType;
  byYear: { year: string; total: number; byType: ByType }[];
  /** Últimos 12 meses calendario, incluido el actual, en orden cronológico. */
  byMonth: ({ month: string; total: number } & ByType)[];
  byTicker: { ticker: string; total: number; last12m: number; count: number; lastDate: string }[];
  recent: ReceivedPayment[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function monthsBack(today: string, n: number): string[] {
  const [y, m] = today.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

export function summarizeReceived(payments: ReceivedPayment[], today: string): ReceivedSummary {
  const months = monthsBack(today, 12);
  const from12m = `${months[0]}-01`;
  const year = today.slice(0, 4);

  const byType = emptyByType();
  const years = new Map<string, ByType>();
  const monthMap = new Map(months.map((m) => [m, emptyByType()]));
  const tickers = new Map<string, { total: number; last12m: number; count: number; lastDate: string }>();
  let total = 0,
    last12m = 0,
    ytd = 0;

  for (const p of payments) {
    total += p.amount;
    byType[p.type] += p.amount;
    if (p.date >= from12m && p.date <= today) last12m += p.amount;
    if (p.date.startsWith(year)) ytd += p.amount;
    const y = years.get(p.date.slice(0, 4)) ?? emptyByType();
    y[p.type] += p.amount;
    years.set(p.date.slice(0, 4), y);
    const mm = monthMap.get(p.date.slice(0, 7));
    if (mm) mm[p.type] += p.amount;
    const t = tickers.get(p.ticker) ?? { total: 0, last12m: 0, count: 0, lastDate: p.date };
    t.total += p.amount;
    if (p.date >= from12m && p.date <= today) t.last12m += p.amount;
    t.count += 1;
    if (p.date > t.lastDate) t.lastDate = p.date;
    tickers.set(p.ticker, t);
  }

  const sumType = (b: ByType) => b.dividendo + b.jcp + b.rendimento + b.outro;
  const roundType = (b: ByType): ByType => ({ dividendo: round2(b.dividendo), jcp: round2(b.jcp), rendimento: round2(b.rendimento), outro: round2(b.outro) });

  return {
    total: round2(total),
    last12m: round2(last12m),
    ytd: round2(ytd),
    lastDate: payments.reduce<string | null>((m, p) => (m === null || p.date > m ? p.date : m), null),
    firstDate: payments.reduce<string | null>((m, p) => (m === null || p.date < m ? p.date : m), null),
    byType: roundType(byType),
    byYear: [...years]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([year, b]) => ({ year, total: round2(sumType(b)), byType: roundType(b) })),
    byMonth: months.map((month) => {
      const b = monthMap.get(month)!;
      return { month, total: round2(sumType(b)), ...roundType(b) };
    }),
    byTicker: [...tickers]
      .map(([ticker, t]) => ({ ticker, total: round2(t.total), last12m: round2(t.last12m), count: t.count, lastDate: t.lastDate }))
      .sort((a, b) => b.total - a.total),
    recent: [...payments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
  };
}

/** Titulares presentes, en orden alfabético. */
export function ownersOf(payments: ReceivedPayment[]): string[] {
  return [...new Set(payments.map((p) => p.owner).filter((o): o is string => !!o))].sort((a, b) => a.localeCompare(b));
}
