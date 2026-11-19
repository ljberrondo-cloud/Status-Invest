"use client";

import { useState, useSyncExternalStore } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useSWRConfig } from "swr";
import { useJson, usePortfolio } from "@/components/data";
import { Card, Skeleton } from "@/components/ui";
import { addMonths, trackPlan, type Plan, type PlanFile } from "@/lib/plan";
import { fmtBRL, fmtBRLCompact, fmtPct, fmtSignedBRL, signClass } from "@/lib/format";
import { isoDateSP } from "@/lib/dates";
import { Field, fmtDuration, fmtRate, inputCls, MoneyInput, noop, readStoredMonthly } from "./Simulator";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fmtMonth = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const fmtMonthShort = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;

async function savePlan(body: unknown): Promise<PlanFile & { error?: string }> {
  const r = await fetch("/api/plan", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({ error: `Error ${r.status}` }))) as PlanFile & { error?: string };
  if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
  return j;
}

/* ---------------- Formulario del plan ---------------- */

function PlanForm({ initial, current, cdi, onSaved, onCancel }: { initial: Plan | null; current: number; cdi: number; onSaved: (f: PlanFile) => void; onCancel?: () => void }) {
  const thisMonth = isoDateSP().slice(0, 7);
  const stored = useSyncExternalStore(noop, readStoredMonthly, () => null);
  const [goal, setGoal] = useState(initial?.goal ?? 1_000_000);
  const [target, setTarget] = useState(initial?.targetMonth ?? addMonths(thisMonth, 120));
  const [rate, setRate] = useState<number>(initial?.ratePct ?? 12);
  const [planned, setPlanned] = useState(initial?.plannedMonthly ?? stored ?? 4000);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const presets = [
    { label: `CDI ${fmtRate(cdi)}%`, value: cdi },
    { label: "10%", value: 10 },
    { label: "12%", value: 12 },
    { label: "15%", value: 15 },
  ];

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const plan: Plan = {
        goal,
        targetMonth: target,
        ratePct: rate,
        plannedMonthly: planned,
        startMonth: initial?.startMonth ?? thisMonth,
        startValue: initial?.startValue ?? Math.round(current),
      };
      onSaved(await savePlan({ action: "plan", plan }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={initial ? "Editar mi plan" : "Crear mi plan"} subtitle={initial ? undefined : `Arranca este mes, con tu patrimonio de hoy (${fmtBRL(current)}).`}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Meta">
          <MoneyInput value={goal} onChange={setGoal} />
        </Field>
        <Field label="¿Para cuándo?">
          <input type="month" value={target} min={addMonths(thisMonth, 1)} onChange={(e) => e.target.value && setTarget(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Aporte mensual planeado">
          <MoneyInput value={planned} onChange={setPlanned} />
        </Field>
        <Field label="Rentabilidad anual esperada" group>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => setRate(p.value)}
                className={`rounded-lg px-2.5 py-2 text-xs font-medium ${Math.abs(rate - p.value) < 1e-9 ? "bg-ink text-bg" : "bg-surface-2 text-ink-2 hover:text-ink"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </Field>
      </div>
      {error && <p className="mt-3 rounded-lg bg-neg-bg px-3 py-2 text-sm text-neg">{error}</p>}
      <div className="mt-5 flex gap-2">
        <button onClick={submit} disabled={busy || goal <= 0} className="rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-bg hover:opacity-90 disabled:opacity-40">
          {busy ? "Guardando…" : "Guardar plan"}
        </button>
        {onCancel && (
          <button onClick={onCancel} className="rounded-xl px-4 py-2.5 text-sm text-ink-2 hover:bg-surface-2">
            Cancelar
          </button>
        )}
      </div>
    </Card>
  );
}

/* ---------------- Registrar aporte ---------------- */

function ContributionForm({ file, onSaved }: { file: PlanFile; onSaved: (f: PlanFile) => void }) {
  const thisMonth = isoDateSP().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const existing = file.contributions.find((c) => c.month === month);
  const [amount, setAmount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const value = amount ?? existing?.amount ?? 0;

  async function submit(del = false) {
    setBusy(true);
    setMsg(null);
    try {
      const f = await savePlan({ action: "contribution", month, amount: del ? 0 : value });
      onSaved(f);
      setAmount(null);
      setMsg({ ok: true, text: del ? `Se borró el aporte de ${fmtMonth(month)}.` : `Guardado: ${fmtBRL(value)} en ${fmtMonth(month)}.` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-[15px] font-semibold tracking-tight">¿Cuánto pudiste invertir?</h2>
      <p className="mt-0.5 text-xs text-ink-3">Registrá lo que aportaste cada mes. Si ya había un monto en ese mes, se reemplaza.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-end">
        <Field label="Mes">
          <input
            type="month"
            value={month}
            max={thisMonth}
            onChange={(e) => {
              if (!e.target.value) return;
              setMonth(e.target.value);
              setAmount(null);
              setMsg(null);
            }}
            className={inputCls}
          />
        </Field>
        <Field label="Monto invertido">
          <MoneyInput value={value} onChange={(n) => setAmount(n)} />
        </Field>
        <div className="flex gap-2">
          <button onClick={() => submit()} disabled={busy || value <= 0} className="flex-1 rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-bg hover:opacity-90 disabled:opacity-40 sm:flex-none">
            {busy ? "Guardando…" : existing ? "Actualizar" : "Guardar"}
          </button>
          {existing && (
            <button onClick={() => submit(true)} disabled={busy} className="rounded-xl px-3 py-2.5 text-sm text-neg hover:bg-neg-bg">
              Borrar
            </button>
          )}
        </div>
      </div>
      {msg && (
        <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-pos-bg text-pos" : "bg-neg-bg text-neg"}`}>
          {msg.text}
        </p>
      )}
    </section>
  );
}

/* ---------------- Vista principal ---------------- */

export function MyPlan() {
  const { data } = usePortfolio();
  const planRes = useJson<PlanFile & { source?: string; error?: string }>("/api/plan");
  const { mutate } = useSWRConfig();
  const [editing, setEditing] = useState(false);
  const current = data?.total ?? 0;
  const cdi = data?.indicators.find((i) => i.id === "cdi")?.value ?? 13.65;
  const thisMonth = isoDateSP().slice(0, 7);
  const onSaved = (f: PlanFile) => {
    mutate("/api/plan", f, { revalidate: false });
    setEditing(false);
  };

  if (planRes.error && !planRes.data) return <p className="card p-6 text-sm text-neg">No se pudo leer el plan: {planRes.error.message}</p>;
  if (!planRes.data || !data) return <Skeleton className="h-96" />;
  const file = planRes.data;
  if (!file.plan || editing) return <PlanForm initial={file.plan} current={current} cdi={cdi} onSaved={onSaved} onCancel={file.plan ? () => setEditing(false) : undefined} />;

  const plan = file.plan;
  const t = trackPlan(plan, file.contributions, current, thisMonth);
  const progress = Math.min(100, (current / plan.goal) * 100);
  const onTrack = t.valueAtTargetAtAvg >= plan.goal;
  const chart = t.rows.map((r) => ({ ...r, label: fmtMonthShort(r.month) }));

  return (
    <div className="space-y-5">
      {/* Resumen del plan */}
      <section className="card hero p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="eyebrow">
              Meta {fmtBRL(plan.goal)} para {fmtMonth(plan.targetMonth)} · {fmtRate(plan.ratePct)}% al año
            </div>
            <div className="num mt-2 text-[2.2rem] leading-none font-semibold tracking-[-0.03em] sm:text-5xl">{fmtBRL(current)}</div>
            <div className="num mt-2 text-sm text-ink-2">
              {fmtPct(progress, 1, false)} de la meta · faltan {fmtDuration(t.monthsLeft)}
            </div>
          </div>
          <button onClick={() => setEditing(true)} className="rounded-xl border border-line px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-surface-2">
            Editar plan
          </button>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-line/80 bg-surface/60 p-4 sm:grid-cols-4 sm:gap-4">
          <div>
            <dt className="text-xs text-ink-3">Aportado</dt>
            <dd className="num mt-1 font-semibold">{fmtBRL(t.totalActual)}</dd>
            <dd className="text-[11px] text-ink-3">planeado {fmtBRL(t.totalPlanned)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">{Math.abs(t.diff) < 0.5 ? "Vas" : t.diff > 0 ? "Vas adelantado" : "Vas atrasado"}</dt>
            <dd className={`num mt-1 font-semibold ${signClass(t.diff)}`}>{Math.abs(t.diff) < 0.5 ? "Al día" : fmtSignedBRL(t.diff)}</dd>
            <dd className="text-[11px] text-ink-3">desde {fmtMonth(plan.startMonth)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">Tu promedio</dt>
            <dd className="num mt-1 font-semibold">{fmtBRL(t.avgActual)}</dd>
            <dd className="text-[11px] text-ink-3">por mes · plan {fmtBRL(plan.plannedMonthly)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">Necesitás desde hoy</dt>
            <dd className="num mt-1 font-semibold">{t.requiredNow === 0 ? "Nada" : Number.isFinite(t.requiredNow) ? fmtBRL(t.requiredNow) : "—"}</dd>
            <dd className="text-[11px] text-ink-3">{t.requiredNow === 0 ? "tu patrimonio ya alcanza, sin aportar" : "por mes, para llegar a tiempo"}</dd>
          </div>
        </dl>
        <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${onTrack ? "bg-pos-bg text-pos" : "bg-warn-bg text-warn"}`}>
          {t.avgActual > 0 ? (
            onTrack ? (
              <>
                A tu ritmo (<b className="num">{fmtBRL(t.avgActual)}</b>/mes) llegás a la meta en <b>{fmtDuration(t.monthsAtAvg)}</b>, antes de lo planeado. En {fmtMonth(plan.targetMonth)} tendrías{" "}
                <b className="num">{fmtBRL(t.valueAtTargetAtAvg)}</b>.
              </>
            ) : (
              <>
                A tu ritmo (<b className="num">{fmtBRL(t.avgActual)}</b>/mes) en {fmtMonth(plan.targetMonth)} tendrías <b className="num">{fmtBRL(t.valueAtTargetAtAvg)}</b>
                {Number.isFinite(t.monthsAtAvg) ? (
                  <>
                    {" "}
                    y llegarías a la meta en <b>{fmtDuration(t.monthsAtAvg)}</b>
                  </>
                ) : null}
                . Para llegar a tiempo necesitás <b className="num">{fmtBRL(t.requiredNow)}</b> por mes.
              </>
            )
          ) : (
            <>Registrá cuánto invertiste este mes para ver cómo va el plan.</>
          )}
        </div>
        <p className="mt-3 text-[11px] text-ink-3">
          Usa tu patrimonio real de hoy (incluye cómo se movieron los precios), aportes a fin de cada mes y la rentabilidad del plan. Antes de impuestos.
        </p>
      </section>

      <ContributionForm file={file} onSaved={onSaved} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <Card title="Mes a mes" subtitle="Lo que aportaste vs. lo planeado">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v: number) => fmtBRLCompact(v)} tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                <Tooltip
                  cursor={{ fill: "var(--surface-2)" }}
                  content={({ active, payload }) => {
                    const d = payload?.[0]?.payload as (typeof chart)[number] | undefined;
                    return active && d ? (
                      <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-[var(--shadow-lg)]">
                        <div className="mb-1 font-medium">{fmtMonth(d.month)}</div>
                        <div className="num">Aportado {fmtBRL(d.actual)}</div>
                        <div className="num text-ink-3">Planeado {fmtBRL(d.planned)}</div>
                      </div>
                    ) : null;
                  }}
                />
                <Bar dataKey="actual" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false} />
                <Line dataKey="planned" stroke="var(--text-2)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex justify-center gap-5 text-xs text-ink-2">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-accent" /> Aportado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 border-t-[1.5px] border-dashed border-ink-2" /> Planeado
            </span>
          </div>
        </Card>
        <Card title="Historial">
          <ul className="-my-1 divide-y divide-line">
            {[...t.rows].reverse().map((r) => (
              <li key={r.month} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="capitalize">{fmtMonth(r.month)}</span>
                <span className="text-right">
                  <span className={`num font-semibold ${r.actual === 0 ? "text-ink-3" : ""}`}>{r.actual ? fmtBRL(r.actual) : "sin aporte"}</span>
                  <span className={`num block text-[11px] ${signClass(r.actual - r.planned)}`}>{fmtSignedBRL(r.actual - r.planned)} vs plan</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
