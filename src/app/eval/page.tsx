import type { Metadata } from "next";
import { Check, X } from "lucide-react";
import { runEval } from "@/lib/eval";
import { createQlooClient } from "@/lib/qloo";

export const metadata: Metadata = { title: "Evaluation — TasteBridge" };

const Mark = ({ ok }: { ok: boolean }) => (ok ? <Check className="size-4 text-emerald-700" aria-label="pass" /> : <X className="size-4 text-red-700" aria-label="fail" />);

export default async function EvalPage() {
  // Always runs on the bundled demo data so the page is deterministic and costs nothing.
  const rows = await runEval(createQlooClient({ env: { QLOO_MODE: "mock" } }));
  const passed = rows.filter(r => r.pass).length;
  return (
    <div className="space-y-4 pt-8">
      <h1 className="text-2xl font-semibold tracking-tight">Evaluation set</h1>
      <p className="max-w-3xl text-sm text-stone-600">
        Eight fictional brand scenarios. A good advisor must (1) cite Qloo evidence for every recommendation, (2) commit when data exists, and (3) say &quot;insufficient data&quot; when Qloo has little or nothing — the last two rows are deliberately thin. Rules-based agent shown so results are reproducible.
      </p>
      <p className="inline-block rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">Run on DEMO DATA (mock). Re-run against live Qloo with npm run eval:live.</p>
      <p className="text-sm font-medium">{passed} / {rows.length} passed</p>
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-stone-50 text-xs text-stone-500">
            <tr><th className="p-3">Brand</th><th className="p-3">Expected</th><th className="p-3">Coverage</th><th className="p-3">Top city</th><th className="p-3">Cites evidence</th><th className="p-3">Honest</th><th className="p-3">City OK</th><th className="p-3">Qloo calls</th></tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map(r => (
              <tr key={r.id}>
                <td className="p-3"><div className="font-medium">{r.name}</div><div className="text-xs text-stone-500">{r.category}</div></td>
                <td className="p-3">{r.expectedSufficient ? "enough data" : "should refuse"}</td>
                <td className="p-3">{r.sufficiency}</td>
                <td className="p-3">{r.topCity ?? "—"}</td>
                <td className="p-3"><Mark ok={r.cited} /></td>
                <td className="p-3"><Mark ok={r.honest} /></td>
                <td className="p-3"><Mark ok={r.cityOk} /></td>
                <td className="p-3 tabular-nums">{r.calls}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
