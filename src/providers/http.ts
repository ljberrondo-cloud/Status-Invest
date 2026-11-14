/**
 * fetch con timeout y opciones de caché de Next. Fuera de Next (script de snapshot)
 * la opción `next` se ignora y se hace la request directa.
 */
export interface CachedFetchOptions {
  revalidate: number;
  tags: string[];
  headers?: Record<string, string>;
  timeoutMs?: number;
  noStore?: boolean;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function cachedFetch(url: string, opts: CachedFetchOptions): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000);
  try {
    const init: RequestInit & { next?: { revalidate: number; tags: string[] } } = {
      headers: { accept: "application/json", ...opts.headers },
      signal: controller.signal,
    };
    if (opts.noStore) init.cache = "no-store";
    else init.next = { revalidate: opts.revalidate, tags: opts.tags };
    const res = await fetch(url, init);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      let msg = body.slice(0, 160);
      try {
        const j = JSON.parse(body) as { message?: string };
        if (j.message) msg = j.message;
      } catch {}
      throw new HttpError(res.status, `HTTP ${res.status}${msg ? `: ${msg}` : ""}`);
    }
    return res;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new Error("Tiempo de espera agotado");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T>(url: string, opts: CachedFetchOptions): Promise<T> {
  const res = await cachedFetch(url, opts);
  return (await res.json()) as T;
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
