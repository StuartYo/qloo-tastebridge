"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Film, Loader2, MapPin, Music, ShoppingBag, Sparkles, Tv, Users } from "lucide-react";
import { AffinityBars, AudienceChart, CityFitBars, ConfidencePill } from "./charts";
import { CompareColumns, EvidenceChips, EvidencePanel } from "./Evidence";
import { MockTag } from "./ModeBanner";
import { RunMeta } from "./RunMeta";
import { BRAND_SCENARIOS, DEMO_BRANDS } from "@/lib/demos";
import type { AnalysisBody } from "@/lib/analyze";
import type { BrandInput, BrandReport, EntityKind } from "@/lib/types";

const TasteMap = dynamic(() => import("./TasteMap"), { ssr: false, loading: () => <div className="h-72 animate-pulse rounded-lg bg-stone-100 sm:h-96" /> });

const NEIGHBOR_CARDS: { kind: EntityKind; label: string; icon: typeof Music }[] = [
  { kind: "artist", label: "Music", icon: Music }, { kind: "movie", label: "Film", icon: Film },
  { kind: "tv_show", label: "TV", icon: Tv }, { kind: "brand", label: "Brands with Japan as a key market", icon: ShoppingBag },
];

export function AdvisorApp() {
  const [form, setForm] = useState<BrandInput>({ name: "", category: "", description: "" });
  const [data, setData] = useState<AnalysisBody<BrandReport> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [highlight, setHighlight] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  // Bring the answer into view as soon as it arrives (phones included: the form fills the first screen).
  useEffect(() => { if (data) resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [data]);

  async function run(input: BrandInput) {
    setLoading(true); setError(""); setData(null);
    try {
      const res = await fetch("/api/advise", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Request failed");
      setData(j);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }
  // Deep link from the Evaluation tab: /?s=<scenario id> opens that scenario's report.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("s");
    const s = BRAND_SCENARIOS.find(x => x.id === id);
    if (!s) return;
    const input = { name: s.name, category: s.category, description: s.description, keywords: s.keywords };
    const t = setTimeout(() => { setForm({ ...input, description: input.description ?? "" }); run(input); }, 0);
    return () => clearTimeout(t);
  }, []);
  const pickEvidence = (id: string) => { setHighlight(id); document.getElementById(`ev-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); };

  return (
    <div className="space-y-6 pt-8">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Will your brand&apos;s taste travel to Japan?</h1>
        <p className="max-w-3xl text-sm text-stone-600 sm:text-base">For Taiwanese brands planning a Japan launch. An agent queries Qloo&apos;s taste graph to find which Japanese audiences share your customers&apos; tastes, which city fits best, and what culture to borrow. Every recommendation is linked to the Qloo data behind it, with an honest confidence level.</p>
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
      <div ref={resultsRef} className="scroll-mt-16">{data && <Report body={data} onPick={pickEvidence} highlight={highlight} />}</div>
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

function Report({ body, onPick, highlight }: { body: AnalysisBody<BrandReport>; onPick: (id: string) => void; highlight: string | null }) {
  const { report: r, baseline } = body;
  const mock = r.qlooMode === "mock";
  // One view per city the agent looked at in detail (top-ranked first); close calls can be compared.
  const views = useMemo(() => (r.cityViews?.length ? r.cityViews : r.places.length ? [{ city: r.placesCity ?? r.topCity?.name ?? "", places: r.places, heatmap: r.heatmap, evidence: [] as string[] }] : []), [r]);
  const [viewIdx, setViewIdx] = useState(0);
  const view = views[Math.min(viewIdx, views.length - 1)];
  const placesCity = view?.city;
  const markers = useMemo(() => (view?.places ?? []).filter(p => p.lat !== undefined).map(p => ({ lat: p.lat!, lon: p.lon!, label: p.name, sub: `Qloo affinity ${p.affinity?.toFixed(2) ?? "n/a"}${p.tags.length ? " · " + p.tags.slice(0, 3).map(t => t.name).join(", ") : ""}` })), [view]);
  const cityInfo = r.cities.find(c => c.name === placesCity) ?? r.topCity;
  const center = useMemo<[number, number]>(() => (cityInfo ? [cityInfo.lat, cityInfo.lon] : [34.6937, 135.5023]), [cityInfo]);
  const insufficient = r.sufficiency === "insufficient";

  return (
    <div className="space-y-6">
      <Conclusion r={r} />
      <section className={`rounded-xl border p-4 sm:p-5 ${insufficient ? "border-amber-300 bg-amber-50" : "border-stone-200 bg-white"}`}>
        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
          <span>Data coverage (computed from Qloo results): <strong className={insufficient ? "text-amber-900" : r.sufficiency === "thin" ? "text-stone-700" : "text-emerald-700"}>{r.sufficiency}</strong></span>
          <MockTag show={mock} />
        </div>
        {insufficient && <p className="mt-2 flex items-center gap-2 font-semibold text-amber-900"><AlertTriangle className="size-4" aria-hidden />Not enough Qloo data. We won&apos;t guess.</p>}
        <p className="mt-2 text-base">{r.summary}</p>
        {r.llm === "rules" && <p className="mt-2 text-xs text-stone-500">{r.llmNote ?? "AI explanation needs an LLM key."} This summary and the recommendations are assembled by fixed rules from the Qloo results below.</p>}
        {r.seeds.length > 0 && <p className="mt-2 text-xs text-stone-500">Taste proxies found in Qloo: {r.seeds.map(s => s.name).join(", ")}. Results describe what groups with this taste tend to like, not any one customer.</p>}
        <div className="mt-3 border-t border-stone-100 pt-2"><RunMeta body={body} calls={r.evidence.length} agentCalls={r.evidence.filter(e => e.origin === "agent").length} /></div>
      </section>

      <Card title="Recommendations" icon={Sparkles} mock={mock}>
        <ol className="space-y-3">
          {r.recommendations.map((x, i) => (
            <li key={i} className="rounded-lg border border-stone-100 p-3">
              <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{x.title}</span><ConfidencePill c={x.confidence} /></div>
              {x.confidenceNote && <p className="mt-0.5 text-[11px] text-stone-500">Confidence {x.confidenceNote}.</p>}
              <p className="mt-1 text-sm text-stone-600">{x.detail}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-stone-500">Evidence <EvidenceChips ids={x.evidence} onPick={onPick} /></div>
            </li>
          ))}
        </ol>
      </Card>

      {!insufficient && (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <Card title={r.cityScope === "category" ? `City fit for ${r.cityCategory?.join(" / ") ?? "same-category"} venues` : "City fit across Japan (overall taste)"} icon={MapPin} mock={mock}><CityFitBars cities={r.cities} /><p className="mt-2 text-[11px] text-stone-500">{r.cityScope === "category"
                ? `Category-specific: only ${r.cityCategory?.join(" / ") ?? "same-category"} venues within 15 km of each centre count. Fit = mean Qloo affinity of the top 5 × coverage (venues found, out of 5).`
                : "City score = overall taste affinity of the brand's audience, not category-specific: all places within 15 km count. Fit = mean Qloo affinity of the top 5 × coverage."} Gaps under 0.03 are a close call.</p></Card>
            <Card title="Who the audience is" icon={Users} mock={mock}>{r.audience ? <AudienceChart audience={r.audience} /> : <p className="text-sm text-stone-500">Qloo returned no demographic data.</p>}</Card>
          </div>
          {markers.length > 0 && placesCity && (
            <Card title={`Where in ${placesCity}: taste heatmap and matching places`} icon={MapPin} mock={mock}>
              {views.length > 1 && (
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs" role="tablist" aria-label="City">
                  <span className="text-stone-500">Cities the agent checked:</span>
                  {views.map((v, i) => (
                    <button key={v.city} type="button" role="tab" aria-selected={v.city === placesCity} onClick={() => setViewIdx(i)}
                      className={`rounded-full border px-3 py-1 ${v.city === placesCity ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 hover:border-accent hover:text-accent"}`}>
                      {v.city}{v.city === r.topCity?.name ? " (top fit)" : ""}
                    </button>
                  ))}
                  {view.evidence.length > 0 && <EvidenceChips ids={view.evidence} onPick={onPick} />}
                </div>
              )}
              <TasteMap center={center} markers={markers} heat={view?.heatmap ?? []} />
              <ol className="mt-3 grid gap-1 text-sm sm:grid-cols-2">{markers.map((m, i) => <li key={m.label}><span className="font-mono text-xs text-stone-500">{i + 1}.</span> {m.label}</li>)}</ol>
            </Card>
          )}
          <div className="grid gap-6 sm:grid-cols-2">
            {NEIGHBOR_CARDS.map(c => <Card key={c.kind} title={c.kind === "brand" ? c.label : `Japan · ${c.label}`} icon={c.icon} mock={mock}><AffinityBars items={r.neighbors[c.kind] ?? []} max={5} /></Card>)}
          </div>
        </>
      )}

      <CompareColumns plain={baseline} mock={mock} qlooLabel={r.llm === "claude" ? "Same model + Qloo tools (this agent)" : "Qloo + rules (this agent, no LLM)"}
        withQloo={r.recommendations.slice(0, 5).map(x => ({ title: x.title, detail: x.detail, badge: <span className="mt-0.5 flex items-center gap-2"><ConfidencePill c={x.confidence} /><EvidenceChips ids={x.evidence} onPick={onPick} /></span> }))} />

      <EvidencePanel evidence={r.evidence} highlight={highlight} />
    </div>
  );
}

const AGE: Record<string, string> = { "24_and_younger": "under 25", "25_to_29": "25 to 29", "30_to_34": "30 to 34", "35_to_44": "35 to 44", "45_to_54": "45 to 54", "55_and_older": "55+" };

/** The answer in one glance: city, neighbourhood, culture, audience. Every value comes from the report. */
function Conclusion({ r }: { r: BrandReport }) {
  if (r.sufficiency === "insufficient") {
    return (
      <section className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 sm:p-6" aria-label="Conclusion">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Conclusion for {r.input.name}</p>
        <p className="mt-1 text-2xl font-semibold text-amber-950 sm:text-3xl">Not enough Qloo data. No city, no audience.</p>
        <p className="mt-2 text-sm text-amber-900">Qloo found too few comparable venues or brands to measure this taste, so the agent does not guess.</p>
      </section>
    );
  }
  const [c1, c2] = r.cities;
  const close = !!c1 && !!c2 && c1.score - c2.score < 0.03;
  const view = r.cityViews?.find(v => v.city === c1?.name) ?? { city: r.placesCity, places: r.places };
  const top = view.places.slice(0, 5);
  const counts = new Map<string, number>();
  for (const p of top) if (p.city) counts.set(p.city, (counts.get(p.city) ?? 0) + 1);
  const district = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const venues = top.filter(p => !district || p.city === district).slice(0, 2).map(p => p.name);
  const culture = [...(r.neighbors.artist ?? []).slice(0, 2), ...(r.neighbors.movie ?? []).slice(0, 1)].map(x => x.name);
  const age = r.audience ? Object.entries(r.audience.age).sort((a, b) => b[1] - a[1])[0] : undefined;
  const rows: { label: string; value: string }[] = [
    ...(district || venues.length ? [{ label: `Where in ${view.city ?? c1?.name}`, value: `${district ?? ""}${district && venues.length ? ": " : ""}${venues.join(", ")}` }] : []),
    ...(culture.length ? [{ label: "Culture to borrow", value: culture.join(" · ") }] : []),
    ...(age ? [{ label: "Audience", value: age[1] >= 0.05 ? `leans ${AGE[age[0]] ?? age[0]}` : "no clear age skew" }] : []),
  ];
  return (
    <section className="rounded-2xl border-2 border-stone-900 bg-white p-5 sm:p-6" aria-label="Conclusion">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Conclusion for {r.input.name}</p>
      {c1 && <p className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Start in {c1.name}</p>}
      {c1 && c2 && <p className="mt-1 text-sm text-stone-600">{close ? `Close call: ${c1.name} ${c1.score.toFixed(2)} vs ${c2.name} ${c2.score.toFixed(2)} (gap ${(c1.score - c2.score).toFixed(3)}, under 0.03), so test both.` : `${c1.name} ${c1.score.toFixed(2)} vs ${c2.name} ${c2.score.toFixed(2)}.`} {r.cityScope === "category" ? `Scored on ${r.cityCategory?.join(" / ")} venues only.` : "Score = overall taste of the audience, not category-specific."}</p>}
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        {rows.map(x => (
          <div key={x.label} className="rounded-lg bg-stone-50 p-3">
            <dt className="text-xs text-stone-500">{x.label}</dt>
            <dd className="mt-0.5 text-lg font-medium leading-snug">{x.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-stone-500">From Qloo data: venues, Japanese culture and audience that people with the same taste as the brand&apos;s comparable customers tend to like. Details and evidence below.</p>
    </section>
  );
}
