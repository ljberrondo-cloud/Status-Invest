"use client";

import { useRef, useState } from "react";
import { ACCOUNTS, type AccountId } from "@/lib/accounts";
import { fmtBRL } from "@/lib/format";
import { isoToBr } from "@/lib/dates";
import { Icon } from "../icons";
import { Segmented } from "../ui";

interface UploadResult {
  ok: boolean;
  error?: string;
  message?: string;
  saved?: boolean;
  duplicate?: boolean;
  found?: number;
  isNew?: number;
  total?: number;
  period?: { from: string; to: string };
  account?: string;
  kind?: string;
  positions?: { asOf: string; count: number } | null;
}

/** Botón + panel para subir el extracto de Movimentação de B3 (PDF o Excel). */
export function UploadExtract({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [account, setAccount] = useState<AccountId>("mi-cuenta");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function send() {
    if (!file) return;
    setBusy(true);
    setResult(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("account", account);
    try {
      const r = await fetch("/api/b3-upload", { method: "POST", body: fd });
      setResult((await r.json().catch(() => ({ ok: false, error: `Error ${r.status}` }))) as UploadResult);
      if (r.ok) {
        setFile(null);
        if (input.current) input.current.value = "";
      }
    } catch {
      setResult({ ok: false, error: "No hay conexión. Probá de nuevo." });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-bg shadow-[var(--shadow)] transition hover:opacity-90"
      >
        <Icon name="up" className="h-4 w-4 -rotate-45" strokeWidth={2.2} />
        Subir extracto de B3
      </button>
    );
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">Subir extracto de B3</h2>
          <p className="mt-0.5 text-xs text-ink-3">
            Relatório consolidado mensual (Excel) o extracto de Movimentação (PDF o Excel), de la Área do Investidor de B3.
          </p>
        </div>
        <button onClick={() => setOpen(false)} className="text-xs text-ink-3 hover:text-ink-2" aria-label="Cerrar">
          Cerrar
        </button>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <div className="mb-1.5 text-xs font-medium text-ink-2">¿De qué cuenta es?</div>
          <Segmented label="Cuenta" options={ACCOUNTS} value={account} onChange={setAccount} size="md" />
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line-strong px-4 py-4 transition hover:bg-surface-2/60">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <Icon name="income" className="h-4.5 w-4.5" />
          </span>
          <span className="min-w-0 flex-1 text-sm">
            {file ? (
              <>
                <span className="block truncate font-medium">{file.name}</span>
                <span className="text-xs text-ink-3">{Math.max(1, Math.round(file.size / 1024))} KB · tocá para cambiarlo</span>
              </>
            ) : (
              <>
                <span className="block font-medium">Elegir archivo</span>
                <span className="text-xs text-ink-3">PDF o Excel (.xlsx)</span>
              </>
            )}
          </span>
          <input
            ref={input}
            type="file"
            accept=".pdf,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
            }}
          />
        </label>
        <button
          onClick={send}
          disabled={!file || busy}
          className="w-full rounded-xl bg-ink py-2.5 text-sm font-semibold text-bg transition hover:opacity-90 disabled:opacity-40 sm:w-auto sm:px-6"
        >
          {busy ? "Procesando…" : "Subir y procesar"}
        </button>

        {result && (
          <div
            role="status"
            className={`rounded-xl px-4 py-3 text-sm ${result.ok ? (result.saved ? "bg-pos-bg text-pos" : "bg-surface-2 text-ink-2") : "bg-neg-bg text-neg"}`}
          >
            {!result.ok && result.error}
            {result.ok && (result.saved || result.duplicate) && (
              <>
                <b>Listo.</b>{" "}
                {!!result.found &&
                  (result.duplicate
                    ? "Los proventos de este archivo ya estaban cargados. "
                    : `${result.found} proventos de ${result.account} (${fmtBRL(result.total ?? 0)}), ${result.kind === "relatorio-anual" ? `año ${result.period!.from.slice(0, 4)}` : `del ${isoToBr(result.period!.from)} al ${isoToBr(result.period!.to)}`}${typeof result.isNew === "number" ? `; ${result.isNew} nuevos` : ""}. `)}
                {result.positions && `Posiciones de ${result.account} al ${isoToBr(result.positions.asOf)} (${result.positions.count} activos): se aplican si son más nuevas que las actuales. `}
                {(result.saved || result.positions) && "La app se actualiza en 2–3 minutos."}
              </>
            )}
            {result.ok && !result.saved && !result.duplicate && result.message}
          </div>
        )}
        <p className="text-[11px] text-ink-3">
          Se guardan sólo proventos y posiciones (activo, cantidad, montos). El archivo original no se guarda: tiene tus datos personales.
        </p>
      </div>
    </section>
  );
}
