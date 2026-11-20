import { connection, type NextRequest } from "next/server";
import { loadPortfolio, loadReceived } from "@/lib/data-files";
import { isoDateSP } from "@/lib/dates";
import { estimateUpcoming, ownersOf, summarizeReceived, type CalendarPayment } from "@/lib/received";

/** Proventos recibidos (importados del extracto de B3) y sus agregados. ?owner=Nombre filtra por titular. */
export async function GET(req: NextRequest) {
  await connection();
  const file = await loadReceived();
  if (!file) return Response.json({ imported: false });
  const owner = req.nextUrl.searchParams.get("owner");
  const owners = ownersOf(file.payments);
  const payments = owner ? file.payments.filter((p) => p.owner === owner) : file.payments;
  const today = isoDateSP();
  // Calendario: pagos con fecha (los totales anuales no tienen día) y previstos de lo que todavía tienen.
  const holding = await loadPortfolio()
    .then((pf) => new Set(pf.assets.filter((a) => a.quantity > 0).map((a) => a.ticker)))
    .catch(() => undefined);
  const calendar: CalendarPayment[] = payments
    .filter((p) => !p.annual)
    .map((p) => ({ date: p.date, ticker: p.ticker, type: p.type, amount: p.amount }));
  return Response.json(
    {
      imported: true,
      importedAt: file.imported_at,
      sourceFiles: file.source_files,
      owners,
      owner: owner ?? null,
      summary: summarizeReceived(payments, today),
      calendar,
      upcoming: estimateUpcoming(payments, today, holding),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
