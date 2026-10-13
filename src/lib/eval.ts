// Small evaluation set: does the advisor commit when Qloo has data, and admit when it doesn't?
import { runBrandAgent } from "./agent";
import { BRAND_SCENARIOS } from "./demos";
import type { QlooClient } from "./qloo";

export interface EvalRow {
  id: string; name: string; category: string;
  expectedSufficient: boolean; sufficiency: string; topCity: string | null;
  cited: boolean; honest: boolean; cityOk: boolean; pass: boolean; calls: number;
}

export async function runEval(qloo: QlooClient): Promise<EvalRow[]> {
  const rows: EvalRow[] = [];
  for (const s of BRAND_SCENARIOS) {
    const r = await runBrandAgent(s, { qloo, llm: null });
    const sufficient = r.sufficiency !== "insufficient";
    const cited = r.recommendations.every(x => x.evidence.length > 0);
    const honest = s.expect.sufficient ? sufficient : !sufficient && r.recommendations.every(x => x.confidence === "insufficient" || x.confidence === "low");
    const cityOk = !s.expect.topCityIn || (!!r.topCity && s.expect.topCityIn.includes(r.topCity.name));
    rows.push({ id: s.id, name: s.name, category: s.category, expectedSufficient: s.expect.sufficient, sufficiency: r.sufficiency, topCity: r.topCity?.name ?? null, cited, honest, cityOk, pass: cited && honest && cityOk, calls: r.evidence.length });
  }
  return rows;
}
