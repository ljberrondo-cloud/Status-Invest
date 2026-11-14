import { connection, type NextRequest } from "next/server";
import { addDays, isoDateSP, weekRange } from "@/lib/dates";
import { dividendsInRange } from "@/lib/dividends";
import { getDividendEvents } from "@/lib/portfolio-service";
import { errorMessage } from "@/providers/http";

/** Primera descarga del CSV del Tesouro puede tardar ~20 s. */
export const maxDuration = 60;

/** Proventos de acciones y FIIs. ?range=week (default) | next30 */
export async function GET(req: NextRequest) {
  await connection();
  const range = req.nextUrl.searchParams.get("range") === "next30" ? "next30" : "week";
  const today = isoDateSP();
  const { start, end } = range === "week" ? weekRange(today) : { start: today, end: addDays(today, 30) };
  try {
    const { assets, events, errors } = await getDividendEvents();
    const rows = dividendsInRange(events, assets, start, end);
    return Response.json(
      { range, start, end, rows, total: rows.reduce((s, r) => s + r.estimated, 0), errors, generatedAt: new Date().toISOString() },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return Response.json({ error: errorMessage(e) }, { status: 500 });
  }
}
