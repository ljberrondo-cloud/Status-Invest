"use client";

import { useState } from "react";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const next = new URLSearchParams(window.location.search).get("next") ?? "/";
    const r = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password, next }) });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; next?: string; error?: string };
    if (j.ok) {
      window.location.assign(j.next ?? "/");
      return;
    }
    setError(j.error ?? "No se pudo ingresar");
    setBusy(false);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-7">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-bg">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 17l5-5 4 3 7-8" />
            </svg>
          </span>
          <div className="leading-tight">
            <div className="font-semibold tracking-tight">Cartera de inversiones</div>
            <div className="text-sm text-ink-3">2026</div>
          </div>
        </div>
        <label htmlFor="pw" className="mt-7 block text-sm font-medium">
          Contraseña
        </label>
        <input
          id="pw"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-2 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 outline-none focus:border-accent"
        />
        {error && (
          <p role="alert" className="mt-2 text-sm text-neg">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !password}
          className="mt-5 w-full rounded-xl bg-ink py-2.5 text-sm font-semibold text-bg transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Ingresando…" : "Entrar"}
        </button>
        <p className="mt-4 text-center text-xs text-ink-3">Queda recordada en este dispositivo.</p>
      </form>
    </div>
  );
}
