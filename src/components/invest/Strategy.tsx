"use client";

import { diagnose } from "@/lib/strategy";
import type { PortfolioResponse, Targets } from "@/lib/types";
import { fmtBRL, fmtPct } from "@/lib/format";
import { Badge, Card } from "../ui";

/** Fecha de los datos de mercado citados en las recomendaciones (tasas del Tesouro Direto). */
const AS_OF = "18/11/2026";

function Rec({ n, title, tag, tone = "muted", children }: { n: number; title: string; tag: string; tone?: "warn" | "accent" | "muted"; children: React.ReactNode }) {
  return (
    <li className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="num flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold">{n}</span>
        <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
        <Badge tone={tone}>{tag}</Badge>
      </div>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-ink-2 [&_b]:text-ink">{children}</div>
    </li>
  );
}

export function Strategy({ data, targets, monthly }: { data: PortfolioResponse; targets: Targets; monthly: number }) {
  const d = diagnose(data, targets);
  const investable = d.total * (1 - d.lockedPct / 100);
  const months = d.monthsToBalance(monthly);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Estrategia y balance</h2>
        <p className="mt-1 text-sm text-ink-3">Diagnóstico con tus números de hoy y qué haría para equilibrar la cartera, incluidos activos que todavía no tienen.</p>
      </div>

      {/* Diagnóstico en vivo */}
      <Card title="Diagnóstico">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-ink-3">No se puede mover libremente</dt>
            <dd className="num mt-1 text-lg font-semibold">{fmtPct(d.lockedPct, 0, false)}</dd>
            <dd className="text-[11px] text-ink-3">previdencia {fmtPct(d.previdenciaPct, 0, false)} · FGTS {fmtPct(d.fgtsPct, 0, false)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">Mayor posición</dt>
            <dd className="num mt-1 text-lg font-semibold">{d.topAsset ? fmtPct(d.topAsset.pct, 0, false) : "—"}</dd>
            <dd className="truncate text-[11px] text-ink-3">{d.topAsset?.name ?? d.topAsset?.ticker}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">Exposición a dólar</dt>
            <dd className="num mt-1 text-lg font-semibold">{fmtPct(d.foreignPct, 0, false)}</dd>
            <dd className="text-[11px] text-ink-3">ETFs internacionales + cripto</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">Cripto en altcoins</dt>
            <dd className="num mt-1 text-lg font-semibold">{fmtPct(d.altcoinShareOfCrypto, 0, false)}</dd>
            <dd className="text-[11px] text-ink-3">del cripto (fuera de BTC/ETH)</dd>
          </div>
        </dl>
        {d.under.length > 0 && (
          <div className="mt-5 border-t border-line pt-4 text-sm">
            <div className="text-xs font-medium text-ink-2">Para llegar a los objetivos sin vender</div>
            <ul className="mt-2 space-y-1.5">
              {d.under.map((u) => (
                <li key={u.label} className="flex items-baseline justify-between gap-3">
                  <span>
                    {u.label}{" "}
                    <span className="num text-xs text-ink-3">
                      {fmtPct(u.currentPct, 1, false)} → {fmtPct(u.targetPct, 0, false)}
                    </span>
                  </span>
                  <span className="num font-medium">{fmtBRL(u.gap)}</span>
                </li>
              ))}
            </ul>
            {monthly > 0 && Number.isFinite(months) && (
              <p className="mt-3 text-xs text-ink-3">
                Con {fmtBRL(monthly)} por mes entre los dos, completar todo lleva unos <b className="text-ink-2">{months} meses</b> (sin contar lo que se mueven los precios).
              </p>
            )}
          </div>
        )}
        {d.over.length > 0 && (
          <p className="mt-3 text-xs text-ink-3">
            Por encima del objetivo: {d.over.map((o) => `${o.label} (${fmtPct(o.currentPct, 1, false)} vs ${fmtPct(o.targetPct, 0, false)})`).join(", ")}. No hace falta vender: alcanza con dejar de aportarles.
          </p>
        )}
      </Card>

      {/* Recomendaciones */}
      <ol className="space-y-4">
        <Rec n={1} title="Aprovechar los juros reales altos, por más tiempo" tag="Renta fija · prioridad alta" tone="warn">
          <p>
            Al {AS_OF} el Tesouro IPCA+ paga <b>IPCA + 7,89% en 2035</b> y <b>IPCA + 7,61% en 2045</b>, con la Selic en 13,75% y el IPCA en 4,63%. Tasas reales cercanas a 8% son
            excepcionales en la historia de Brasil: fijarlas por muchos años es de las mejores decisiones de largo plazo disponibles hoy.
          </p>
          <p>
            El IPCA+ 2029 es la mayor posición de renta fija, pero vence en 2029: después vas a reinvertir a la tasa que haya entonces. Para los aportes nuevos al Tesouro
            conviene <b>alargar el plazo con IPCA+ 2035</b> (y una parte en 2045 si es plata para la jubilación), formando una escalera de vencimientos. Llevalos hasta el
            vencimiento: en el camino el precio sube y baja (marcação a mercado), pero al final se cobra la tasa contratada.
          </p>
          <p>
            Si creés que la Selic va a bajar, el <b>Tesouro Prefixado 2031/2032 (~15,3% al año)</b> gana más que el CDI en ese escenario; si la inflación sorprende, pierde. Una
            parte chica, como complemento.
          </p>
        </Rec>

        <Rec n={2} title="Primero, la reserva de emergencia" tag="Liquidez">
          <p>
            Antes de sumar riesgo, tengan <b>6 meses de gastos de la familia</b> en algo que se pueda rescatar en el día: Tesouro Selic o un CDB con liquidez diaria de 100% del
            CDI o más. Hoy tienen {fmtBRL(data.positions.find((p) => p.asset.class === "tesouro" && p.asset.ticker.startsWith("SELIC"))?.value ?? 0)} en Tesouro Selic y{" "}
            {fmtBRL(data.byClass.find((c) => c.class === "renta_fija")?.value ?? 0)} en CDB. Si eso no cubre 6 meses, completar la reserva va antes que cualquier otra compra.
          </p>
        </Rec>

        <Rec n={3} title="Objetivos sobre lo que manejan" tag="Planificación" tone="accent">
          <p>
            La previdencia de empresa (<b>{fmtPct(d.previdenciaPct, 0, false)}</b>) y el FGTS (<b>{fmtPct(d.fgtsPct, 0, false)}</b>) cuentan como patrimonio, pero no los pueden
            mover: por eso los objetivos se miden sólo sobre lo que realmente deciden (~{fmtBRL(investable)}). Hoy esos objetivos son los de Investidor10 repartidos sobre esa
            parte. Una distribución más equilibrada, con los juros de hoy:
          </p>
          <div className="overflow-x-auto">
            <table className="mt-1 w-full max-w-md text-sm">
              <tbody className="divide-y divide-line">
                {[
                  ["Tesouro IPCA+ largo (2035/2045)", "25%"],
                  ["Reserva y renta fija (Selic, CDB, LCI/LCA)", "20%"],
                  ["Acciones Brasil", "15%"],
                  ["Internacional (ETFs en dólar)", "15%"],
                  ["FIIs", "15%"],
                  ["Cripto (BTC y ETH)", "5%"],
                  ["Oro", "5%"],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td className="py-1.5 pr-4">{k}</td>
                    <td className="num py-1.5 text-right font-semibold text-ink">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-3">Si les sirve, la cargo como objetivo de la app y las alertas y recomendaciones se recalculan solas.</p>
        </Rec>

        <Rec n={4} title="Previdencia de empresa: aprovechar la contrapartida" tag="Previdencia">
          <p>
            Es la inversión con mejor retorno garantizado que tienen: en la mayoría de los planes corporativos la empresa <b>aporta un monto igual o proporcional</b> al del
            empleado (contrapartida). Por eso conviene <b>aportar como mínimo lo necesario para recibir el máximo de la empresa</b> antes que cualquier otra inversión.
          </p>
          <p>
            Revisen en el reglamento del plan: el porcentaje de contrapartida, el <b>vesting</b> (qué parte de lo que puso la empresa es suya si cambia de trabajo), si el
            régimen de IR es <b>regresivo</b> (baja hasta 10% después de 10 años) y, si es <b>PGBL</b>, que los aportes descuentan hasta 12% de la renta bruta en la declaración
            completa. Al dejar la empresa, el saldo se puede llevar a otro plan por <b>portabilidad</b>, sin pagar impuesto.
          </p>
        </Rec>

        <Rec n={5} title="Cripto: núcleo en BTC y ETH, sin promediar altcoins" tag="Cripto" tone="warn">
          <p>
            {fmtPct(d.altcoinShareOfCrypto, 0, false)} de lo que tienen en cripto está en altcoins (SOL, DOGE, DOT, AVAX), con caídas de 70% a 94% sobre el precio de compra.
            Las altcoins pueden no recuperarse nunca; BTC y, en menor medida, ETH son las que tienen más historia y liquidez. Por eso en la recomendación mensual{" "}
            <b>los aportes de cripto van sólo a BTC (70%) y ETH (30%)</b>.
          </p>
          <p>
            Para el total: <b>5% a 10% del patrimonio como máximo</b>. Consolidar de a poco las altcoins en BTC es razonable; antes de vender, verifiquen las reglas de impuesto
            sobre cripto vigentes en Brasil, que cambiaron en los últimos años.
          </p>
        </Rec>

        <Rec n={6} title="Más diversificación en dólar" tag="Internacional">
          <p>
            Sólo <b>{fmtPct(d.foreignPct, 0, false)}</b> del patrimonio está en dólar (ETFs + cripto). Para una familia que vive en reales, entre 15% y 25% afuera protege contra
            devaluaciones y crisis locales. El núcleo más eficiente es <b>IVVB11</b> (S&amp;P 500, de los más baratos). <b>SPYI11 y QQQI11</b> venden opciones para pagar
            rendimientos mensuales: dan más renta pero menos suba en mercados alcistas; para crecimiento de largo plazo, priorizar IVVB11. Para ampliar más allá de EE. UU.:
            ETFs de Nasdaq (NASD11), de Europa o emergentes, o BDRs de ETFs globales.
          </p>
        </Rec>

        <Rec n={7} title="Acciones Brasil: completar con calidad, no con cantidad" tag="Renda variável">
          <p>
            Están en {fmtPct(data.byClass.find((c) => c.class === "acciones")?.weight ?? 0, 1, false)} contra 10% de objetivo, repartidas en{" "}
            {data.byClass.find((c) => c.class === "acciones")?.count ?? 0} posiciones chicas. Con la Selic alta la bolsa suele cotizar barata, lo que favorece comprar de a poco.
            Mejor reforzar las de mayor calidad y buenos dividendos que sumar nombres nuevos; o simplificar con un ETF amplio como <b>BOVA11</b> (Ibovespa) o <b>SMAL11</b>{" "}
            (small caps, más riesgo y más potencial).
          </p>
        </Rec>

        <Rec n={8} title="FIIs: pausar aportes y reinvertir afuera" tag="FIIs">
          <p>
            Están por encima del objetivo. Los rendimientos de FIIs son mensuales y exentos de IR: úsenlos para completar las clases atrasadas en vez de recomprar FIIs.
            Revisen la tesis de los que más cayeron
            {d.worst.filter((w) => w.ticker.endsWith("11") && !["IVVB11", "SPYI11", "QQQI11"].includes(w.ticker)).length
              ? ` (${d.worst
                  .filter((w) => w.ticker.endsWith("11") && !["IVVB11", "SPYI11", "QQQI11"].includes(w.ticker))
                  .map((w) => `${w.ticker} ${fmtPct(w.gainPct, 0)}`)
                  .join(", ")})`
              : ""}
            : un FII de desarrollo o de recebíveis con problemas no se recupera sólo con el tiempo. Los fondos de fondos (como HFOF11) suman una capa de costos.
          </p>
        </Rec>

        <Rec n={9} title="Oro como seguro de cartera" tag="Activo nuevo">
          <p>
            Un <b>3% a 5% en oro</b> (por ejemplo, el ETF <b>GOLD11</b>) suele subir cuando todo lo demás cae y protege en crisis y devaluaciones. No paga renta: es un seguro,
            no una fuente de ingresos.
          </p>
        </Rec>

        <Rec n={10} title="Renta fija privada exenta de IR" tag="Renta fija">
          <p>
            Para completar la renta fija: <b>LCI y LCA</b> son exentas de IR para personas físicas, y <b>CDBs</b> de bancos sólidos pagan más que el CDI en plazos largos. Todos
            tienen garantía del <b>FGC hasta R$ 250 mil por CPF por institución</b>: si los dos invierten, cada uno tiene su propio límite.
          </p>
        </Rec>
      </ol>

      <p className="rounded-xl bg-surface-2 px-4 py-3 text-xs leading-relaxed text-ink-3">
        Análisis educativo hecho con los datos de su cartera y principios de inversión de largo plazo; no reemplaza una recomendación personalizada de un asesor certificado (CEA,
        CFP®) ni considera su situación fiscal completa. Tasas del Tesouro al {AS_OF}; el resto de los números se actualiza solo. Rentabilidades pasadas no garantizan las
        futuras.
      </p>
    </div>
  );
}
