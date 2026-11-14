import { connection, type NextRequest } from "next/server";
import { loadReceived } from "@/lib/data-files";
import { isoDateSP } from "@/lib/dates";
import { ownersOf, summarizeReceived } from "@/lib/received";

/** Proventos recibidos (importados del extracto de B3) y sus agregados. ?owner=Nombre filtra por titular. */
export async function GET(req: NextRequest) {
  await connection();
  const file = await loadReceived();
  if (!file) return Response.json({ imported: false });
  const owner = req.nextUrl.searchParams.get("owner");
  const owners = ownersOf(file.payments);
  const payments = owner ? file.payments.filter((p) => p.owner === owner) : file.payments;
  return Response.json(
    {
      imported: true,
      importedAt: file.imported_at,
      sourceFiles: file.source_files,
      owners,
      owner: owner ?? null,
      summary: summarizeReceived(payments, isoDateSP()),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
