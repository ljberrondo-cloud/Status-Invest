"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePortfolio, useRefresh } from "./data";
import { Icon, type IconName } from "./icons";
import { ThemeToggle } from "./theme";
import { PrivacyToggle, usePrivacy } from "./privacy";
import { fmtTime } from "@/lib/format";
import type { Indicator } from "@/lib/types";

const NAV: { href: string; label: string; short?: string; icon: IconName }[] = [
  { href: "/", label: "Resumen", icon: "home" },
  { href: "/activos", label: "Activos", icon: "assets" },
  { href: "/proventos", label: "Proventos", icon: "income" },
  { href: "/analisis", label: "Análisis", icon: "pulse" },
  { href: "/invertir", label: "Invertir", icon: "target" },
  { href: "/calculadora", label: "Calculadora", short: "Calcular", icon: "calc" },
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
    : i.unit === "AR$"
      ? `$ ${i.value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `${i.value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

const RATE_IDS: Indicator["id"][] = ["cdi", "selic"];

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fmtRate = (n: number) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

/** Inflación por país: 12 meses y último mes publicado. */
function inflationRows(ind: Indicator[]) {
  const by = new Map(ind.map((i) => [i.id, i]));
  const rows: { key: string; label: string; hint: string; y?: Indicator; m?: Indicator }[] = [
    { key: "br", label: "Brasil", hint: "IPCA · IBGE (BCB)", y: by.get("ipca12m"), m: by.get("ipcaMes") },
    { key: "us", label: "EE.UU.", hint: "CPI · BLS (FRED)", y: by.get("cpiUs12m"), m: by.get("cpiUsMes") },
    { key: "ar", label: "Argentina", hint: "IPC · INDEC", y: by.get("ipcAr12m"), m: by.get("ipcArMes") },
  ];
  return rows
    .filter((r) => r.y || r.m)
    .map((r) => {
      const mon = (d: string) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(2, 4)}`;
      const month = mon((r.m ?? r.y)!.date);
      // Si el 12 meses es de otro mes (dato faltante en la fuente), se aclara.
      const yMonth = r.y && r.m && r.y.date !== r.m.date ? mon(r.y.date) : null;
      return {
        ...r,
        value: r.y ? fmtRate(r.y.value) : "—",
        extra: `${r.m ? `mes ${fmtRate(r.m.value)} · ` : ""}${month}${yMonth ? ` · 12m a ${yMonth}` : ""}`,
        title: `${r.hint}. Acumulada 12 meses${yMonth ? ` (hasta ${yMonth}: falta el mismo mes del año anterior)` : ""} y variación del mes (${month})`,
      };
    });
}

/** Pares de monedas: cuánto cuesta 1 unidad de la segunda en la primera. */
function currencyRows(ind: Indicator[]) {
  const by = new Map(ind.map((i) => [i.id, i]));
  const rows: { key: string; label: string; hint: string; main?: Indicator; extra?: string }[] = [
    { key: "brlusd", label: "Real vs Dólar", hint: "R$ por 1 US$ · PTAX (BCB)", main: by.get("usd") },
    {
      key: "arsusd",
      label: "Peso vs Dólar",
      hint: "$ por 1 US$ · oficial",
      main: by.get("usdArs"),
      extra: [by.get("usdArsBlue") && `Blue ${fmtIndicator(by.get("usdArsBlue")!)}`, by.get("usdArsMep") && `MEP ${fmtIndicator(by.get("usdArsMep")!)}`]
        .filter(Boolean)
        .join(" · "),
    },
    { key: "arsbrl", label: "Peso vs Real", hint: "$ por 1 R$ · oficial", main: by.get("brlArs") },
  ];
  return rows.filter((r) => r.main);
}

function MarketList() {
  const { data } = usePortfolio();
  if (!data?.indicators.length) return null;
  const rates = data.indicators.filter((i) => RATE_IDS.includes(i.id));
  const fx = currencyRows(data.indicators);
  const infl = inflationRows(data.indicators);
  return (
    <div className="space-y-5">
      {fx.length > 0 && (
        <div>
          <div className="eyebrow mb-2 px-3">Monedas</div>
          <ul className="space-y-0.5">
            {fx.map((r) => (
              <li key={r.key} className="rounded-lg px-3 py-1" title={r.hint}>
                <div className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="text-ink-2">{r.label}</span>
                  <span className="num font-medium">{fmtIndicator(r.main!)}</span>
                </div>
                {r.extra && <div className="num mt-0.5 text-right text-[11px] text-ink-3">{r.extra}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {rates.length > 0 && (
        <div>
          <div className="eyebrow mb-2 px-3">Tasas</div>
          <ul className="space-y-0.5">
            {rates.map((i) => (
              <li key={i.id} className="flex items-baseline justify-between rounded-lg px-3 py-1 text-[13px]">
                <span className="text-ink-2">{i.label}</span>
                <span className="num font-medium">{fmtIndicator(i)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {infl.length > 0 && (
        <div>
          <div className="eyebrow mb-2 flex justify-between px-3">
            <span>Inflación</span>
            <span className="normal-case tracking-normal">12 meses</span>
          </div>
          <ul className="space-y-0.5">
            {infl.map((r) => (
              <li key={r.key} className="rounded-lg px-3 py-1" title={r.title}>
                <div className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="text-ink-2">{r.label}</span>
                  <span className="num font-medium">{r.value}</span>
                </div>
                <div className="num mt-0.5 text-right text-[11px] text-ink-3">{r.extra}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Monedas y tasas en fila horizontal (celular). */
export function MarketStrip() {
  const { data } = usePortfolio();
  if (!data?.indicators.length) return null;
  const items = [
    ...currencyRows(data.indicators).map((r) => ({ key: r.key, label: r.label, value: fmtIndicator(r.main!), extra: r.extra })),
    ...data.indicators.filter((i) => RATE_IDS.includes(i.id)).map((i) => ({ key: i.id, label: i.label, value: fmtIndicator(i), extra: undefined as string | undefined })),
    ...inflationRows(data.indicators).map((r) => ({ key: `infl-${r.key}`, label: `Inflación ${r.label} 12m`, value: r.value, extra: r.extra as string | undefined })),
  ];
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:hidden">
      {items.map((i) => (
        <div key={i.key} className="shrink-0 rounded-xl border border-line bg-surface px-3 py-2">
          <div className="text-[11px] text-ink-3">{i.label}</div>
          <div className="num text-sm font-medium">{i.value}</div>
          {i.extra && <div className="num text-[10px] text-ink-3">{i.extra}</div>}
        </div>
      ))}
    </div>
  );
}

function Logout() {
  return (
    <button
      onClick={async () => {
        await fetch("/api/logout", { method: "POST" });
        // Recarga completa a propósito: limpia los datos de la cartera que quedaron en memoria.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/login";
      }}
      className="text-xs text-ink-3 hover:text-ink-2 hover:underline"
    >
      Cerrar sesión
    </button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const active = useActive();
  const path = usePathname();
  const { hidden, setHidden } = usePrivacy();
  if (path === "/login") return <>{children}</>;
  return (
    <div className="min-h-dvh">
      {/* Barra lateral (compu) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface/70 px-3 py-5 backdrop-blur lg:flex">
        <div className="px-3">
          <Logo />
        </div>
        <nav className="mt-6 space-y-0.5" aria-label="Secciones">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-[7px] text-sm transition ${active(n.href) ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:bg-surface-2/60 hover:text-ink"}`}
            >
              <Icon name={n.icon} className={`h-[18px] w-[18px] ${active(n.href) ? "text-accent" : ""}`} />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="no-scrollbar mt-6 min-h-0 flex-1 overflow-y-auto pb-4">
          <MarketList />
        </div>
        <div className="space-y-2.5 border-t border-line px-3 pt-3">
          <ThemeToggle />
          <div className="flex items-center justify-between gap-2">
            <UpdatedAt />
            <div className="flex gap-2">
              <PrivacyToggle hidden={hidden} onChange={setHidden} compact />
              <RefreshButton compact />
            </div>
          </div>
          <Logout />
        </div>
      </aside>

      {/* Barra superior (celular) */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line/70 bg-bg/85 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <div className="flex items-center gap-3">
          <UpdatedAt />
          <PrivacyToggle hidden={hidden} onChange={setHidden} compact />
          <ThemeToggle compact />
          <RefreshButton compact />
        </div>
      </header>

      <main className="px-4 pt-5 pb-28 sm:px-6 lg:ml-60 lg:px-10 lg:pt-8 lg:pb-12">
        <div key={hidden ? "privado" : "visible"} className="mx-auto max-w-[1180px]">
          {children}
        </div>
      </main>

      {/* Pestañas (celular) */}
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-7 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`flex flex-col items-center gap-1 pt-2.5 pb-2 text-[10px] font-medium ${active(n.href) ? "text-accent" : "text-ink-3"}`}>
            <Icon name={n.icon} className="h-[22px] w-[22px]" />
            {n.short ?? n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
