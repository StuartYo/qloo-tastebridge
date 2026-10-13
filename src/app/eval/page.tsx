import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus, X } from "lucide-react";
import { runEval, type EvalRow } from "@/lib/eval";
import { createQlooClient } from "@/lib/qloo";
import { loadShowcase } from "@/lib/showcase";
import { modelLabel } from "@/components/RunMeta";

export const metadata: Metadata = { title: "Evaluation | TasteBridge" };

const Mark = ({ ok }: { ok: boolean | null }) => (ok === null ? <Minus className="size-4 text-stone-400" aria-label="not applicable" /> : ok ? <Check className="size-4 text-emerald-700" aria-label="pass" /> : <X className="size-4 text-red-700" aria-label="fail" />);
const pct = (n: number) => `${Math.round(n * 100)}%`;

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <div className="text-xs text-stone-500">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-stone-500">{note}</div>
    </div>
  );
}

export default async function EvalPage() {
  // Live results come from the pre-generated bundle (real Claude agent + live Qloo, scored by code).
  // Without it, the page falls back to the rules agent on the bundled demo data, labelled as such.
  const bundle = await loadShowcase();
  const live = !!bundle?.eval?.length;
  const rows: EvalRow[] = live ? bundle!.eval! : await runEval(createQlooClient({ env: { QLOO_MODE: "mock" } }));
  const passed = rows.filter(r => r.pass).length;
  const thin = rows.filter(r => !r.expectedSufficient);
  const withCity = rows.filter(r => r.cityAgrees !== null);
  const costs = rows.map(r => r.usd).filter((v): v is number => v !== null);
  // Brand analyses with enough data (the full agent loop) vs. the all-scenario average, which includes thin cases that stop early.
  const full = rows.filter(r => r.expectedSufficient && r.usd !== null).map(r => r.usd!);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const range = full.length ? `about US$${avg(full).toFixed(2)} per brand analysis (range ${Math.min(...full).toFixed(3)}–${Math.max(...full).toFixed(3)}, average ${avg(full).toFixed(3)})` : "";
  const calls = rows.reduce((s, r) => s + r.calls, 0), agentCalls = rows.reduce((s, r) => s + r.agentCalls, 0);

  return (
    <div className="space-y-5 pt-8">
      <h1 className="text-2xl font-semibold tracking-tight">Evaluation set</h1>
      <p className="max-w-3xl text-sm text-stone-600">
        Eight fictional Taiwanese brands. A good advisor must (1) cite Qloo evidence for every recommendation, (2) commit when Qloo has data, (3) say &quot;not enough data&quot; when it doesn&apos;t (the last two rows are deliberately thin), and (4) recommend the city that Qloo&apos;s place data ranks first, or one tied with it. Everything is scored by code from the finished report; no model grades itself.
      </p>
      {live
        ? <p className="inline-block rounded bg-stone-100 px-2 py-1 text-xs text-stone-700">Live run: {modelLabel(bundle!.model)} agent with live Qloo data, {bundle!.generatedAt.slice(0, 10)}. Re-run with npm run showcase:build.</p>
        : <p className="inline-block rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">Run on DEMO DATA (mock) with the rules-based agent. The live evaluation appears here once the private results bundle is available.</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Scenarios passed" value={`${passed} / ${rows.length}`} note="all four checks" />
        <Stat label="Citation coverage" value={pct(rows.reduce((s, r) => s + r.citationCoverage, 0) / rows.length)} note={`${rows.reduce((s, r) => s + r.droppedCitations, 0)} invented evidence IDs dropped`} />
        <Stat label="Honest on thin data" value={`${thin.filter(r => r.honest).length} / ${thin.length}`} note="said 'not enough data', no city" />
        <Stat label="City choice" value={`${withCity.filter(r => r.cityAgrees).length} / ${withCity.length}`} note="recommended city matches Qloo ranking" />
        {live && <Stat label="Agent-chosen Qloo calls" value={pct(agentCalls / Math.max(1, calls))} note="rest auto-filled by coverage check" />}
        {live && costs.length > 0 && <Stat label="Claude cost, all scenarios" value={`US$${avg(costs).toFixed(3)}`} note={`average across all ${costs.length}; ${range}`} />}
      </div>

      {/* Phones: one card per scenario instead of a wide table. */}
      <ul className="space-y-3 md:hidden">
        {rows.map(r => (
          <li key={r.id} className="rounded-xl border border-stone-200 bg-white p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div><Link href={`/?s=${r.id}`} className="font-medium hover:text-accent hover:underline">{r.name}</Link><div className="text-xs text-stone-500">{r.category}</div></div>
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${r.pass ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{r.pass ? "PASS" : "FAIL"}</span>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <dt className="text-stone-500">Expected</dt><dd>{r.expectedSufficient ? "enough data" : "should refuse"}</dd>
              <dt className="text-stone-500">Coverage</dt><dd>{r.sufficiency}</dd>
              <dt className="text-stone-500">Top city (Qloo)</dt><dd>{r.topCity ?? "n/a"}</dd>
              <dt className="text-stone-500">City in advice</dt><dd className="flex items-center gap-1">{r.recommendedCity ?? "n/a"}{r.recommendedCity && <Mark ok={r.cityAgrees} />}</dd>
              <dt className="text-stone-500">Cites evidence</dt><dd className="flex items-center gap-1"><Mark ok={r.cited} />{pct(r.citationCoverage)}</dd>
              <dt className="text-stone-500">Honest</dt><dd><Mark ok={r.honest} /></dd>
              <dt className="text-stone-500">Qloo calls</dt><dd>{r.calls} ({r.agentCalls} agent / {r.coverageCalls} auto)</dd>
              {live && <><dt className="text-stone-500">Claude cost</dt><dd>{r.usd !== null ? `$${r.usd.toFixed(3)}` : "n/a"}</dd></>}
            </dl>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-xl border border-stone-200 bg-white md:block">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-stone-50 text-xs text-stone-500">
            <tr>
              <th className="p-3">Brand</th><th className="p-3">Expected</th><th className="p-3">Coverage</th><th className="p-3">Top city (Qloo)</th><th className="p-3">City in advice</th>
              <th className="p-3">Cites</th><th className="p-3">Honest</th><th className="p-3">City OK</th><th className="p-3">Qloo calls (agent / auto)</th>{live && <th className="p-3">Cost</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map(r => (
              <tr key={r.id}>
                <td className="p-3"><Link href={`/?s=${r.id}`} className="font-medium hover:text-accent hover:underline">{r.name}</Link><div className="text-xs text-stone-500">{r.category}</div></td>
                <td className="p-3">{r.expectedSufficient ? "enough data" : "should refuse"}</td>
                <td className="p-3">{r.sufficiency}</td>
                <td className="p-3">{r.topCity ?? "n/a"}</td>
                <td className="p-3">{r.recommendedCity ? <span className="flex items-center gap-1">{r.recommendedCity} <Mark ok={r.cityAgrees} /></span> : "n/a"}</td>
                <td className="p-3"><span className="flex items-center gap-1"><Mark ok={r.cited} /><span className="text-xs tabular-nums text-stone-500">{pct(r.citationCoverage)}</span></span></td>
                <td className="p-3"><Mark ok={r.honest} /></td>
                <td className="p-3"><Mark ok={r.cityOk} /></td>
                <td className="p-3 tabular-nums">{r.calls} <span className="text-xs text-stone-500">({r.agentCalls} / {r.coverageCalls})</span></td>
                {live && <td className="p-3 tabular-nums text-xs">{r.usd !== null ? `$${r.usd.toFixed(3)}` : "n/a"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="max-w-3xl text-xs text-stone-500">
        Open a brand to see its full report. &quot;City OK&quot; accepts any city the app itself reports as tied with the leader (fit gap under 0.03). Agent / auto: calls the model chose versus calls the coverage check added for steps the model skipped. Costs are estimated from token usage at list prices.
      </p>
    </div>
  );
}
