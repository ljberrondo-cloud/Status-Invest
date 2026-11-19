import type { NextRequest } from "next/server";
import { ACCOUNTS, buildPositionRecord, buildUploadRecord, parseExtract } from "@/lib/b3-upload";
import { loadReceived } from "@/lib/data-files";
import { githubFileExists, githubFileSha, githubPutFile, githubTarget, GithubError } from "@/lib/github";
import { mergePayments, reconcileAnnual } from "@/lib/received";
import { errorMessage } from "@/providers/http";

export const maxDuration = 60;
const MAX_BYTES = 4 * 1024 * 1024;

const fail = (status: number, error: string) => Response.json({ ok: false, error }, { status });

/**
 * Subir un extracto de Movimentação de B3 (PDF o Excel) desde la app.
 * Se guardan en GitHub sólo los proventos (data/b3/<cuenta>/<período>.json); el workflow
 * "Importar proventos B3" recalcula el acumulado y Vercel publica en 2–3 minutos.
 */
export async function POST(req: NextRequest) {
  const { token, repo, branch } = githubTarget();
  if (!token) return fail(503, "Falta configurar GITHUB_UPLOAD_TOKEN na Vercel para salvar os extratos.");
  if (!repo) return fail(503, "Falta configurar GITHUB_REPO na Vercel (por exemplo usuario/Status-Invest).");

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const account = ACCOUNTS.find((a) => a.id === form?.get("account"));
  if (!account) return fail(400, "Escolha de qual conta é o extrato.");
  if (!(file instanceof File)) return fail(400, "Escolha um arquivo.");
  if (file.size > MAX_BYTES) return fail(413, "El archivo es demasiado grande (máx. 4 MB).");

  let parsed;
  try {
    parsed = await parseExtract(await file.arrayBuffer(), file.name);
  } catch (e) {
    return fail(422, `Não foi possível ler o arquivo: ${errorMessage(e)}`);
  }
  if (!parsed.rowsRead && !parsed.positions) return fail(422, "No parece un archivo de B3 (extracto de Movimentação o relatório consolidado).");

  // Relatório mensual: posiciones de la cuenta a fin de mes (actualizan cantidades y precio medio).
  let positionsSaved: { asOf: string; count: number } | null = null;
  if (parsed.positions) {
    const pr = buildPositionRecord(parsed.positions, account.id);
    try {
      const sha = await githubFileSha(repo, pr.path, branch);
      await githubPutFile(repo, pr.path, pr.content, `posiciones: ${account.label} al ${parsed.positions.asOf}`, branch, sha ?? undefined);
      positionsSaved = { asOf: parsed.positions.asOf, count: parsed.positions.positions.length };
    } catch (e) {
      return fail(502, `Não foi possível salvar no GitHub: ${errorMessage(e)}.`);
    }
  }
  if (!parsed.payments.length) {
    return Response.json({
      ok: true,
      saved: !!positionsSaved,
      positions: positionsSaved,
      rowsRead: parsed.rowsRead,
      found: 0,
      message: positionsSaved ? undefined : "O arquivo não tem proventos (dividendos, JCP ou rendimentos).",
      account: account.label,
    });
  }

  const rec = await buildUploadRecord(parsed, account.id, account.label);
  const { path, content, payments, period, total } = rec;

  // Cuántos son nuevos respecto de lo ya publicado.
  const current = (await loadReceived().catch(() => null))?.payments ?? [];
  const before = reconcileAnnual(mergePayments(current));
  const after = reconcileAnnual(mergePayments(current, payments));
  const isNew = after.length - before.length;
  const summary = { kind: parsed.kind, rowsRead: parsed.rowsRead, found: payments.length, isNew, total, period, account: account.label, positions: positionsSaved };

  try {
    if (await githubFileExists(repo, path, branch)) return Response.json({ ok: true, saved: !!positionsSaved, duplicate: true, ...summary });
    await githubPutFile(repo, path, content, `proventos: extracto de ${account.label} (${period.from} a ${period.to})`, branch);
  } catch (e) {
    const perm = e instanceof GithubError && [401, 403, 404].includes(e.status);
    return fail(502, `Não foi possível salvar no GitHub: ${errorMessage(e)}.${perm ? " Confira se o token tem permissão Contents: read & write no repositório." : ""}`);
  }
  return Response.json({ ok: true, saved: true, ...summary });
}
