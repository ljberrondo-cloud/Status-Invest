const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCompact = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });

export const fmtBRL = (n: number | null | undefined) => (n === null || n === undefined ? "—" : brl.format(n));
export const fmtBRLCompact = (n: number) => brlCompact.format(n);

export function fmtSignedBRL(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
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
  return n.toLocaleString("pt-BR", { maximumFractionDigits: n < 1 ? 8 : n < 1000 && n % 1 ? 4 : 2 });
}

export function fmtPrice(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  if (n < 1) return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 6 });
  return brl.format(n);
}

const TZ = "America/Sao_Paulo";
export const fmtDDMM = (iso: string) => new Intl.DateTimeFormat("es-AR", { timeZone: TZ, day: "2-digit", month: "2-digit" }).format(new Date(iso));
export const fmtTime = (iso: string) => new Intl.DateTimeFormat("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
export const fmtDateLong = (isoDate: string) =>
  new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(`${isoDate}T12:00:00Z`));

export const signClass = (n: number | null | undefined) =>
  n === null || n === undefined || Math.abs(n) < 0.005 ? "text-ink-2" : n > 0 ? "text-pos" : "text-neg";
