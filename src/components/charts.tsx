import type { AudienceProfile, CityFit, Confidence, Entity } from "@/lib/types";

const AGE_LABEL: Record<string, string> = { "24_and_younger": "<25", "25_to_29": "25–29", "30_to_34": "30–34", "35_to_44": "35–44", "45_to_54": "45–54", "55_and_older": "55+" };

/** Diverging bars: positive = audience over-indexes vs average, negative = under-indexes. */
export function AudienceChart({ audience }: { audience: AudienceProfile }) {
  const rows = [...Object.entries(audience.age).map(([k, v]) => [AGE_LABEL[k] ?? k, v] as const), ...Object.entries(audience.gender).map(([k, v]) => [k[0].toUpperCase() + k.slice(1), v] as const)];
  const max = Math.max(0.01, ...rows.map(([, v]) => Math.abs(v)));
  return (
    <div className="space-y-1.5" role="img" aria-label="Audience affinity by age and gender">
      {rows.map(([label, v], i) => (
        <div key={label} className={`grid grid-cols-[3.5rem_1fr_3rem] items-center gap-2 text-xs ${i === Object.keys(audience.age).length ? "mt-3" : ""}`}>
          <span className="text-stone-600">{label}</span>
          <div className="relative h-4 rounded bg-stone-100">
            <div className="absolute inset-y-0 left-1/2 w-px bg-stone-300" />
            <div className={`absolute inset-y-0.5 rounded ${v >= 0 ? "left-1/2 bg-accent" : "right-1/2 bg-stone-400"}`} style={{ width: `${(Math.abs(v) / max) * 50}%` }} />
          </div>
          <span className="text-right tabular-nums text-stone-500">{v > 0 ? "+" : ""}{v.toFixed(2)}</span>
        </div>
      ))}
      <p className="pt-1 text-[11px] text-stone-500">Right of centre: over-indexes vs. the average audience. Source: Qloo demographics insights.</p>
    </div>
  );
}

export function AffinityBars({ items, max = 6 }: { items: Entity[]; max?: number }) {
  if (!items.length) return <p className="text-sm text-stone-500">No results from Qloo.</p>;
  return (
    <ul className="space-y-1.5">
      {items.slice(0, max).map(x => (
        <li key={x.id} className="grid grid-cols-[minmax(0,1fr)_5rem_2.5rem] items-center gap-2 text-sm">
          <span className="truncate" title={x.name}>{x.name}</span>
          <div className="h-2 rounded bg-stone-100"><div className="h-2 rounded bg-accent" style={{ width: `${Math.round((x.affinity ?? 0) * 100)}%` }} /></div>
          <span className="text-right text-xs tabular-nums text-stone-500">{x.affinity?.toFixed(2) ?? "n/a"}</span>
        </li>
      ))}
    </ul>
  );
}

export function CityFitBars({ cities }: { cities: CityFit[] }) {
  const max = Math.max(0.01, ...cities.map(c => c.score));
  return (
    <ul className="space-y-2">
      {cities.map((c, i) => (
        <li key={c.name} className="grid grid-cols-[4.5rem_1fr_5.5rem] items-center gap-2 text-sm">
          <span className={i === 0 ? "font-semibold" : ""}>{c.name}</span>
          <div className="h-3 rounded bg-stone-100"><div className={`h-3 rounded ${i === 0 ? "bg-accent" : "bg-stone-400"}`} style={{ width: `${(c.score / max) * 100}%` }} /></div>
          <span className="text-right text-xs tabular-nums text-stone-500">{c.score.toFixed(2)} · {c.count} places</span>
        </li>
      ))}
    </ul>
  );
}

const CONF: Record<Confidence, string> = {
  high: "bg-emerald-100 text-emerald-800", medium: "bg-sky-100 text-sky-800", low: "bg-stone-200 text-stone-700", insufficient: "bg-amber-100 text-amber-900",
};
export function ConfidencePill({ c }: { c: Confidence }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${CONF[c]}`}>{c === "insufficient" ? "insufficient data" : `${c} confidence`}</span>;
}
