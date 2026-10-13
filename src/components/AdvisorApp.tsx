"use client";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { AlertTriangle, Film, Loader2, MapPin, Music, ShoppingBag, Sparkles, Tv, Users } from "lucide-react";
import { AffinityBars, AudienceChart, CityFitBars, ConfidencePill } from "./charts";
import { CompareColumns, EvidenceChips, EvidencePanel } from "./Evidence";
import { MockTag } from "./ModeBanner";
import { DEMO_BRANDS } from "@/lib/demos";
import type { BrandInput, BrandReport, EntityKind, PlainAnswer } from "@/lib/types";

const TasteMap = dynamic(() => import("./TasteMap"), { ssr: false, loading: () => <div className="h-72 animate-pulse rounded-lg bg-stone-100 sm:h-96" /> });

const NEIGHBOR_CARDS: { kind: EntityKind; label: string; icon: typeof Music }[] = [
  { kind: "artist", label: "Music", icon: Music }, { kind: "movie", label: "Film", icon: Film },
  { kind: "tv_show", label: "TV", icon: Tv }, { kind: "brand", label: "Brands with Japan as a key market", icon: ShoppingBag },
];

export function AdvisorApp() {
  const [form, setForm] = useState<BrandInput>({ name: "", category: "", description: "" });
  const [data, setData] = useState<{ report: BrandReport; baseline: PlainAnswer } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [highlight, setHighlight] = useState<string | null>(null);

  async function run(input: BrandInput) {
    setLoading(true); setError(""); setData(null);
    try {
      const res = await fetch("/api/advise", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Request failed");
      setData(j);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }
  const pickEvidence = (id: string) => { setHighlight(id); document.getElementById(`ev-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); };

  return (
    <div className="space-y-6 pt-8">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Will your brand&apos;s taste travel to Japan?</h1>
        <p className="max-w-3xl text-sm text-stone-600 sm:text-base">For Taiwanese brands planning a Japan launch. An agent queries Qloo&apos;s taste graph to find which Japanese audiences share your customers&apos; tastes, which city fits best, and what culture to borrow — every recommendation linked to the Qloo data behind it, with an honest confidence level.</p>
      </section>

      <form className="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-[1fr_1fr] sm:p-5" onSubmit={e => { e.preventDefault(); if (form.name && form.category) run(form); }}>
        <label className="text-sm">Brand name
          <input className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Formosa Pearl" maxLength={80} />
        </label>
        <label className="text-sm">Category
          <input className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Bubble tea chain" maxLength={120} />
        </label>
        <label className="text-sm sm:col-span-2">What makes it distinct (optional)
          <input className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Price point, customers, signature product" maxLength={500} />
        </label>
        <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <span className="self-center text-xs text-stone-500">Try a sample (fictional) brand:</span>
            {DEMO_BRANDS.map(b => (
              <button key={b.id} type="button" disabled={loading} onClick={() => { const input = { name: b.name, category: b.category, description: b.description, keywords: b.keywords }; setForm(input); run(input); }}
                className="rounded-full border border-stone-300 px-3 py-1 text-xs hover:border-accent hover:text-accent disabled:opacity-50">{b.name} · {b.category}</button>
            ))}
          </div>
          <button type="submit" disabled={loading || !form.name || !form.category} className="flex items-center justify-center gap-2 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
            {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}Analyse
          </button>
        </div>
      </form>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {loading && <p className="flex items-center gap-2 text-sm text-stone-500"><Loader2 className="size-4 animate-spin" aria-hidden />The agent is querying Qloo: search, tags, audience, Japan taste neighbours, city fit, places, compare…</p>}
      {data && <Report report={data.report} baseline={data.baseline} onPick={pickEvidence} highlight={highlight} />}
    </div>
  );
}

function Card({ title, icon: Icon, children, mock, className = "" }: { title: string; icon: typeof Music; children: React.ReactNode; mock?: boolean; className?: string }) {
  return (
    <section className={`rounded-xl border border-stone-200 bg-white p-4 sm:p-5 ${className}`}>
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold"><Icon className="size-4 text-accent" aria-hidden />{title}<MockTag show={!!mock} /></h2>
      {children}
    </section>
  );
}

function Report({ report: r, baseline, onPick, highlight }: { report: BrandReport; baseline: PlainAnswer; onPick: (id: string) => void; highlight: string | null }) {
  const mock = r.qlooMode === "mock";
  const markers = useMemo(() => r.places.filter(p => p.lat !== undefined).map(p => ({ lat: p.lat!, lon: p.lon!, label: p.name, sub: `Qloo affinity ${p.affinity?.toFixed(2) ?? "—"}${p.tags.length ? " · " + p.tags.slice(0, 3).map(t => t.name).join(", ") : ""}` })), [r.places]);
  const center = useMemo<[number, number]>(() => (r.topCity ? [r.topCity.lat, r.topCity.lon] : [34.6937, 135.5023]), [r.topCity]);
  const insufficient = r.sufficiency === "insufficient";

  return (
    <div className="space-y-6">
      <section className={`rounded-xl border p-4 sm:p-5 ${insufficient ? "border-amber-300 bg-amber-50" : "border-stone-200 bg-white"}`}>
        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
          <span>Agent: {r.llm === "claude" ? "Claude + Qloo tools" : "rules-based fallback + Qloo"}</span>·<span>{r.evidence.length} Qloo calls</span>·
          <span>Data coverage: <strong className={insufficient ? "text-amber-900" : r.sufficiency === "thin" ? "text-stone-700" : "text-emerald-700"}>{r.sufficiency}</strong></span>
          <MockTag show={mock} />
        </div>
        {insufficient && <p className="mt-2 flex items-center gap-2 font-semibold text-amber-900"><AlertTriangle className="size-4" aria-hidden />Not enough Qloo data — we won&apos;t guess.</p>}
        <p className="mt-2 text-base">{r.summary}</p>
        {r.llm === "rules" && <p className="mt-2 text-xs text-stone-500">AI explanation needs an LLM key. This summary and the recommendations are assembled by fixed rules from the Qloo results below.</p>}
        {r.seeds.length > 0 && <p className="mt-2 text-xs text-stone-500">Taste proxies found in Qloo: {r.seeds.map(s => s.name).join(", ")}. Results describe what groups with this taste tend to like, not any one customer.</p>}
      </section>

      <Card title="Recommendations" icon={Sparkles} mock={mock}>
        <ol className="space-y-3">
          {r.recommendations.map((x, i) => (
            <li key={i} className="rounded-lg border border-stone-100 p-3">
              <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{x.title}</span><ConfidencePill c={x.confidence} /></div>
              <p className="mt-1 text-sm text-stone-600">{x.detail}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-stone-500">Evidence <EvidenceChips ids={x.evidence} onPick={onPick} /></div>
            </li>
          ))}
        </ol>
      </Card>

      {!insufficient && (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <Card title="City fit across Japan" icon={MapPin} mock={mock}><CityFitBars cities={r.cities} /><p className="mt-2 text-[11px] text-stone-500">Fit = mean Qloo affinity of the top matching places × coverage. Source: place insights per city.</p></Card>
            <Card title="Who the audience is" icon={Users} mock={mock}>{r.audience ? <AudienceChart audience={r.audience} /> : <p className="text-sm text-stone-500">Qloo returned no demographic data.</p>}</Card>
          </div>
          {markers.length > 0 && r.topCity && (
            <Card title={`Where in ${r.topCity.name}: taste heatmap and matching places`} icon={MapPin} mock={mock}>
              <TasteMap center={center} markers={markers} heat={r.heatmap} />
              <ol className="mt-3 grid gap-1 text-sm sm:grid-cols-2">{markers.map((m, i) => <li key={m.label}><span className="font-mono text-xs text-stone-500">{i + 1}.</span> {m.label}</li>)}</ol>
            </Card>
          )}
          <div className="grid gap-6 sm:grid-cols-2">
            {NEIGHBOR_CARDS.map(c => <Card key={c.kind} title={c.kind === "brand" ? c.label : `Japan · ${c.label}`} icon={c.icon} mock={mock}><AffinityBars items={r.neighbors[c.kind] ?? []} max={5} /></Card>)}
          </div>
        </>
      )}

      <CompareColumns plain={baseline} mock={mock} qlooLabel={r.llm === "claude" ? "LLM + Qloo (this agent)" : "Qloo + rules (this agent, no LLM key yet)"}
        withQloo={r.recommendations.slice(0, 5).map(x => ({ title: x.title, detail: x.detail, badge: <span className="mt-0.5 flex items-center gap-2"><ConfidencePill c={x.confidence} /><EvidenceChips ids={x.evidence} onPick={onPick} /></span> }))} />

      <EvidencePanel evidence={r.evidence} highlight={highlight} />
    </div>
  );
}
