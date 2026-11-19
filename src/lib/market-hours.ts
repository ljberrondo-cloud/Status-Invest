/**
 * Horario de las bolsas: si están abiertas, cuándo cierran o abren, con feriados.
 * Lógica pura sobre una fecha dada (se puede probar con cualquier "ahora").
 *
 * B3: 10:00 a 18:00 (17:55 + call de cierre) cuando EE.UU. está en horario estándar,
 * y 10:00 a 17:00 mientras EE.UU. está en horario de verano (B3 sigue el cambio de Nueva York).
 * NYSE y Nasdaq: 9:30 a 16:00 de Nueva York; cierre anticipado a las 13:00 en algunos días.
 * Los feriados se cargan a mano por año: fuera de los años listados sólo se descuentan fines de semana.
 */

export type MarketId = "b3" | "nyse" | "nasdaq";

interface Holiday {
  date: string; // YYYY-MM-DD local de la bolsa
  name: string;
}

const B3_HOLIDAYS: Holiday[] = [
  { date: "2026-01-01", name: "Año Nuevo" },
  { date: "2026-02-16", name: "Carnaval" },
  { date: "2026-02-17", name: "Carnaval" },
  { date: "2026-04-03", name: "Viernes Santo" },
  { date: "2026-04-21", name: "Tiradentes" },
  { date: "2026-05-01", name: "Día del Trabajador" },
  { date: "2026-06-04", name: "Corpus Christi" },
  { date: "2026-09-07", name: "Independencia" },
  { date: "2026-10-12", name: "Nossa Senhora Aparecida" },
  { date: "2026-11-02", name: "Finados" },
  { date: "2026-11-20", name: "Consciência Negra" },
  { date: "2026-12-24", name: "Nochebuena" },
  { date: "2026-12-25", name: "Navidad" },
  { date: "2026-12-31", name: "Fin de año" },
  { date: "2027-01-01", name: "Año Nuevo" },
  { date: "2027-02-08", name: "Carnaval" },
  { date: "2027-02-09", name: "Carnaval" },
  { date: "2027-03-26", name: "Viernes Santo" },
  { date: "2027-04-21", name: "Tiradentes" },
  { date: "2027-05-27", name: "Corpus Christi" },
  { date: "2027-09-07", name: "Independencia" },
  { date: "2027-10-12", name: "Nossa Senhora Aparecida" },
  { date: "2027-11-02", name: "Finados" },
  { date: "2027-11-15", name: "Proclamación de la República" },
  { date: "2027-12-24", name: "Nochebuena" },
  { date: "2027-12-31", name: "Fin de año" },
];

/** Miércoles de Ceniza: B3 abre a las 13:00. */
const B3_LATE_OPEN: Record<string, number> = { "2026-02-18": 13 * 60, "2027-02-10": 13 * 60 };

const US_HOLIDAYS: Holiday[] = [
  { date: "2026-01-01", name: "Año Nuevo" },
  { date: "2026-01-19", name: "Martin Luther King" },
  { date: "2026-02-16", name: "Presidents' Day" },
  { date: "2026-04-03", name: "Viernes Santo" },
  { date: "2026-05-25", name: "Memorial Day" },
  { date: "2026-06-19", name: "Juneteenth" },
  { date: "2026-07-03", name: "Independencia (EE.UU.)" },
  { date: "2026-09-07", name: "Labor Day" },
  { date: "2026-11-26", name: "Acción de Gracias" },
  { date: "2026-12-25", name: "Navidad" },
  { date: "2027-01-01", name: "Año Nuevo" },
  { date: "2027-01-18", name: "Martin Luther King" },
  { date: "2027-02-15", name: "Presidents' Day" },
  { date: "2027-03-26", name: "Viernes Santo" },
  { date: "2027-05-31", name: "Memorial Day" },
  { date: "2027-06-18", name: "Juneteenth" },
  { date: "2027-07-05", name: "Independencia (EE.UU.)" },
  { date: "2027-09-06", name: "Labor Day" },
  { date: "2027-11-25", name: "Acción de Gracias" },
  { date: "2027-12-24", name: "Navidad" },
];

/** Días con cierre a las 13:00 en Nueva York. */
const US_EARLY_CLOSE = new Set(["2026-11-27", "2026-12-24", "2027-11-26"]);

export const MARKETS: { id: MarketId; index: string; symbol: string; exchange: string; city: string; tz: string }[] = [
  { id: "b3", index: "Ibovespa", symbol: "^BVSP", exchange: "B3", city: "São Paulo", tz: "America/Sao_Paulo" },
  { id: "nyse", index: "S&P 500", symbol: "^GSPC", exchange: "NYSE", city: "Nueva York", tz: "America/New_York" },
  { id: "nasdaq", index: "Nasdaq", symbol: "^IXIC", exchange: "Nasdaq", city: "Nueva York", tz: "America/New_York" },
];

const HOME_TZ = "America/Sao_Paulo";

interface LocalParts {
  date: string;
  weekday: number; // 0 = domingo
  minutes: number; // desde la medianoche local
}

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(tz: string) {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", weekday: "short" });
    dtfCache.set(tz, f);
  }
  return f;
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function localParts(now: Date, tz: string): LocalParts {
  const p = Object.fromEntries(dtf(tz).formatToParts(now).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, weekday: WD.indexOf(p.weekday), minutes: Number(p.hour) * 60 + Number(p.minute) };
}

/** Diferencia (minutos) entre la hora local de `tz` y UTC en ese instante. */
function offsetMinutes(at: Date, tz: string): number {
  const p = Object.fromEntries(dtf(tz).formatToParts(at).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

/** Instante UTC de una hora local de la bolsa. */
function zonedInstant(date: string, minutes: number, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  const off = offsetMinutes(new Date(guess), tz);
  const first = guess - off * 60000;
  // Corrige si el cambio de horario cae entre la estimación y el resultado.
  const off2 = offsetMinutes(new Date(first), tz);
  return new Date(guess - off2 * 60000);
}

/** EE.UU. en horario de verano: Nueva York está a UTC−4. */
export const usDaylightTime = (at: Date) => offsetMinutes(at, "America/New_York") === -240;

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

interface Session {
  open: number;
  close: number;
}

/** Sesión del día (minutos locales) o el motivo por el que no hay rueda. */
function sessionFor(id: MarketId, date: string): Session | { closedReason: string } {
  const wd = weekdayOf(date);
  if (wd === 0 || wd === 6) return { closedReason: "Fin de semana" };
  const hol = (id === "b3" ? B3_HOLIDAYS : US_HOLIDAYS).find((h) => h.date === date);
  if (hol) return { closedReason: `Feriado: ${hol.name}` };
  if (id === "b3") {
    const noon = zonedInstant(date, 12 * 60, "America/Sao_Paulo");
    return { open: B3_LATE_OPEN[date] ?? 10 * 60, close: usDaylightTime(noon) ? 17 * 60 : 18 * 60 };
  }
  return { open: 9 * 60 + 30, close: US_EARLY_CLOSE.has(date) ? 13 * 60 : 16 * 60 };
}

export type MarketStatus = "open" | "closed";

export interface MarketState {
  id: MarketId;
  index: string;
  symbol: string;
  exchange: string;
  city: string;
  status: MarketStatus;
  /** Hora local de la bolsa, "14:05". */
  localTime: string;
  /** Horario de hoy (o del próximo día hábil) en hora de Brasília, "11:30–18:00". */
  hoursHome: string;
  /** "cierra en 2 h 10 min" / "abre en 45 min" / "abre el lun 10:00". */
  next: string;
  /** Feriado o fin de semana, si hoy no hay rueda. */
  closedReason: string | null;
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

function fmtIn(d: Date, tz: string) {
  return new Intl.DateTimeFormat("es-AR", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
}

export function fmtCountdown(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export function marketState(id: MarketId, now: Date): MarketState {
  const m = MARKETS.find((x) => x.id === id)!;
  const local = localParts(now, m.tz);
  const base = { id, index: m.index, symbol: m.symbol, exchange: m.exchange, city: m.city, localTime: hhmm(local.minutes) };
  const today = sessionFor(id, local.date);

  const range = (date: string, s: Session) => `${fmtIn(zonedInstant(date, s.open, m.tz), HOME_TZ)}–${fmtIn(zonedInstant(date, s.close, m.tz), HOME_TZ)}`;

  if ("open" in today && local.minutes >= today.open && local.minutes < today.close) {
    const closeAt = zonedInstant(local.date, today.close, m.tz);
    return { ...base, status: "open", hoursHome: range(local.date, today), next: `cierra en ${fmtCountdown(closeAt.getTime() - now.getTime())}`, closedReason: null };
  }

  // Próxima apertura: hoy más tarde o el próximo día hábil.
  let date = local.date;
  let s: Session | null = "open" in today && local.minutes < today.open ? today : null;
  for (let i = 1; !s && i <= 14; i++) {
    date = addDays(local.date, i);
    const x = sessionFor(id, date);
    if ("open" in x) s = x;
  }
  const closedReason = "closedReason" in today ? today.closedReason : null;
  if (!s) return { ...base, status: "closed", hoursHome: "—", next: "", closedReason };
  const openAt = zonedInstant(date, s.open, m.tz);
  const ms = openAt.getTime() - now.getTime();
  const homeDate = localParts(openAt, HOME_TZ);
  const homeToday = localParts(now, HOME_TZ).date;
  const next =
    ms < 12 * 3600_000 && homeDate.date === homeToday
      ? `abre en ${fmtCountdown(ms)}`
      : homeDate.date === addDays(homeToday, 1)
        ? `abre mañana ${fmtIn(openAt, HOME_TZ)}`
        : `abre el ${DOW[homeDate.weekday]} ${fmtIn(openAt, HOME_TZ)}`;
  return { ...base, status: "closed", hoursHome: range(date, s), next, closedReason };
}

export const allMarkets = (now: Date) => MARKETS.map((m) => marketState(m.id, now));
