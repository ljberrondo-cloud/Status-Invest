"use client";

import { useState } from "react";
import { DividendCalendar } from "@/components/proventos/Calendar";
import { ReceivedView } from "@/components/proventos/Received";
import { PageHeader, Segmented } from "@/components/ui";

const TABS = [
  { id: "recibidos", label: "Recibidos" },
  { id: "calendario", label: "Próximos" },
] as const;

export default function Proventos() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("recibidos");
  return (
    <div>
      <PageHeader
        title="Proventos"
        subtitle="Dividendos, JCP y rendimientos de tus dos cuentas"
        action={<Segmented label="Proventos" options={TABS} value={tab} onChange={setTab} size="md" />}
      />
      {tab === "recibidos" ? <ReceivedView /> : <DividendCalendar />}
    </div>
  );
}
