import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, AUTH_MAX_AGE, authPassword, authToken, safeEqual, safeNext } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const password = authPassword();
  const body = (await req.json().catch(() => ({}))) as { password?: string; next?: string };
  if (!password) return NextResponse.json({ ok: true, next: safeNext(body.next) });

  const given = typeof body.password === "string" ? body.password : "";
  const [a, b] = await Promise.all([authToken(given), authToken(password)]);
  if (!safeEqual(a, b)) {
    await new Promise((r) => setTimeout(r, 600)); // frena intentos repetidos
    return NextResponse.json({ ok: false, error: "Contraseña incorrecta" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true, next: safeNext(body.next) });
  res.cookies.set(AUTH_COOKIE, b, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_MAX_AGE,
  });
  return res;
}
