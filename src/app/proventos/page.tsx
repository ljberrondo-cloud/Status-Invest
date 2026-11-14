"use client";

import { useState } from "react";
import { DividendCalendar } from "@/components/proventos/Calendar";
import { ReceivedView } from "@/components/proventos/Received";

const TABS = [
  { id: "recibidos", label: "Recibidos" },
  { id: "calendario", label: "Próximos" },
] as const;

export default function Proventos() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("recibidos");
  return (
    <div className="space-y-4">
      <div className="flex rounded-full bg-surface-2 p-0.5 sm:w-fit" role="tablist" aria-label="Proventos">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-full px-4 py-1.5 text-sm sm:flex-none ${tab === t.id ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-3"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "recibidos" ? <ReceivedView /> : <DividendCalendar />}
    </div>
  );
}
