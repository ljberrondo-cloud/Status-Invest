import type { Position, ProviderError } from "@/lib/types";
import { fmtDDMM, fmtPct, signClass } from "@/lib/format";
import { isoDateSP } from "@/lib/dates";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function Card({ title, action, children, className = "" }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-sm font-medium text-ink-2">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function ChangePill({ pct, className = "" }: { pct: number | null; className?: string }) {
  if (pct === null) return <span className={`num text-ink-3 ${className}`}>—</span>;
  const tone = Math.abs(pct) < 0.005 ? "bg-surface-2 text-ink-2" : pct > 0 ? "bg-pos-bg text-pos" : "bg-neg-bg text-neg";
  return <span className={`num inline-flex rounded-md px-1.5 py-0.5 text-xs font-medium ${tone} ${className}`}>{fmtPct(pct)}</span>;
}

export function ChangeText({ value, children }: { value: number | null; children: React.ReactNode }) {
  return <span className={`num ${signClass(value)}`}>{children}</span>;
}

/** Estado del dato: manual, última cotización disponible, sin cotización. */
export function QuoteBadge({ p }: { p: Position }) {
  if (p.status === "missing") return <Badge tone="neg">Sin cotización</Badge>;
  if (p.status === "manual") return <Badge tone="muted">Manual{p.quote ? ` · ${fmtDDMM(p.quote.asOf)}` : ""}</Badge>;
  if (p.status === "stale" && p.quote) return <Badge tone="warn">Última cotización del {fmtDDMM(p.quote.asOf)}</Badge>;
  if (p.quote && isoDateSP(p.quote.asOf) !== isoDateSP()) return <Badge tone="muted">Al {fmtDDMM(p.quote.asOf)}</Badge>;
  return null;
}

export function Badge({ tone, children }: { tone: "muted" | "warn" | "neg"; children: React.ReactNode }) {
  const cls = tone === "warn" ? "bg-warn-bg text-warn" : tone === "neg" ? "bg-neg-bg text-neg" : "bg-surface-2 text-ink-3";
  return <span className={`inline-flex whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium leading-4 ${cls}`}>{children}</span>;
}

export function ProviderErrors({ errors }: { errors: ProviderError[] }) {
  if (!errors.length) return null;
  return (
    <details className="rounded-xl border border-line bg-warn-bg px-4 py-3 text-sm text-warn">
      <summary className="cursor-pointer font-medium">
        Algunas fuentes no respondieron ({errors.reduce((s, e) => s + Math.max(1, e.tickers.length), 0)}). Se muestra la última cotización disponible.
      </summary>
      <ul className="mt-2 space-y-1 text-xs">
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
    <div className="card p-6 text-center">
      <p className="font-medium">No se pudieron cargar los datos</p>
      <p className="mt-1 text-sm text-ink-3">{message}</p>
    </div>
  );
}
