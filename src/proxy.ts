import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authPassword, authToken, safeEqual } from "@/lib/auth";

/** Pide la contraseña antes de mostrar cualquier pantalla o dato. Sin APP_PASSWORD no protege nada. */
export async function proxy(req: NextRequest) {
  const password = authPassword();
  if (!password) return NextResponse.next();

  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (cookie && safeEqual(cookie, await authToken(password))) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "É preciso digitar a senha" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Todo menos la pantalla de ingreso, su API y los archivos estáticos.
  matcher: ["/((?!login|api/login|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|woff2?)$).*)"],
};
