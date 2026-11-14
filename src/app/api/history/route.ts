import { connection } from "next/server";
import { loadHistory } from "@/lib/data-files";

/** Serie diaria del patrimonio, generada por el GitHub Action (data/history.json). */
export async function GET() {
  await connection();
  const history = await loadHistory();
  return Response.json({ history }, { headers: { "cache-control": "no-store" } });
}
