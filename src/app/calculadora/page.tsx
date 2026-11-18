"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePortfolio } from "@/components/data";
import { Card, PageHeader, Segmented } from "@/components/ui";
import { futureValue, monthlyRate, monthsToGoal, projection, realAnnualPct, requiredMonthly } from "@/lib/calculator";
import { fmtBRL, fmtBRLCompact } from "@/lib/format";

type Mode = "aporte" | "tiempo" | "final";
const MODES = [
  { id: "aporte", label: "¿Cuánto aportar?" },
  { id: "tiempo", label: "¿Cuánto tiempo?" },
  { id: "final", label: "¿Cuánto voy a tener?" },
] as const;

const parseMoney = (s: string) => Number(s.replace(/\D/g, "")) || 0;
const fmtInt = (n: number) => (n ? Math.round(n).toLocaleString("pt-BR") : "");
const fmtRate = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** Campo con etiqueta. `group` para varios controles juntos (botones + campo): no usa <label>. */
function Field({ label, hint, group, children }: { label: string; hint?: React.ReactNode; group?: boolean; children: React.ReactNode }) {
  const body = (
    <>
      <span className="text-xs font-medium text-ink-2">{label}</span>
      <div className="mt-1.5">{children}</div>
    </>
  );
  return (
    <div>
      {group ? (
        <div role="group" aria-label={label}>
          {body}
        </div>
      ) : (
        <label className="block">{body}</label>
      )}
      {hint && <div className="mt-1 text-[11px] text-ink-3">{hint}</div>}
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] outline-none transition focus:border-accent num";

function MoneyInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-ink-3">R$</span>
      <input inputMode="numeric" value={fmtInt(value)} onChange={(e) => onChange(parseMoney(e.target.value))} className={`${inputCls} pl-10`} placeholder="0" />
    </div>
  );
}

function fmtDuration(months: number) {
  if (!Number.isFinite(months)) return "No se alcanza";
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (!y) return `${m} ${m === 1 ? "mes" : "meses"}`;
  return `${y} ${y === 1 ? "año" : "años"}${m ? ` y ${m} ${m === 1 ? "mes" : "meses"}` : ""}`;
}

export default function Calculadora() {
  const { data } = usePortfolio();
  const cdi = data?.indicators.find((i) => i.id === "cdi")?.value ?? 13.65;
  const ipca = data?.indicators.find((i) => i.id === "ipca12m")?.value ?? 4.5;
  const current = data ? Math.round(data.total) : 0;

  const [mode, setMode] = useState<Mode>("aporte");
  const [goal, setGoal] = useState(1_000_000);
  const [initial, setInitial] = useState<number | null>(null); // null = usar el patrimonio actual
  const [monthly, setMonthly] = useState(5_000);
  const [years, setYears] = useState(10);
  const [rate, setRate] = useState<number | null>(null); // null = CDI de hoy
  const [rateText, setRateText] = useState<string | null>(null); // lo que se está escribiendo
  const [real, setReal] = useState(false);

  const P = initial ?? current;
  const nominal = rate ?? cdi;
  const annual = real ? realAnnualPct(nominal, ipca) : nominal;
  const r = monthlyRate(annual);
  const presets = [
    { id: "cdi", label: `CDI hoy ${fmtRate(cdi)}%`, value: null as number | null },
    { id: "10", label: "Conservadora 10%", value: 10 },
    { id: "12", label: "Moderada 12%", value: 12 },
    { id: "15", label: "Agresiva 15%", value: 15 },
  ];

  const result = useMemo(() => {
    if (mode === "aporte") {
      const n = Math.max(1, Math.round(years * 12));
      const A = requiredMonthly(P, goal, r, n);
      return { months: n, A, final: futureValue(P, A, r, n) };
    }
    if (mode === "tiempo") {
      const n = monthsToGoal(P, monthly, goal, r);
      return { months: n, A: monthly, final: Number.isFinite(n) ? futureValue(P, monthly, r, n) : NaN };
    }
    const n = Math.max(1, Math.round(years * 12));
    return { months: n, A: monthly, final: futureValue(P, monthly, r, n) };
  }, [mode, P, goal, r, years, monthly]);

  const chartMonths = Number.isFinite(result.months) ? result.months : 0;
  const series = useMemo(() => projection(P, result.A, r, chartMonths), [P, result.A, r, chartMonths]);
  const contributed = P + result.A * chartMonths;
  const earnings = result.final - contributed;
  const showGoal = mode !== "final";

  let headline: React.ReactNode;
  let headlineLabel = "";
  if (mode === "aporte") {
    headlineLabel = `Aporte mensual para llegar a ${fmtBRL(goal)} en ${years} ${years === 1 ? "año" : "años"}`;
    headline = result.A === 0 ? "No hace falta aportar" : fmtBRL(result.A);
  } else if (mode === "tiempo") {
    headlineLabel = `Tiempo para llegar a ${fmtBRL(goal)} aportando ${fmtBRL(monthly)} por mes`;
    headline = fmtDuration(result.months);
  } else {
    headlineLabel = `Vas a tener en ${years} ${years === 1 ? "año" : "años"}`;
    headline = fmtBRL(result.final);
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Calculadora" subtitle="Metas con interés compuesto: cuánto aportar, cuánto tiempo o cuánto vas a tener" />
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Segmented label="Pregunta" options={MODES} value={mode} onChange={setMode} size="md" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <Card title="Datos">
          <div className="space-y-4">
            {mode !== "final" && (
              <Field label="Meta">
                <MoneyInput value={goal} onChange={setGoal} />
              </Field>
            )}
            <Field
              label="Capital inicial"
              group
              hint={
                initial === null ? (
                  "Tu patrimonio de hoy (podés cambiarlo)"
                ) : (
                  <button className="text-accent hover:underline" onClick={() => setInitial(null)}>
                    Usar mi patrimonio de hoy ({fmtBRL(current)})
                  </button>
                )
              }
            >
              <MoneyInput value={P} onChange={(n) => setInitial(n)} />
            </Field>
            {mode !== "aporte" && (
              <Field label="Aporte mensual">
                <MoneyInput value={monthly} onChange={setMonthly} />
              </Field>
            )}
            {mode !== "tiempo" && (
              <Field label={`Plazo: ${years} ${years === 1 ? "año" : "años"}`}>
                <input type="range" min={1} max={40} value={years} onChange={(e) => setYears(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Plazo en años" />
                <div className="flex justify-between text-[10px] text-ink-3">
                  <span>1</span>
                  <span>10</span>
                  <span>20</span>
                  <span>30</span>
                  <span>40 años</span>
                </div>
              </Field>
            )}
            <Field label="Rentabilidad anual esperada" group>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setRate(p.value);
                      setRateText(null);
                    }}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${rate === p.value ? "bg-ink text-bg" : "bg-surface-2 text-ink-2 hover:text-ink"}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="relative mt-2">
                <input
                  inputMode="decimal"
                  value={rateText ?? fmtRate(nominal)}
                  onChange={(e) => {
                    const t = e.target.value.replace(/[^\d,.]/g, "");
                    setRateText(t);
                    const n = Number(t.replace(",", "."));
                    setRate(Number.isFinite(n) ? Math.min(n, 100) : 0);
                  }}
                  onBlur={() => setRateText(null)}
                  className={`${inputCls} pr-16`}
                  aria-label="Rentabilidad anual en porcentaje"
                />
                <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-ink-3">% al año</span>
              </div>
            </Field>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-surface-2 px-3.5 py-3">
              <input type="checkbox" checked={real} onChange={(e) => setReal(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
              <span className="text-sm">
                Descontar la inflación
                <span className="block text-xs text-ink-3">
                  Con IPCA {fmtRate(ipca)}%: rentabilidad real {fmtRate(realAnnualPct(nominal, ipca))}% al año. Los montos quedan en reales de hoy.
                </span>
              </span>
            </label>
          </div>
        </Card>

        {/* En el celular el resultado va primero */}
        <div className="order-first space-y-5 lg:order-none">
          <section className="card hero p-5 sm:p-7">
            <div className="eyebrow">{headlineLabel}</div>
            <div className="num mt-2 text-[2.4rem] leading-none font-semibold tracking-[-0.03em] sm:text-5xl">{headline}</div>
            {mode === "aporte" && result.A > 0 && <div className="num mt-2 text-sm text-ink-2">{fmtBRL(result.A * 12)} por año</div>}
            {mode === "aporte" && result.A === 0 && (
              <div className="mt-2 text-sm text-ink-2">
                Con tu capital y {fmtRate(annual)}% al año llegás a la meta en <b>{fmtDuration(monthsToGoal(P, 0, goal, r))}</b>, sin aportar nada.
              </div>
            )}
            <dl className="mt-6 grid grid-cols-1 gap-3 rounded-2xl border border-line/80 bg-surface/60 p-4 sm:grid-cols-3 sm:gap-4">
              <div>
                <dt className="text-xs text-ink-3">Vas a aportar</dt>
                <dd className="num mt-1 font-semibold">{Number.isFinite(contributed) ? fmtBRL(contributed) : "—"}</dd>
                <dd className="text-[11px] text-ink-3">incluye el capital inicial</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-3">Rinde</dt>
                <dd className="num mt-1 font-semibold text-pos">{Number.isFinite(earnings) ? fmtBRL(earnings) : "—"}</dd>
                <dd className="text-[11px] text-ink-3">{Number.isFinite(earnings) && result.final > 0 ? `${Math.round((earnings / result.final) * 100)}% del final` : ""}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-3">Valor final</dt>
                <dd className="num mt-1 font-semibold">{Number.isFinite(result.final) ? fmtBRL(result.final) : "—"}</dd>
                <dd className="text-[11px] text-ink-3">{Number.isFinite(result.months) ? fmtDuration(result.months) : ""}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[11px] text-ink-3">
              Rentabilidad {real ? "real" : "nominal"} de {fmtRate(annual)}% al año ({fmtRate(r * 100)}% al mes), con aportes a fin de cada mes. Antes de impuestos. Es una
              proyección: la rentabilidad real puede ser distinta.
            </p>
          </section>

          <Card title="Proyección" subtitle="Lo que aportás vs. lo que rinde, año por año">
            {chartMonths > 0 ? (
              <>
                <div className="h-64 sm:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="year" tickFormatter={(y: number) => `${y}a`} tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={20} />
                      <YAxis tickFormatter={(v: number) => fmtBRLCompact(v)} tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                      <Tooltip
                        content={({ active, payload }) => {
                          const d = payload?.[0]?.payload as (typeof series)[number] | undefined;
                          return active && d ? (
                            <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-[var(--shadow-lg)]">
                              <div className="mb-1 font-medium">Año {d.year}</div>
                              <div className="num">Aportado {fmtBRL(d.contributed)}</div>
                              <div className="num text-pos">Rendimiento {fmtBRL(d.earnings)}</div>
                              <div className="num mt-1 border-t border-line pt-1 font-semibold">{fmtBRL(d.value)}</div>
                            </div>
                          ) : null;
                        }}
                      />
                      <Area type="monotone" dataKey="contributed" stackId="1" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.55} isAnimationActive={false} />
                      <Area type="monotone" dataKey="earnings" stackId="1" stroke="var(--c-fiis)" fill="var(--c-fiis)" fillOpacity={0.45} isAnimationActive={false} />
                      {showGoal && <ReferenceLine y={goal} stroke="var(--text-2)" strokeDasharray="4 4" label={{ value: `Meta ${fmtBRLCompact(goal)}`, position: "insideTopLeft", fill: "var(--text-2)", fontSize: 11 }} />}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex justify-center gap-5 text-xs text-ink-2">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--accent)" }} /> Aportado
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--c-fiis)" }} /> Rendimiento
                  </span>
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-ink-3">
                {Number.isFinite(result.months) ? "Ya alcanzaste la meta con tu capital actual." : "Con esos datos la meta no se alcanza: subí el aporte o la rentabilidad."}
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
