/**
 * Guarda un archivo en el repositorio de GitHub (API de contenidos).
 * Token: GITHUB_UPLOAD_TOKEN, un "fine-grained token" con permiso Contents: read & write sólo en este repo.
 * Repo y rama: GITHUB_REPO / GITHUB_BRANCH, o los que informa Vercel (VERCEL_GIT_*).
 */
export function githubTarget() {
  const token = process.env.GITHUB_UPLOAD_TOKEN?.trim();
  const repo =
    process.env.GITHUB_REPO?.trim() ||
    (process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG ? `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}` : undefined);
  const branch = process.env.GITHUB_BRANCH?.trim() || process.env.VERCEL_GIT_COMMIT_REF || undefined;
  const api = process.env.GITHUB_API_URL?.trim() || "https://api.github.com";
  return { token, repo, branch, api };
}

export class GithubError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function gh(path: string, init: RequestInit = {}) {
  const { token, api } = githubTarget();
  const res = await fetch(`${api}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
  });
  return res;
}

/** true si el archivo ya existe en la rama. */
export async function githubFileExists(repo: string, path: string, branch?: string): Promise<boolean> {
  const res = await gh(`/repos/${repo}/contents/${encodeURI(path)}${branch ? `?ref=${encodeURIComponent(branch)}` : ""}`);
  if (res.status === 404) return false;
  if (!res.ok) throw new GithubError(res.status, `GitHub respondió ${res.status}`);
  return true;
}

export async function githubPutFile(repo: string, path: string, content: string, message: string, branch?: string) {
  const res = await gh(`/repos/${repo}/contents/${encodeURI(path)}`, {
    method: "PUT",
    body: JSON.stringify({ message, content: Buffer.from(content, "utf8").toString("base64"), ...(branch ? { branch } : {}) }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { message?: string };
    throw new GithubError(res.status, j.message ?? `GitHub respondió ${res.status}`);
  }
}
