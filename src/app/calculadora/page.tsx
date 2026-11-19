"use client";

import { useState } from "react";
import { MyPlan } from "@/components/calc/MyPlan";
import { Simulator } from "@/components/calc/Simulator";
import { PageHeader, Segmented } from "@/components/ui";

const TABS = [
  { id: "plan", label: "Meu plano" },
  { id: "simulador", label: "Simulador" },
] as const;

export default function Calculadora() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("plan");
  return (
    <div className="space-y-5">
      <PageHeader
        title="Calculadora"
        subtitle={tab === "plan" ? "Sua meta e o que você vai investindo mês a mês" : "Metas com juros compostos: quanto aportar, quanto tempo ou quanto você vai ter"}
        action={<Segmented label="Calculadora" options={TABS} value={tab} onChange={setTab} size="md" />}
      />
      {tab === "plan" ? <MyPlan /> : <Simulator />}
    </div>
  );
}
