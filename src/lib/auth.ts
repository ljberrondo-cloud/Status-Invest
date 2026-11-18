/**
 * Acceso con contraseña compartida (APP_PASSWORD, variable de entorno de Vercel).
 * La cookie guarda un HMAC de la contraseña, nunca la contraseña: si se cambia APP_PASSWORD,
 * todas las sesiones vencen. Usa Web Crypto, disponible tanto en proxy.ts como en las rutas.
 */
export const AUTH_COOKIE = "cartera_auth";
export const AUTH_MAX_AGE = 60 * 60 * 24 * 365; // 1 año

export function authPassword(): string | undefined {
  return process.env.APP_PASSWORD?.trim() || undefined;
}

export async function authToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("cartera-de-inversiones/v1"));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparación en tiempo constante (no revela cuántos caracteres coinciden). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Sólo rutas internas, para no redirigir a otro sitio después del login. */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
