"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePortfolio, useRefresh } from "./data";
import { fmtTime } from "@/lib/format";

const NAV = [
  { href: "/", label: "Resumen", icon: "M3 12l9-8 9 8M5 10v10h14V10" },
  { href: "/clase/acciones", match: "/clase", label: "Activos", icon: "M4 19h16M7 16V9m5 7V5m5 11v-4" },
  { href: "/proventos", label: "Proventos", icon: "M4 7h16v13H4zM4 7l2-3h12l2 3M9 12h6" },
  { href: "/alertas", label: "Alertas", icon: "M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6zM10 19a2 2 0 0 0 4 0" },
];

function Icon({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function RefreshBar() {
  const { data, isValidating, fromDevice } = usePortfolio();
  const { refresh, busy, note } = useRefresh();
  const spinning = busy || isValidating;
  return (
    <div className="flex items-center gap-3">
      <div className="text-right text-xs leading-tight text-ink-3">
        {data ? (
          <>
            <div>{fromDevice ? "Guardado en el dispositivo" : "Actualizado"}</div>
            <div className="num text-ink-2">{fmtTime(data.generatedAt)}</div>
          </>
        ) : (
          <div>Cargando…</div>
        )}
        {note && <div className="max-w-40 text-warn">{note}</div>}
      </div>
      <button
        onClick={refresh}
        disabled={spinning}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm font-medium text-ink transition hover:bg-surface-2 disabled:opacity-60"
      >
        <Icon d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} />
        Actualizar
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const active = (n: (typeof NAV)[number]) => (n.match ? path.startsWith(n.match) : path === n.href);
  return (
    <div className="mx-auto min-h-dvh max-w-5xl pb-24 sm:pb-10">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-bg/85 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="text-base font-semibold tracking-tight">
            Patrimonio
          </Link>
          <nav className="hidden gap-1 sm:flex" aria-label="Secciones">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-full px-3 py-1.5 text-sm ${active(n) ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:text-ink"}`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <RefreshBar />
        </div>
      </header>
      <main className="px-4 pt-4 sm:px-6 sm:pt-6">{children}</main>
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      >
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${active(n) ? "text-accent" : "text-ink-3"}`}>
            <Icon d={n.icon} />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
