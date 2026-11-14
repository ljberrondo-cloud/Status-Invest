export const TZ = "America/Sao_Paulo";

/** Fecha YYYY-MM-DD en horario de São Paulo. */
export function isoDateSP(d: Date | string = new Date()): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** "DD/MM/AAAA" → "AAAA-MM-DD" */
export function brToIso(br: string): string {
  const [d, m, y] = br.split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/** "AAAA-MM-DD" → "DD/MM/AAAA" */
export function isoToBr(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Mediodía de São Paulo de una fecha YYYY-MM-DD, como ISO (evita corrimientos de zona). */
export function isoDateToInstant(iso: string): string {
  return `${iso.slice(0, 10)}T12:00:00-03:00`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Lunes y domingo de la semana de `iso`. */
export function weekRange(iso: string): { start: string; end: string } {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = lunes
  const start = addDays(iso, -dow);
  return { start, end: addDays(start, 6) };
}
