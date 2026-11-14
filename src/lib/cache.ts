/**
 * Cachea el resultado de una función async.
 * - Dentro de Next: usa unstable_cache (Data Cache, compartida entre instancias en Vercel).
 * - Fuera de Next (scripts, tests): llama directo.
 * Útil para resultados chicos derivados de descargas grandes (CSV del Tesouro).
 */
export function cached<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  key: string[],
  opts: { revalidate: number; tags: string[] },
): (...args: A) => Promise<R> {
  return async (...args: A) => {
    if (!process.env.NEXT_RUNTIME) return fn(...args);
    const { unstable_cache } = await import("next/cache");
    return unstable_cache(fn, key, opts)(...args);
  };
}
