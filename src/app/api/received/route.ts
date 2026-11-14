import { connection } from "next/server";
import { loadReceived } from "@/lib/data-files";
import { isoDateSP } from "@/lib/dates";
import { summarizeReceived } from "@/lib/received";

/** Proventos recibidos (importados del extracto de B3) y sus agregados. */
export async function GET() {
  await connection();
  const file = await loadReceived();
  if (!file) return Response.json({ imported: false });
  return Response.json(
    { imported: true, importedAt: file.imported_at, sourceFiles: file.source_files, summary: summarizeReceived(file.payments, isoDateSP()) },
    { headers: { "cache-control": "no-store" } },
  );
}
