"use client";

import useSWR, { useSWRConfig } from "swr";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { PortfolioResponse } from "@/lib/types";

const LS_KEY = "patrimonio:last";

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Error ${res.status}`);
  return json as T;
}

const noopSubscribe = () => () => {};
function readStoredRaw(): string | null {
  try {
    return localStorage.getItem(LS_KEY);
  } catch {
    return null;
  }
}

/**
 * Datos de la cartera. Mientras carga muestra la última respuesta guardada en el
 * dispositivo (marcada como `fromDevice`), así nunca se ve una pantalla vacía.
 */
export function usePortfolio() {
  const raw = useSyncExternalStore(noopSubscribe, readStoredRaw, () => null);
  const stored = useMemo(() => {
    try {
      return raw ? (JSON.parse(raw) as PortfolioResponse) : undefined;
    } catch {
      return undefined;
    }
  }, [raw]);
  const swr = useSWR<PortfolioResponse>("/api/portfolio", fetcher, {
    revalidateOnFocus: true,
    focusThrottleInterval: 5 * 60_000,
    keepPreviousData: true,
    onSuccess: (d) => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(d));
      } catch {}
    },
  });
  const data = swr.data ?? stored;
  return { data, error: swr.error as Error | undefined, isLoading: swr.isLoading, isValidating: swr.isValidating, fromDevice: !swr.data && !!stored };
}

export function useJson<T>(url: string | null) {
  return useSWR<T>(url, fetcher, { revalidateOnFocus: false, keepPreviousData: true });
}

/* Aviso del botón "Actualizar", compartido entre todas las instancias del hook. */
let refreshNote: string | null = null;
const noteListeners = new Set<() => void>();
const setRefreshNote = (n: string | null) => {
  refreshNote = n;
  noteListeners.forEach((l) => l());
};
const subscribeNote = (l: () => void) => {
  noteListeners.add(l);
  return () => noteListeners.delete(l);
};

/** Invalida el caché del servidor y vuelve a pedir todo. */
export function useRefresh() {
  const { mutate } = useSWRConfig();
  const [busy, setBusy] = useState(false);
  const note = useSyncExternalStore(subscribeNote, () => refreshNote, () => null);
  const refresh = useCallback(async () => {
    setBusy(true);
    setRefreshNote(null);
    try {
      const r = await fetch("/api/refresh", { method: "POST" });
      if (r.status === 429) {
        const j = await r.json().catch(() => ({}));
        setRefreshNote(`Ya se actualizó hace instantes. Reintentá en ${j.retryInSeconds ?? 60} s.`);
      }
      await mutate(() => true);
    } finally {
      setBusy(false);
    }
  }, [mutate]);
  return { refresh, busy, note };
}
