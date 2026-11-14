import { connection } from "next/server";
import { getPortfolioData } from "@/lib/portfolio-service";
import { errorMessage } from "@/providers/http";

/** Primera descarga del CSV del Tesouro puede tardar ~20 s. */
export const maxDuration = 60;

/** Valuación completa. Las cotizaciones vienen de la Data Cache (1–6 h); el cálculo es por request. */
export async function GET() {
  await connection();
  try {
    const data = await getPortfolioData();
    return Response.json(data, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: errorMessage(e) }, { status: 500 });
  }
}
