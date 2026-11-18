"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePortfolio, useRefresh } from "./data";
import { Icon, type IconName } from "./icons";
import { fmtTime } from "@/lib/format";
import type { Indicator } from "@/lib/types";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Resumen", icon: "home" },
  { href: "/activos", label: "Activos", icon: "assets" },
  { href: "/proventos", label: "Proventos", icon: "income" },
  { href: "/alertas", label: "Alertas", icon: "bell" },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-[10px] bg-ink text-bg">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 17l5-5 4 3 7-8" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="block text-[14px] font-semibold tracking-tight">Cartera de inversiones</span>
        <span className="num block text-xs font-medium text-ink-3">2026</span>
      </span>
    </Link>
  );
}

function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
}

function RefreshButton({ compact = false }: { compact?: boolean }) {
  const { isValidating } = usePortfolio();
  const { refresh, busy } = useRefresh();
  const spinning = busy || isValidating;
  return (
    <button
      onClick={refresh}
      disabled={spinning}
      aria-label="Actualizar cotizaciones"
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-medium text-ink shadow-[var(--shadow)] transition hover:border-line-strong hover:bg-surface-2 disabled:opacity-60 ${compact ? "h-9 w-9" : "h-9 w-full px-3"}`}
    >
      <Icon name="refresh" className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} strokeWidth={2} />
      {!compact && "Actualizar"}
    </button>
  );
}

function UpdatedAt() {
  const { data, fromDevice } = usePortfolio();
  const { note } = useRefresh();
  return (
    <div className="text-xs leading-tight text-ink-3">
      {data ? (
        <>
          <span className="hidden sm:inline">{fromDevice ? "Guardado en el dispositivo" : "Actualizado"} · </span>
          <span className="num text-ink-2">{fmtTime(data.generatedAt)}</span>
        </>
      ) : (
        "Cargando…"
      )}
      {note && <div className="mt-1 text-warn">{note}</div>}
    </div>
  );
}

const fmtIndicator = (i: Indicator) =>
  i.unit === "R$"
    ? i.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4 })
    : `${i.value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

function MarketList() {
  const { data } = usePortfolio();
  if (!data?.indicators.length) return null;
  return (
    <div>
      <div className="eyebrow mb-2 px-3">Mercado</div>
      <ul className="space-y-0.5">
        {data.indicators.map((i) => (
          <li key={i.id} className="flex items-baseline justify-between rounded-lg px-3 py-1.5 text-[13px]">
            <span className="text-ink-2">{i.label}</span>
            <span className="num font-medium">{fmtIndicator(i)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Indicadores en fila horizontal (celular). */
export function MarketStrip() {
  const { data } = usePortfolio();
  if (!data?.indicators.length) return null;
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:hidden">
      {data.indicators.map((i) => (
        <div key={i.id} className="shrink-0 rounded-xl border border-line bg-surface px-3 py-2">
          <div className="text-[11px] text-ink-3">{i.label}</div>
          <div className="num text-sm font-medium">{fmtIndicator(i)}</div>
        </div>
      ))}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const active = useActive();
  return (
    <div className="min-h-dvh">
      {/* Barra lateral (compu) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface/70 px-3 py-5 backdrop-blur lg:flex">
        <div className="px-3">
          <Logo />
        </div>
        <nav className="mt-8 space-y-1" aria-label="Secciones">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${active(n.href) ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:bg-surface-2/60 hover:text-ink"}`}
            >
              <Icon name={n.icon} className={`h-[18px] w-[18px] ${active(n.href) ? "text-accent" : ""}`} />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-8">
          <MarketList />
        </div>
        <div className="mt-auto space-y-3 px-3">
          <UpdatedAt />
          <RefreshButton />
        </div>
      </aside>

      {/* Barra superior (celular) */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line/70 bg-bg/85 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <div className="flex items-center gap-3">
          <UpdatedAt />
          <RefreshButton compact />
        </div>
      </header>

      <main className="px-4 pt-5 pb-28 sm:px-6 lg:ml-60 lg:px-10 lg:pt-8 lg:pb-12">
        <div className="mx-auto max-w-[1180px]">{children}</div>
      </main>

      {/* Pestañas (celular) */}
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] font-medium ${active(n.href) ? "text-accent" : "text-ink-3"}`}>
            <Icon name={n.icon} className="h-[22px] w-[22px]" />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
