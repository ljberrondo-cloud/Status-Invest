"use client";

import { useState } from "react";
import { useJson } from "@/components/data";
import { Icon } from "@/components/icons";
import { ErrorState, PageHeader, ProviderErrors, Skeleton, TickerAvatar } from "@/components/ui";
import type { AnalysisResponse, AnalysisRow } from "@/lib/analysis-service";
import { fmtBRL, fmtPct, signClass } from "@/lib/format";
import { SIGNAL_LABELS, type Note, type SignalKind } from "@/lib/signals";

const ORDER: SignalKind[] = ["compra", "hodl", "alerta", "venta"];

const TONE: Record<SignalKind, string> = {
  compra: "bg-pos-bg text-pos",
  hodl: "bg-accent-soft text-accent",
  alerta: "bg-warn-bg text-warn",
  venta: "bg-neg-bg text-neg",
};

const HELP: Record<SignalKind, string> = {
  compra: "Sinais a favor e espaço na carteira",
  hodl: "Manter, sem aportar nem vender",
  alerta: "Algo para acompanhar de perto",
  venta: "Técnico e fundamentos contra",
};

function SignalPill({ s }: { s: SignalKind }) {
  return <span className={`inline-flex min-w-[64px] justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[s]}`}>{SIGNAL_LABELS[s]}</span>;
}

function Spark({ v, className = "" }: { v: number[]; className?: string }) {
  if (v.length < 2) return <div className={className} />;
  const min = Math.min(...v);
  const max = Math.max(...v);
  const w = 112;
  const h = 32;
  const pts = v.map((y, i) => `${((i / (v.length - 1)) * w).toFixed(1)},${(h - 2 - ((y - min) / (max - min || 1)) * (h - 4)).toFixed(1)}`).join(" ");
  const up = v[v.length - 1] >= v[0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke={up ? "var(--pos)" : "var(--neg)"} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Notes({ title, notes }: { title: string; notes: Note[] }) {
  if (!notes.length) return null;
  return (
    <div>
      <div className="eyebrow mb-2">{title}</div>
      <ul className="space-y-1.5">
        {notes.map((n, i) => (
          <li key={i} className="flex gap-2 text-[13px] leading-snug text-ink-2">
            <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${n.tone === "pos" ? "bg-pos" : n.tone === "neg" ? "bg-neg" : "bg-ink-3/60"}`} aria-hidden />
            <span>
              <span className="sr-only">{n.tone === "pos" ? "A favor: " : n.tone === "neg" ? "Contra: " : ""}</span>
              {n.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Metric({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-ink-3">{label}</div>
      <div className={`num text-[13px] font-medium ${tone}`}>{value}</div>
    </div>
  );
}

function rsiTone(r: number | null | undefined) {
  if (r == null) return "";
  return r < 30 ? "text-pos" : r > 70 ? "text-neg" : "";
}

/** Tercer dato: P/L en acciones, rendimiento en FIIs, caída desde el máximo en el resto. */
function Third({ r }: { r: AnalysisRow }) {
  if (r.cls === "acciones") return <Metric label="P/L" value={r.pe != null ? r.pe.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"} />;
  if (r.cls === "fiis") return <Metric label="DY 12m" value={r.dy != null ? fmtPct(r.dy, 1, false) : "—"} />;
  const fh = r.indicators?.fromHigh;
  return <Metric label="Da máxima" value={fh != null ? fmtPct(fh, 1) : "—"} tone={fh != null && fh <= -25 ? "text-neg" : ""} />;
}

function Row({ r }: { r: AnalysisRow }) {
  const [open, setOpen] = useState(false);
  const ind = r.indicators;
  const fixed = !ind && !r.spark.length;
  return (
    <li>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-surface-2/50 sm:px-5">
        <TickerAvatar ticker={r.ticker} cls={r.cls} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">{r.ticker}</span>
            <span className="truncate text-xs text-ink-3">{r.name !== r.ticker ? r.name : r.classLabel}</span>
          </div>
          <div className="line-clamp-2 text-xs text-ink-2 lg:line-clamp-1">{r.headline}</div>
        </div>
        <Spark v={r.spark} className="hidden h-8 w-28 shrink-0 md:block" />
        <div className="hidden w-[260px] shrink-0 grid-cols-3 gap-3 lg:grid">
          {fixed ? (
            <div className="col-span-3 text-xs text-ink-3">{r.classLabel}</div>
          ) : (
            <>
              <Metric label={r.period ? `Var. ${r.period}` : "Variação"} value={fmtPct(ind?.retPeriod, 1)} tone={signClass(ind?.retPeriod)} />
              <Metric label="RSI" value={ind?.rsi != null ? ind.rsi.toFixed(0) : "—"} tone={rsiTone(ind?.rsi)} />
              <Third r={r} />
            </>
          )}
        </div>
        <SignalPill s={r.signal} />
        <Icon name="chevron" className={`h-4 w-4 shrink-0 text-ink-3 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-line bg-surface-2/40 px-4 py-4 sm:px-5">
          <div className="mb-4 grid grid-cols-3 gap-3 lg:hidden">
            {!fixed && (
              <>
                <Metric label={r.period ? `Var. ${r.period}` : "Variação"} value={fmtPct(ind?.retPeriod, 1)} tone={signClass(ind?.retPeriod)} />
                <Metric label="RSI" value={ind?.rsi != null ? ind.rsi.toFixed(0) : "—"} tone={rsiTone(ind?.rsi)} />
                <Third r={r} />
              </>
            )}
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <Notes title="Técnico" notes={r.tech} />
            <Notes title="Fundamentalista" notes={r.fund} />
            <Notes title="Na carteira" notes={r.portfolio} />
          </div>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-3">
            <span>Posição: {fmtBRL(r.value)}</span>
            {r.score !== 0 && <span>Pontuação {r.score > 0 ? "+" : ""}{r.score.toLocaleString("pt-BR")}</span>}
            {r.asOf && <span>Último fechamento usado: {r.asOf.split("-").reverse().join("/")}</span>}
            {ind && <span>{ind.points} pregões analisados</span>}
          </div>
        </div>
      )}
    </li>
  );
}

export default function Analisis() {
  const { data, error, isLoading } = useJson<AnalysisResponse & { error?: string }>("/api/analysis");
  const [filter, setFilter] = useState<SignalKind | "todos">("todos");

  if (error && !data) return <ErrorState message={error.message} />;
  if (data?.error) return <ErrorState message={data.error} />;

  const rows = data?.rows ?? [];
  const count = (s: SignalKind) => rows.filter((r) => r.signal === s).length;
  const shown = filter === "todos" ? rows : rows.filter((r) => r.signal === filter);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Análise"
        subtitle={data ? `Técnica e fundamentalista dos seus ${rows.length} ativos, do maior para o menor valor` : "Calculando os indicadores de cada ativo…"}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ORDER.map((s) => {
          const active = filter === s;
          return (
            <button
              key={s}
              onClick={() => setFilter(active ? "todos" : s)}
              aria-pressed={active}
              className={`card px-4 py-3 text-left transition ${active ? "ring-2 ring-accent" : "hover:border-line-strong"}`}
            >
              <div className="flex items-center justify-between">
                <SignalPill s={s} />
                <span className="num text-2xl font-semibold">{data ? count(s) : "–"}</span>
              </div>
              <div className="mt-2 text-xs text-ink-3">{HELP[s]}</div>
            </button>
          );
        })}
      </div>

      {data && <ProviderErrors errors={data.errors} summary="Alguns ativos ficaram sem histórico" />}

      {isLoading && !data ? (
        <div className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <p className="text-center text-xs text-ink-3">Da primeira vez demora alguns segundos: o histórico de cada ativo é baixado.</p>
        </div>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {shown.map((r) => (
            <Row key={r.ticker} r={r} />
          ))}
          {!shown.length && <li className="px-5 py-8 text-center text-sm text-ink-3">Nenhum ativo com este sinal.</li>}
        </ul>
      )}

      <div className="rounded-xl bg-surface-2 px-4 py-3 text-xs leading-relaxed text-ink-3">
        <strong className="font-medium text-ink-2">Como é calculado.</strong> Técnico: médias de 20 e 50 pregões (e 200 em cripto), RSI de 14 pregões, cruzamento
        do MACD e queda desde a máxima, sobre 3 meses de fechamentos diários da B3 (brapi) e 1 ano de cripto (CoinGecko). Fundamentalista: P/L da brapi, faixa de 52
        semanas e o rendimento efetivamente recebido por cota nos últimos 12 meses (sem amortizações). Também pesa se a classe está acima ou abaixo da
        meta. Renda fixa, Previdência e FGTS ficam em Hodl. É uma regra automática para organizar o olhar, não uma recomendação de investimento: confirme
        com sua própria análise antes de operar. Atualiza a cada 6 horas.
      </div>
    </div>
  );
}
