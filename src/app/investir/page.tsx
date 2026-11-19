"use client";

import { useJson, usePortfolio } from "@/components/data";
import { MonthlyPlan } from "@/components/invest/MonthlyPlan";
import { Strategy } from "@/components/invest/Strategy";
import { ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { ACCOUNTS } from "@/lib/accounts";
import { addMonths, type PlanFile } from "@/lib/plan";
import { isoDateSP } from "@/lib/dates";
import type { ReceivedSummary } from "@/lib/received";
import type { Targets } from "@/lib/types";

export default function Invertir() {
  const { data, error } = usePortfolio();
  const alerts = useJson<{ targets: Targets | null }>("/api/alerts");
  const plan = useJson<PlanFile>("/api/plan");
  const c1 = useJson<{ summary?: ReceivedSummary }>(`/api/received?owner=${encodeURIComponent(ACCOUNTS[0].label)}`);
  const c2 = useJson<{ summary?: ReceivedSummary }>(`/api/received?owner=${encodeURIComponent(ACCOUNTS[1].label)}`);

  if (!data && error) return <ErrorState message={error.message} />;
  if (!data || !alerts.data) return <Skeleton className="h-96" />;
  if (!alerts.data.targets) return <ErrorState message="Falta data/targets.json com as metas." />;

  // Proventos del mes pasado de cada uno, como sugerencia para reinvertir.
  const lastMonth = addMonths(isoDateSP().slice(0, 7), -1);
  const prov = (s?: ReceivedSummary) => Math.round(s?.byMonth.find((m) => m.month === lastMonth)?.total ?? 0);
  const planned = plan.data?.plan?.plannedMonthly ?? 0;
  const defaults = {
    [ACCOUNTS[0].id]: { aporte: planned, proventos: prov(c1.data?.summary) },
    [ACCOUNTS[1].id]: { aporte: 0, proventos: prov(c2.data?.summary) },
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Investir" subtitle="O que comprar este mês com o aporte e os proventos, só entre os ativos que vocês já têm" />
      <MonthlyPlan data={data} targets={alerts.data.targets} defaults={defaults} />
      <Strategy data={data} targets={alerts.data.targets} monthly={planned} />
    </div>
  );
}
