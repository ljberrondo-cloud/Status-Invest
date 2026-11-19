"use client";

import { useSyncExternalStore } from "react";

export type ThemeChoice = "auto" | "light" | "dark";
import { THEME_KEY as KEY } from "@/lib/boot-scripts";


const listeners = new Set<() => void>();
function read(): ThemeChoice {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "auto";
  } catch {
    return "auto";
  }
}
function apply(t: ThemeChoice) {
  try {
    if (t === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {}
  if (t === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  listeners.forEach((l) => l());
}

export function useTheme() {
  const theme = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => "auto" as ThemeChoice,
  );
  return { theme, setTheme: apply };
}

const OPTIONS: { id: ThemeChoice; label: string; icon: string }[] = [
  { id: "auto", label: "Automático (conforme o aparelho)", icon: "M12 3a9 9 0 1 0 0 18zM12 3a9 9 0 0 1 0 18" },
  { id: "light", label: "Claro", icon: "M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m0-11.4L4.9 4.9m14.2 14.2-1.4-1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" },
  { id: "dark", label: "Escuro", icon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" },
];

/** Selector Auto / Claro / Oscuro. */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  if (compact) {
    // Celular: un botón que rota entre las tres opciones.
    const i = OPTIONS.findIndex((o) => o.id === theme);
    const cur = OPTIONS[i];
    const next = OPTIONS[(i + 1) % OPTIONS.length];
    return (
      <button
        onClick={() => setTheme(next.id)}
        aria-label={`Tema: ${cur.label}. Mudar para ${next.label}`}
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-ink shadow-[var(--shadow)]"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d={cur.icon} />
        </svg>
      </button>
    );
  }
  return (
    <div className="flex rounded-xl bg-surface-2 p-1" role="radiogroup" aria-label="Tema">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={theme === o.id}
          title={o.label}
          onClick={() => setTheme(o.id)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition ${theme === o.id ? "bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.1)]" : "text-ink-3 hover:text-ink-2"}`}
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={o.icon} />
          </svg>
          {o.id === "auto" ? "Auto" : o.label}
        </button>
      ))}
    </div>
  );
}
