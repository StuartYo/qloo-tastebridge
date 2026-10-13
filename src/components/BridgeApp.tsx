"use client";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Film, Loader2, MapPin, Music, Search, ShoppingBag, Tv } from "lucide-react";
import { AffinityBars } from "./charts";
import { CompareColumns, EvidenceChips, EvidencePanel } from "./Evidence";
import { MockTag } from "./ModeBanner";
import { BRIDGE_EXAMPLES } from "@/lib/demos";
import type { BridgeReport, EntityKind, PlainAnswer } from "@/lib/types";

const TasteMap = dynamic(() => import("./TasteMap"), { ssr: false, loading: () => <div className="h-72 animate-pulse rounded-lg bg-stone-100 sm:h-96" /> });
const OSAKA: [number, number] = [34.6937, 135.5023];
const CATS: { kind: EntityKind; label: string; icon: typeof Music }[] = [
  { kind: "artist", label: "Music", icon: Music }, { kind: "movie", label: "Film", icon: Film },
  { kind: "tv_show", label: "TV", icon: Tv }, { kind: "brand", label: "Brands with Japan as a key market", icon: ShoppingBag },
];

export function BridgeApp() {
  const [text, setText] = useState("");
  const [data, setData] = useState<{ report: BridgeReport; baseline: PlainAnswer } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [highlight, setHighlight] = useState<string | null>(null);

  async function run(t: string) {
    setLoading(true); setError(""); setData(null);
    try {
      const res = await fetch("/api/bridge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: t }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Request failed");
      setData(j);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }
  const pick = (id: string) => { setHighlight(id); document.getElementById(`ev-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); };

  return (
    <div className="space-y-6 pt-8">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Taste Bridge: your Taiwan favourites, translated for Osaka</h1>
        <p className="max-w-3xl text-sm text-stone-600 sm:text-base">For students and workers moving from Taiwan to Japan. Type what you love at home (Chinese or English) and the agent finds Japanese music, film, TV, brands and Osaka places that Qloo links to the same taste.</p>
        <p className="max-w-3xl text-xs text-stone-500">Qloo results describe what groups of people with these tastes tend to like, not a prediction about you. Only the titles you type are sent to Qloo; please don&apos;t enter names, e-mails or other personal details.</p>
      </section>
      <form className="space-y-3 rounded-xl border border-stone-200 bg-white p-4 sm:p-5" onSubmit={e => { e.preventDefault(); if (text.trim()) run(text); }}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className="flex-1 rounded-md border border-stone-300 px-3 py-2" value={text} onChange={e => setText(e.target.value)} placeholder="e.g. 周杰倫, 海角七號, 牛肉麵" maxLength={200} aria-label="Your favourites" />
          <button type="submit" disabled={loading || !text.trim()} className="flex items-center justify-center gap-2 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
            {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />}Translate
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {BRIDGE_EXAMPLES.map(x => <button key={x} type="button" disabled={loading} onClick={() => { setText(x); run(x); }} className="rounded-full border border-stone-300 px-3 py-1 text-xs hover:border-accent hover:text-accent disabled:opacity-50">{x}</button>)}
        </div>
      </form>
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {data && <Result r={data.report} baseline={data.baseline} onPick={pick} highlight={highlight} />}
    </div>
  );
}

function Result({ r, baseline, onPick, highlight }: { r: BridgeReport; baseline: PlainAnswer; onPick: (id: string) => void; highlight: string | null }) {
  const mock = r.qlooMode === "mock";
  const markers = useMemo(() => r.places.filter(p => p.entity.lat !== undefined).map(p => ({ lat: p.entity.lat!, lon: p.entity.lon!, label: p.entity.name, sub: p.why })), [r.places]);
  const all = CATS.flatMap(c => r.picks[c.kind] ?? []).map(p => p.entity).sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0));

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500"><span>Agent: {r.llm === "claude" ? "Claude + Qloo tools" : "rules-based fallback + Qloo"}</span>·<span>{r.evidence.length} Qloo calls</span><MockTag show={mock} /></div>
        <p className="mt-2">{r.summary}</p>
        {r.llm === "rules" && <p className="mt-1 text-xs text-stone-500">AI explanation needs an LLM key. The &quot;why&quot; lines below are built by rules from shared Qloo tags and affinity scores.</p>}
        {r.unmatched.length > 0 && <p className="mt-1 text-xs text-amber-800">Not found in Qloo: {r.unmatched.join(", ")}</p>}
      </section>
      {r.seeds.length > 0 && (
        <>
          <div className="grid gap-6 sm:grid-cols-2">
            {CATS.map(({ kind, label, icon: Icon }) => (
              <section key={kind} className="rounded-xl border border-stone-200 bg-white p-4">
                <h2 className="mb-2 flex items-center gap-2 font-semibold"><Icon className="size-4 text-accent" aria-hidden />{kind === "brand" ? label : `Japan · ${label}`}<MockTag show={mock} /></h2>
                {(r.picks[kind] ?? []).length === 0 && <p className="text-sm text-stone-500">No Qloo results for this category.</p>}
                <ul className="space-y-2">
                  {(r.picks[kind] ?? []).map(p => (
                    <li key={p.entity.id} className="text-sm">
                      <div className="flex items-baseline justify-between gap-2"><span className="font-medium">{p.entity.name}</span><span className="text-xs tabular-nums text-stone-500">{p.entity.affinity?.toFixed(2)}</span></div>
                      <p className="text-xs text-stone-600">{p.why}</p>
                      <div className="mt-1"><EvidenceChips ids={p.evidence} onPick={onPick} /></div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <section className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
            <h2 className="mb-3 font-semibold">Taste similarity (Qloo affinity) <MockTag show={mock} /></h2>
            <AffinityBars items={all} max={10} />
          </section>
          {markers.length > 0 && (
            <section className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
              <h2 className="mb-3 flex items-center gap-2 font-semibold"><MapPin className="size-4 text-accent" aria-hidden />Osaka places for your taste <MockTag show={mock} /></h2>
              <TasteMap center={OSAKA} markers={markers} />
              <ol className="mt-3 space-y-1 text-sm">{r.places.map((p, i) => <li key={p.entity.id}><span className="font-mono text-xs text-stone-500">{i + 1}.</span> <span className="font-medium">{p.entity.name}</span> <span className="text-xs text-stone-500">— {p.why}</span></li>)}</ol>
            </section>
          )}
        </>
      )}
      <CompareColumns plain={baseline} mock={mock} qlooLabel={r.llm === "claude" ? "LLM + Qloo (this agent)" : "Qloo + rules (this agent, no LLM key yet)"}
        withQloo={CATS.flatMap(c => (r.picks[c.kind] ?? []).slice(0, 1)).concat(r.places.slice(0, 1)).map(p => ({ title: p.entity.name, detail: p.why, badge: <EvidenceChips ids={p.evidence} onPick={onPick} /> }))} />
      <EvidencePanel evidence={r.evidence} highlight={highlight} />
    </div>
  );
}
