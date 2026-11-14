import { connection } from "next/server";
import { allocationVsTarget, computeAlerts } from "@/lib/alerts";
import { loadTargets } from "@/lib/data-files";
import { getPortfolioData } from "@/lib/portfolio-service";
import { errorMessage } from "@/providers/http";

/** Primera descarga del CSV del Tesouro puede tardar ~20 s. */
export const maxDuration = 60;

export async function GET() {
  await connection();
  try {
    const [data, targets] = await Promise.all([getPortfolioData(), loadTargets()]);
    if (!targets) return Response.json({ targets: null, alerts: [], allocation: null });
    return Response.json(
      { targets, alerts: computeAlerts(data, targets), allocation: allocationVsTarget(data, targets), missing: data.missing },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return Response.json({ error: errorMessage(e) }, { status: 500 });
  }
}
