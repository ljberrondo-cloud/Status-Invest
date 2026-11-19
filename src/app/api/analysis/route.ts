import { connection } from "next/server";
import { getAnalysis } from "@/lib/analysis-service";
import { errorMessage } from "@/providers/http";

/** Primera vez: ~30 historiales (con caché de 6 h después). */
export const maxDuration = 60;

export async function GET() {
  await connection();
  try {
    return Response.json(await getAnalysis(), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: errorMessage(e) }, { status: 500 });
  }
}
