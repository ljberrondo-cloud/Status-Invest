import { isPrivate, MASK } from "./privacy";
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCompact = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });


/** Montos en reales: en modo privado se ocultan. */
export const fmtBRL = (n: number | null | undefined) => (n === null || n === undefined ? "—" : isPrivate() ? `R$ ${MASK}` : brl.format(n));
/** Equivalentes del patrimonio en otras monedas, sin centavos ("US$ 65.512", "AR$ 102.231.004"). */
const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
export const fmtMoneyInt = (prefix: string, n: number | null | undefined) =>
  n === null || n === undefined || !Number.isFinite(n) ? "—" : isPrivate() ? `${prefix} ${MASK}` : `${prefix} ${int.format(n)}`;

export const fmtBRLCompact = (n: number) => (isPrivate() ? `R$ ${MASK.slice(0, 3)}` : brlCompact.format(n));

export function fmtSignedBRL(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  if (isPrivate()) return `${n > 0.005 ? "+" : n < -0.005 ? "−" : ""}R$ ${MASK}`;
  const s = brl.format(Math.abs(n));
  return n > 0.005 ? `+${s}` : n < -0.005 ? `−${s}` : s;
}

export function fmtPct(n: number | null | undefined, digits = 2, signed = true) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  if (!signed) return `${abs}%`;
  return n > 0.0049 ? `+${abs}%` : n < -0.0049 ? `−${abs}%` : `${abs}%`;
}

/** Cantidades: hasta 8 decimales para cripto, sin ceros de más. */
export function fmtQty(n: number) {
  if (isPrivate()) return MASK.slice(0, 3);
  return n.toLocaleString("pt-BR", { maximumFractionDigits: n < 1 ? 8 : n < 1000 && n % 1 ? 4 : 2 });
}

export function fmtPrice(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  if (n < 1) return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 6 });
  return brl.format(n);
}

const TZ = "America/Sao_Paulo";
export const fmtDDMM = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" }).format(new Date(iso));
export const fmtTime = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
/** "seg 09/11" */
export const fmtDateLong = (isoDate: string) => {
  const [, m, d] = isoDate.slice(0, 10).split("-");
  return `${WEEKDAYS[new Date(`${isoDate.slice(0, 10)}T12:00:00Z`).getUTCDay()]} ${d}/${m}`;
};

export const signClass = (n: number | null | undefined) =>
  n === null || n === undefined || Math.abs(n) < 0.005 ? "text-ink-2" : n > 0 ? "text-pos" : "text-neg";

/** "Desde cuándo" hay datos: un año entero (total anual) se muestra como "2024", si no "14/10/2026". */
export const fmtSince = (isoDate: string) => (isoDate.endsWith("-01-01") ? isoDate.slice(0, 4) : `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}/${isoDate.slice(0, 4)}`);
