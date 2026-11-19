"use client";

import { useState } from "react";
import { MyPlan } from "@/components/calc/MyPlan";
import { Simulator } from "@/components/calc/Simulator";
import { PageHeader, Segmented } from "@/components/ui";

const TABS = [
  { id: "plan", label: "Mi plan" },
  { id: "simulador", label: "Simulador" },
] as const;

export default function Calculadora() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("plan");
  return (
    <div className="space-y-5">
      <PageHeader
        title="Calculadora"
        subtitle={tab === "plan" ? "Tu meta y lo que vas invirtiendo mes a mes" : "Metas con interés compuesto: cuánto aportar, cuánto tiempo o cuánto vas a tener"}
        action={<Segmented label="Calculadora" options={TABS} value={tab} onChange={setTab} size="md" />}
      />
      {tab === "plan" ? <MyPlan /> : <Simulator />}
    </div>
  );
}
