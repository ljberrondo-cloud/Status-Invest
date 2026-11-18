import type { NextRequest } from "next/server";
import { ACCOUNTS, buildUploadRecord, parseExtract } from "@/lib/b3-upload";
import { loadReceived } from "@/lib/data-files";
import { githubFileExists, githubPutFile, githubTarget, GithubError } from "@/lib/github";
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
  if (!token) return fail(503, "Falta configurar GITHUB_UPLOAD_TOKEN en Vercel para guardar los extractos.");
  if (!repo) return fail(503, "Falta configurar GITHUB_REPO en Vercel (por ejemplo usuario/Status-Invest).");

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const account = ACCOUNTS.find((a) => a.id === form?.get("account"));
  if (!account) return fail(400, "Elegí de qué cuenta es el extracto.");
  if (!(file instanceof File)) return fail(400, "Elegí un archivo.");
  if (file.size > MAX_BYTES) return fail(413, "El archivo es demasiado grande (máx. 4 MB).");

  let parsed;
  try {
    parsed = await parseExtract(await file.arrayBuffer(), file.name);
  } catch (e) {
    return fail(422, `No se pudo leer el archivo: ${errorMessage(e)}`);
  }
  if (!parsed.rowsRead) return fail(422, "No parece un extracto de Movimentação de B3 (no se encontró la tabla).");
  if (!parsed.payments.length) {
    return Response.json({ ok: true, saved: false, rowsRead: parsed.rowsRead, found: 0, message: "El extracto no tiene proventos (dividendos, JCP o rendimientos)." });
  }

  const rec = await buildUploadRecord(parsed, account.id, account.label);
  const { path, content, payments, period, total } = rec;

  // Cuántos son nuevos respecto de lo ya publicado.
  const current = (await loadReceived().catch(() => null))?.payments ?? [];
  const before = reconcileAnnual(mergePayments(current));
  const after = reconcileAnnual(mergePayments(current, payments));
  const isNew = after.length - before.length;
  const summary = { kind: parsed.kind, rowsRead: parsed.rowsRead, found: payments.length, isNew, total, period, account: account.label };

  try {
    if (await githubFileExists(repo, path, branch)) return Response.json({ ok: true, saved: false, duplicate: true, ...summary });
    await githubPutFile(repo, path, content, `proventos: extracto de ${account.label} (${period.from} a ${period.to})`, branch);
  } catch (e) {
    const perm = e instanceof GithubError && [401, 403, 404].includes(e.status);
    return fail(502, `No se pudo guardar en GitHub: ${errorMessage(e)}.${perm ? " Revisá que el token tenga permiso Contents: read & write sobre el repositorio." : ""}`);
  }
  return Response.json({ ok: true, saved: true, ...summary });
}
