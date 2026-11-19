"use client";

import { useEffect, useSyncExternalStore } from "react";
import { setPrivate } from "@/lib/privacy";

import { PRIVACY_KEY as KEY } from "@/lib/boot-scripts";


const listeners = new Set<() => void>();
function read() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
function save(v: boolean) {
  try {
    if (v) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {}
  listeners.forEach((l) => l());
}

/** Lee la preferencia y la aplica a las funciones de formato antes de dibujar. */
export function usePrivacy() {
  const hidden = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => false,
  );
  setPrivate(hidden);
  useEffect(() => {
    if (hidden === read()) delete document.documentElement.dataset.privacyPending;
  }, [hidden]);
  return { hidden, setHidden: save };
}

const EYE = "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z";
const EYE_OFF = "M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.6 3.5M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7c1.9 0 3.6-.6 5-1.5M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18";

/** Botón del ojo: muestra u oculta los montos. */
export function PrivacyToggle({ hidden, onChange, compact = false }: { hidden: boolean; onChange: (v: boolean) => void; compact?: boolean }) {
  const icon = (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={hidden ? EYE_OFF : EYE} />
    </svg>
  );
  if (compact)
    return (
      <button
        onClick={() => onChange(!hidden)}
        aria-pressed={hidden}
        aria-label={hidden ? "Mostrar montos" : "Ocultar montos"}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border shadow-[var(--shadow)] ${hidden ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink"}`}
      >
        {icon}
      </button>
    );
  return (
    <button
      onClick={() => onChange(!hidden)}
      aria-pressed={hidden}
      className={`flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs font-medium transition ${hidden ? "bg-accent-soft text-accent" : "bg-surface-2 text-ink-2 hover:text-ink"}`}
    >
      {icon}
      {hidden ? "Mostrar montos" : "Ocultar montos"}
    </button>
  );
}
