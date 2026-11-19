"use client";

import { useSyncExternalStore } from "react";
import { useJson } from "@/components/data";
import { allMarkets, type MarketState } from "@/lib/market-hours";
import { fmtPct, signClass } from "@/lib/format";

/** Reloj compartido: avisa cada 30 s. En el servidor no hay hora (se dibuja al hidratar). */
const TICK = 30_000;
function subscribe(cb: () => void) {
  const id = setInterval(cb, TICK);
  return () => clearInterval(id);
}
const getTick = () => Math.floor(Date.now() / TICK);
const getServerTick = () => null;

interface IndexQuote {
  symbol: string;
  price: number | null;
  changePct: number | null;
  asOf: string | null;
}

const pts = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

function Tile({ m, q }: { m: MarketState; q?: IndexQuote }) {
  const open = m.status === "open";
  const status = open ? "Abierta" : m.closedReason?.startsWith("Feriado") ? "Feriado" : "Cerrada";
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface px-3 py-2.5 shadow-[var(--shadow)]" title={`${m.exchange} · ${m.city} · hora local ${m.localTime}${m.closedReason ? ` · ${m.closedReason}` : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${open ? "bg-pos" : "bg-ink-3/50"}`} aria-hidden />
          <span className="truncate">{m.index}</span>
        </span>
        <span className={`hidden text-[11px] font-medium sm:inline ${open ? "text-pos" : "text-ink-3"}`}>{status}</span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
        <span className="num text-[15px] font-semibold tracking-tight">{q?.price != null ? pts.format(q.price) : "—"}</span>
        {q?.changePct != null && <span className={`num text-[11px] font-medium ${signClass(q.changePct)}`}>{fmtPct(q.changePct)}</span>}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-ink-3">
        <span className={`sm:hidden ${open ? "text-pos" : ""}`}>{status} · </span>
        <span className="sr-only">{m.exchange}: </span>
        {m.next}
      </div>
      <div className="text-[11px] leading-4 text-ink-3">
        {m.hoursHome} <span className="hidden sm:inline">hora BR</span>
      </div>
    </div>
  );
}

/** Ibovespa, S&P 500 y Nasdaq: valor del índice y si la bolsa está abierta (horarios en hora de Brasília). */
export function MarketClock({ className = "" }: { className?: string }) {
  const tick = useSyncExternalStore(subscribe, getTick, getServerTick);
  const { data } = useJson<{ indices: IndexQuote[] }>("/api/markets");
  if (tick === null) return <div className={`grid grid-cols-3 gap-2 ${className}`} aria-hidden />;
  const markets = allMarkets(new Date(tick * TICK));
  return (
    <section aria-label="Bolsas" className={`grid grid-cols-3 gap-2 ${className}`}>
      {markets.map((m) => (
        <Tile key={m.id} m={m} q={data?.indices.find((i) => i.symbol === m.symbol)} />
      ))}
    </section>
  );
}
