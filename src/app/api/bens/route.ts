import { connection } from "next/server";
import { valueBem } from "@/lib/bens";
import { loadBens } from "@/lib/data-files";

/** Bienes (casa, autos) con su valor estimado. Se editan en data/bens.json. */
export async function GET() {
  await connection();
  const file = await loadBens();
  if (!file) return Response.json({ asOf: null, items: [] });
  return Response.json({ asOf: file.as_of, items: file.items.map(valueBem) }, { headers: { "cache-control": "no-store" } });
}
