import type { Position, ProviderError } from "@/lib/types";
import { fmtDDMM, fmtPct, signClass } from "@/lib/format";
import { addDays, isoDateSP } from "@/lib/dates";
import { Icon } from "./icons";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function Card({
  title,
  subtitle,
  action,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`card flex flex-col p-5 sm:p-6 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-ink-3">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

/** Selector segmentado (pestañas compactas). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "sm",
}: {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex rounded-xl bg-surface-2 p-1" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-lg font-medium transition ${size === "md" ? "px-4 py-1.5 text-sm" : "px-2.5 py-1 text-xs"} ${value === o.id ? "bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-ink-3 hover:text-ink-2"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Avatar del activo: iniciales sobre el color de su clase (sin logos de marcas). */
export function TickerAvatar({ ticker, cls, size = 36 }: { ticker: string; cls: string; size?: number }) {
  const text = ticker.replace(/[^A-Z0-9]/gi, "").slice(0, ticker.length > 5 ? 4 : 3).toUpperCase();
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[10px] font-semibold tracking-tight"
      style={{
        width: size,
        height: size,
        fontSize: size * (text.length > 3 ? 0.26 : 0.3),
        color: `var(--c-${cls})`,
        background: `color-mix(in oklab, var(--c-${cls}) 14%, var(--surface))`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, var(--c-${cls}) 22%, transparent)`,
      }}
      aria-hidden
    >
      {text}
    </span>
  );
}

export function ChangePill({ pct, className = "", size = "sm" }: { pct: number | null; className?: string; size?: "sm" | "md" }) {
  if (pct === null) return <span className={`num text-ink-3 ${className}`}>—</span>;
  const flat = Math.abs(pct) < 0.005;
  const tone = flat ? "bg-surface-2 text-ink-2" : pct > 0 ? "bg-pos-bg text-pos" : "bg-neg-bg text-neg";
  return (
    <span className={`num inline-flex items-center gap-0.5 rounded-md font-medium ${size === "md" ? "px-2 py-0.5 text-sm" : "px-1.5 py-0.5 text-xs"} ${tone} ${className}`}>
      {!flat && <Icon name={pct > 0 ? "up" : "down"} className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} strokeWidth={2.4} />}
      {!flat && <span className="sr-only">{pct > 0 ? "sube " : "baja "}</span>}
      {fmtPct(pct).replace(/^[+−]/, "")}
    </span>
  );
}

export function ChangeText({ value, children }: { value: number | null; children: React.ReactNode }) {
  return <span className={`num ${signClass(value)}`}>{children}</span>;
}

/** Estado del dato: manual, última cotización disponible, sin cotización. */
export function QuoteBadge({ p }: { p: Position }) {
  if (p.status === "missing") return <Badge tone="neg">Sin cotización</Badge>;
  if (p.status === "manual") return <Badge tone="muted">Manual{p.quote ? ` · ${fmtDDMM(p.quote.asOf)}` : ""}</Badge>;
  if (p.status === "stale" && p.quote) return <Badge tone="warn">Última cotización del {fmtDDMM(p.quote.asOf)}</Badge>;
  // Fines de semana y feriados la última cotización es de días atrás: sólo se marca si tiene más de 4 días.
  if (p.quote && addDays(isoDateSP(), -4) > isoDateSP(p.quote.asOf)) return <Badge tone="muted">Al {fmtDDMM(p.quote.asOf)}</Badge>;
  return null;
}

export function Badge({ tone, children }: { tone: "muted" | "warn" | "neg" | "accent"; children: React.ReactNode }) {
  const cls =
    tone === "warn" ? "bg-warn-bg text-warn" : tone === "neg" ? "bg-neg-bg text-neg" : tone === "accent" ? "bg-accent-soft text-accent" : "bg-surface-2 text-ink-3";
  return <span className={`inline-flex whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4 ${cls}`}>{children}</span>;
}

export function ProviderErrors({ errors, summary }: { errors: ProviderError[]; summary?: string }) {
  if (!errors.length) return null;
  return (
    <details className="group rounded-2xl border border-warn/20 bg-warn-bg px-4 py-3 text-sm text-warn">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium">
        <Icon name="alert" className="h-4 w-4 shrink-0" />
        <span className="flex-1">
          {summary ?? `Algunas fuentes no respondieron (${errors.reduce((s, e) => s + Math.max(1, e.tickers.length), 0)}). Se muestra la última cotización disponible.`}
        </span>
        <Icon name="chevron" className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
      </summary>
      <ul className="mt-2 space-y-1 pl-6 text-xs">
        {errors.map((e, i) => (
          <li key={i}>
            <b>{e.provider}</b>: {e.message}
            {e.tickers.length ? ` — ${e.tickers.join(", ")}` : ""}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="card flex flex-col items-center p-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neg-bg text-neg">
        <Icon name="alert" className="h-5 w-5" />
      </span>
      <p className="mt-3 font-medium">No se pudieron cargar los datos</p>
      <p className="mt-1 max-w-md text-sm text-ink-3">{message}</p>
    </div>
  );
}

/** Dato secundario: etiqueta arriba, valor abajo. */
export function Stat({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-ink-3">{label}</div>
      <div className="num mt-1 text-[15px] font-semibold tracking-tight">{children}</div>
    </div>
  );
}
