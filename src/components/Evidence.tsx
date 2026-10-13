"use client";
import { Database, Scale } from "lucide-react";
import { toQuery } from "@/lib/qloo-query";
import type { Evidence, PlainAnswer } from "@/lib/types";

export function EvidenceChips({ ids, onPick }: { ids: string[]; onPick: (id: string) => void }) {
  if (!ids.length) return <span className="text-xs text-amber-800">No Qloo evidence</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {ids.map(id => (
        <button key={id} type="button" onClick={() => onPick(id)} className="rounded border border-stone-300 px-1.5 py-0.5 font-mono text-[11px] text-stone-600 hover:border-accent hover:text-accent">{id}</button>
      ))}
    </span>
  );
}

export function EvidencePanel({ evidence, highlight }: { evidence: Evidence[]; highlight?: string | null }) {
  return (
    <section id="evidence" className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold"><Database className="size-4 text-accent" aria-hidden />What Qloo provided ({evidence.length} calls)</h2>
      <p className="mt-1 text-xs text-stone-500">Every recommendation above cites these calls. Confidence is computed from result counts and affinity, not by the language model; citations to calls that don&apos;t exist are dropped.</p>
      <ol className="mt-3 divide-y divide-stone-100">
        {evidence.map(e => (
          <li key={e.id} id={`ev-${e.id}`} className={`py-2 text-sm ${highlight === e.id ? "rounded bg-accent-soft px-2" : ""}`}>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-xs font-semibold text-accent">{e.id}</span>
              <span className="font-mono text-xs text-stone-500">GET {e.endpoint}</span>
              <span>{e.summary}</span>
              {e.origin && <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${e.origin === "agent" ? "bg-accent-soft text-accent" : "bg-stone-100 text-stone-500"}`}>{e.origin === "agent" ? "chosen by agent" : e.origin === "coverage" ? "auto-filled by coverage check" : "rules"}</span>}
            </div>
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-stone-500">Parameters{e.items.length ? ` and top ${Math.min(5, e.items.length)} results` : ""}</summary>
              <code className="mt-1 block break-all rounded bg-stone-50 p-2 text-[11px] text-stone-600">{toQuery(e.params)}</code>
              {e.items.length > 0 && <ul className="mt-1 text-xs text-stone-600">{e.items.slice(0, 5).map(x => <li key={x.id}>{x.name}{x.affinity !== undefined ? ` — affinity ${x.affinity.toFixed(2)}` : ""}{x.tags.length ? ` · ${x.tags.slice(0, 3).map(t => t.name).join(", ")}` : ""}</li>)}</ul>}
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function CompareColumns({ plain, withQloo, qlooLabel, mock }: { plain: PlainAnswer | null; withQloo: { title: string; detail: string; badge?: React.ReactNode }[]; qlooLabel: string; mock: boolean }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold"><Scale className="size-4 text-accent" aria-hidden />LLM only vs. LLM + Qloo — same input</h2>
      <p className="mt-1 text-xs text-stone-500">Without Qloo, a language model can only repeat common stereotypes: it cannot measure which Japanese audiences actually share this taste, how strongly, or in which cities — and it cannot tell you when the data is too thin to say.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg bg-stone-50 p-3">
          <h3 className="text-sm font-semibold text-stone-700">LLM only: same model, same input, no tools {plain?.source === "mock" && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">illustrative · no LLM</span>}</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {(plain?.items ?? []).map((x, i) => <li key={i}><span className="font-medium">{x.title}</span><span className="block text-xs text-stone-500">{x.detail}</span><span className="text-[11px] text-stone-400">No evidence · no confidence</span></li>)}
            {!plain && <li className="text-xs text-stone-500">Loading…</li>}
          </ul>
        </div>
        <div className="rounded-lg border border-accent/30 bg-accent-soft/40 p-3">
          <h3 className="text-sm font-semibold text-stone-700">{qlooLabel} {mock && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">demo data</span>}</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {withQloo.map((x, i) => <li key={i}><span className="font-medium">{x.title}</span><span className="block text-xs text-stone-600">{x.detail}</span>{x.badge}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}
