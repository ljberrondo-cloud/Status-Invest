"use client";

import { useJson, usePortfolio } from "@/components/data";
import { MonthlyPlan } from "@/components/invest/MonthlyPlan";
import { Strategy } from "@/components/invest/Strategy";
import { ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { ACCOUNTS } from "@/lib/accounts";
import type { PlanFile } from "@/lib/plan";
import { isoDateSP } from "@/lib/dates";
import type { CalendarPayment, ReceivedSummary } from "@/lib/received";
import type { Targets } from "@/lib/types";

export default function Invertir() {
  const { data, error } = usePortfolio();
  const alerts = useJson<{ targets: Targets | null }>("/api/alerts");
  const plan = useJson<PlanFile>("/api/plan");
  const c1 = useJson<{ summary?: ReceivedSummary; upcoming?: CalendarPayment[] }>(`/api/received?owner=${encodeURIComponent(ACCOUNTS[0].label)}`);
  const c2 = useJson<{ summary?: ReceivedSummary; upcoming?: CalendarPayment[] }>(`/api/received?owner=${encodeURIComponent(ACCOUNTS[1].label)}`);

  if (!data && error) return <ErrorState message={error.message} />;
  if (!data || !alerts.data) return <Skeleton className="h-96" />;
  if (!alerts.data.targets) return <ErrorState message="Falta data/targets.json com as metas." />;

  // Proventos a reinvertir = previsto del mes de cada cuenta: lo ya recibido + lo que falta cobrar (estimado).
  const thisMonth = isoDateSP().slice(0, 7);
  const forecast = (r?: { summary?: ReceivedSummary; upcoming?: CalendarPayment[] }) => {
    const got = r?.summary?.byMonth.find((m) => m.month === thisMonth)?.total ?? 0;
    const pending = (r?.upcoming ?? []).filter((p) => p.date.startsWith(thisMonth)).reduce((s, p) => s + p.amount, 0);
    return { proventos: Math.round(got + pending), got, pending };
  };
  const planned = plan.data?.plan?.plannedMonthly ?? 0;
  const defaults = {
    [ACCOUNTS[0].id]: { aporte: planned, ...forecast(c1.data) },
    [ACCOUNTS[1].id]: { aporte: 0, ...forecast(c2.data) },
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Investir" subtitle="O que comprar este mês com o aporte e os proventos, só entre os ativos que vocês já têm" />
      <MonthlyPlan data={data} targets={alerts.data.targets} defaults={defaults} />
      <Strategy data={data} targets={alerts.data.targets} monthly={planned} />
    </div>
  );
}
