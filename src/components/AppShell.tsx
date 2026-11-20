"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePortfolio, useRefresh } from "./data";
import { Icon, type IconName } from "./icons";
import { ThemeToggle } from "./theme";
import { usePrivacy } from "./privacy";
import { fmtTime } from "@/lib/format";
import type { Indicator } from "@/lib/types";

const NAV: { href: string; label: string; short?: string; icon: IconName }[] = [
  { href: "/", label: "Resumo", icon: "home" },
  { href: "/patrimonio", label: "Patrimônio", short: "Total", icon: "layers" },
  { href: "/ativos", label: "Ativos", icon: "assets" },
  { href: "/proventos", label: "Proventos", icon: "income" },
  { href: "/analise", label: "Análise", icon: "pulse" },
  { href: "/investir", label: "Investir", icon: "target" },
  { href: "/calculadora", label: "Calculadora", short: "Calcular", icon: "calc" },
  { href: "/alertas", label: "Alertas", icon: "bell" },
];

function Logo({ year = true }: { year?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-[10px] bg-ink text-bg">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 17l5-5 4 3 7-8" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="block text-[14px] font-semibold tracking-tight">
          Carteira de investimentos{!year && <span className="num font-medium text-ink-3"> 2026</span>}
        </span>
        {year && <span className="num block text-xs font-medium text-ink-3">2026</span>}
      </span>
    </Link>
  );
}

function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
}

function RefreshButton({ compact = false, small = false }: { compact?: boolean; small?: boolean }) {
  const { isValidating } = usePortfolio();
  const { refresh, busy } = useRefresh();
  const spinning = busy || isValidating;
  return (
    <button
      onClick={refresh}
      disabled={spinning}
      aria-label="Atualizar cotações"
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface font-medium text-ink shadow-[var(--shadow)] transition hover:border-line-strong hover:bg-surface-2 disabled:opacity-60 ${small ? "h-7 w-7" : compact ? "h-9 w-9 rounded-xl" : "h-8 px-2.5 text-xs"}`}
    >
      <Icon name="refresh" className={`${small ? "h-3.5 w-3.5" : "h-4 w-4"} ${spinning ? "animate-spin" : ""}`} strokeWidth={2} />
      {!compact && !small && "Atualizar"}
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
          <span>{fromDevice ? "Salvo no aparelho" : "Atualizado"} · </span>
          <span className="num text-ink-2">{fmtTime(data.generatedAt)}</span>
        </>
      ) : (
        "Carregando…"
      )}
      {note && <div className="mt-1 text-warn">{note}</div>}
    </div>
  );
}

const fmtIndicator = (i: Indicator) =>
  i.unit === "R$"
    ? i.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4 })
    : i.unit === "AR$"
      ? `AR$ ${i.value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `${i.value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

const RATE_IDS: Indicator["id"][] = ["cdi", "selic"];

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const fmtRate = (n: number) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

/** Inflación por país: 12 meses y último mes publicado. */
function inflationRows(ind: Indicator[]) {
  const by = new Map(ind.map((i) => [i.id, i]));
  const rows: { key: string; label: string; hint: string; y?: Indicator; m?: Indicator }[] = [
    { key: "br", label: "Brasil", hint: "IPCA · IBGE (BCB)", y: by.get("ipca12m"), m: by.get("ipcaMes") },
    { key: "us", label: "EUA", hint: "CPI · BLS (FRED)", y: by.get("cpiUs12m"), m: by.get("cpiUsMes") },
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
        extra: `${r.m ? `mês ${fmtRate(r.m.value)} · ` : ""}${month}${yMonth ? ` · 12m até ${yMonth}` : ""}`,
        title: `${r.hint}. Acumulada em 12 meses${yMonth ? ` (até ${yMonth}: falta o mesmo mês do ano anterior)` : ""} e variação do mês (${month})`,
      };
    });
}

/** Pares de monedas: cuánto cuesta 1 unidad de la segunda en la primera. */
function currencyRows(ind: Indicator[]) {
  const by = new Map(ind.map((i) => [i.id, i]));
  const rows: { key: string; label: string; hint: string; main?: Indicator; extra?: string }[] = [
    { key: "brlusd", label: "Real x Dólar", hint: "R$ por US$ 1 · PTAX (BCB)", main: by.get("usd") },
    {
      key: "arsusd",
      label: "Peso x Dólar",
      hint: "AR$ por US$ 1 · oficial",
      main: by.get("usdArs"),
      extra: [by.get("usdArsBlue") && `Blue ${fmtIndicator(by.get("usdArsBlue")!)}`, by.get("usdArsMep") && `MEP ${fmtIndicator(by.get("usdArsMep")!)}`]
        .filter(Boolean)
        .join(" · "),
    },
    { key: "arsbrl", label: "Peso x Real", hint: "AR$ por R$ 1 · oficial", main: by.get("brlArs") },
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
          <div className="eyebrow mb-2 px-3">Moedas</div>
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
          <div className="eyebrow mb-2 px-3">Taxas</div>
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
            <span>Inflação</span>
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
    ...inflationRows(data.indicators).map((r) => ({ key: `infl-${r.key}`, label: `Inflação ${r.label} 12m`, value: r.value, extra: r.extra as string | undefined })),
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
      Sair
    </button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const active = useActive();
  const path = usePathname();
  const { hidden } = usePrivacy();
  if (path === "/login") return <>{children}</>;
  return (
    <div className="min-h-dvh">
      {/* Barra lateral (compu) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface/70 px-3 py-5 backdrop-blur lg:flex">
        <div className="px-3">
          <Logo />
          <div className="mt-3 flex items-center gap-2.5">
            <RefreshButton />
            <UpdatedAt />
          </div>
        </div>
        <nav className="mt-5 space-y-0.5" aria-label="Seções">
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
        <div className="border-t border-line px-3 pt-3">
          <Logout />
        </div>
      </aside>

      {/* Barra superior (celular): nombre, actualizar debajo; tema a la derecha */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line/70 bg-bg/85 px-4 py-2.5 backdrop-blur lg:hidden">
        <div className="min-w-0">
          <Logo year={false} />
          <div className="mt-1 flex items-center gap-2 pl-[42px]">
            <UpdatedAt />
            <RefreshButton small />
          </div>
        </div>
        <ThemeToggle compact />
      </header>

      <main className="px-4 pt-5 pb-28 sm:px-6 lg:ml-60 lg:px-10 lg:pt-4 lg:pb-12">
        {/* Tema arriba a la derecha (compu) */}
        <div className="mx-auto mb-2 hidden max-w-[1180px] justify-end lg:flex">
          <div className="w-[230px]">
            <ThemeToggle />
          </div>
        </div>
        <div key={hidden ? "privado" : "visible"} className="mx-auto max-w-[1180px]">
          {children}
        </div>
      </main>

      {/* Pestañas (celular) */}
      <nav
        aria-label="Seções"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-8 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`flex flex-col items-center gap-1 pt-2.5 pb-2 text-[9.5px] font-medium ${active(n.href) ? "text-accent" : "text-ink-3"}`}>
            <Icon name={n.icon} className="h-[22px] w-[22px]" />
            {n.short ?? n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
