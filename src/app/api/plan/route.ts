import { connection, type NextRequest } from "next/server";
import { loadPlanFile } from "@/lib/data-files";
import { githubGetFile, githubPutFile, githubTarget } from "@/lib/github";
import { EMPTY_PLAN, isMonth, sanitizePlan, upsertContribution, type PlanFile } from "@/lib/plan";
import { errorMessage } from "@/providers/http";

const PATH = "data/plan.json";
const noStore = { headers: { "cache-control": "no-store" } };

/** Lee data/plan.json directo de GitHub (lo último guardado, sin esperar a Vercel); si no hay token, el del deploy. */
async function readPlan(): Promise<{ file: PlanFile; sha?: string; source: "github" | "deploy" }> {
  const { token, repo, branch } = githubTarget();
  if (token && repo) {
    const f = await githubGetFile(repo, PATH, branch);
    return { file: f ? (JSON.parse(f.content) as PlanFile) : EMPTY_PLAN, sha: f?.sha, source: "github" };
  }
  return { file: (await loadPlanFile()) ?? EMPTY_PLAN, source: "deploy" };
}

export async function GET() {
  await connection();
  try {
    const { file, source } = await readPlan();
    return Response.json({ ...file, source }, noStore);
  } catch (e) {
    return Response.json({ error: errorMessage(e) }, { status: 502 });
  }
}

/**
 * Cambios: { action: "plan", plan } guarda el plan; { action: "contribution", month, amount, note? }
 * registra (o borra, con amount 0) el aporte de un mes.
 */
export async function PUT(req: NextRequest) {
  const { token, repo, branch } = githubTarget();
  if (!token || !repo) return Response.json({ error: "Falta configurar GITHUB_UPLOAD_TOKEN na Vercel para salvar o plano." }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    const { file, sha } = await readPlan();
    let next: PlanFile;
    let message: string;
    if (body.action === "plan") {
      const plan = sanitizePlan(body.plan);
      if (!plan) return Response.json({ error: "Dados do plano inválidos." }, { status: 400 });
      next = { ...file, plan };
      message = `plan: meta ${plan.goal} para ${plan.targetMonth}`;
    } else if (body.action === "contribution") {
      const amount = typeof body.amount === "number" && Number.isFinite(body.amount) && body.amount >= 0 ? body.amount : null;
      if (!isMonth(body.month) || amount === null) return Response.json({ error: "Mês ou valor inválido." }, { status: 400 });
      const note = typeof body.note === "string" ? body.note.slice(0, 120) : undefined;
      next = { ...file, contributions: upsertContribution(file.contributions ?? [], body.month, amount, note) };
      message = amount > 0 ? `aporte: ${body.month} R$ ${amount}` : `aporte: borrar ${body.month}`;
    } else {
      return Response.json({ error: "Ação desconhecida." }, { status: 400 });
    }
    next.updated_at = new Date().toISOString();
    await githubPutFile(repo, PATH, JSON.stringify(next, null, 2) + "\n", message, branch, sha);
    return Response.json({ ...next, source: "github" }, noStore);
  } catch (e) {
    return Response.json({ error: `Não foi possível salvar: ${errorMessage(e)}` }, { status: 502 });
  }
}
