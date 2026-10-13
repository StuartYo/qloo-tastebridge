// Evaluation set: does the advisor cite evidence, commit when Qloo has data, admit when it doesn't,
// and pick a sensible city? Scored by code from the finished report (no LLM judge).
import { runBrandAgent, JP_CITIES } from "./agent";
import { BRAND_SCENARIOS, type BrandScenario } from "./demos";
import type { QlooClient } from "./qloo";
import type { BrandReport } from "./types";
import type { Usage } from "./llm";

export interface EvalRow {
  id: string; name: string; category: string;
  expectedSufficient: boolean; sufficiency: string; topCity: string | null;
  /** Share of recommendations with at least one valid evidence ID. */
  citationCoverage: number;
  /** Citations the model made to evidence that doesn't exist (dropped by code). */
  droppedCitations: number;
  cited: boolean; honest: boolean; cityOk: boolean;
  /** City named first in the recommendations, and whether it agrees with the code's ranking (top 2 when close). */
  recommendedCity: string | null; cityAgrees: boolean | null;
  pass: boolean;
  llm: "claude" | "rules";
  calls: number; agentCalls: number; coverageCalls: number;
  usd: number | null; tokens: number | null;
}

const HEDGE = /not enough|insufficient|too little|too thin|limited data|no reliable/i;

export function scoreReport(s: BrandScenario, r: BrandReport, usage: Usage | null = null): EvalRow {
  const sufficient = r.sufficiency !== "insufficient";
  const recs = r.recommendations;
  const citedN = recs.filter(x => x.evidence.length > 0).length;
  const cited = recs.length > 0 && citedN === recs.length;
  const honest = s.expect.sufficient
    ? sufficient && !(r.llm === "claude" && HEDGE.test(r.summary) && r.sufficiency === "ok")
    : !sufficient && recs.every(x => x.confidence === "insufficient" || x.confidence === "low") && HEDGE.test(r.summary);
  // Cities the app itself presents as tied with the leader (gap < 0.03) count as its pick too.
  const [c1] = r.cities;
  const okCities = c1 ? r.cities.filter(c => c1.score - c.score < 0.03).map(c => c.name) : [];
  const cityOk = !s.expect.topCityIn || (!!r.topCity && okCities.some(c => s.expect.topCityIn!.includes(c)));
  const text = recs.map(x => `${x.title} ${x.detail}`).join(" ");
  const recommendedCity = JP_CITIES.map(c => ({ c, i: text.indexOf(c) })).filter(x => x.i >= 0).sort((a, b) => a.i - b.i)[0]?.c ?? null;
  const cityAgrees = !sufficient || !recommendedCity ? null : okCities.includes(recommendedCity);
  return {
    id: s.id, name: s.name, category: s.category, expectedSufficient: s.expect.sufficient, sufficiency: r.sufficiency, topCity: r.topCity?.name ?? null,
    citationCoverage: recs.length ? citedN / recs.length : 0, droppedCitations: r.droppedCitations ?? 0,
    cited, honest, cityOk, recommendedCity, cityAgrees,
    pass: cited && honest && cityOk && cityAgrees !== false,
    llm: r.llm, calls: r.evidence.length,
    agentCalls: r.evidence.filter(e => e.origin === "agent").length, coverageCalls: r.evidence.filter(e => e.origin === "coverage").length,
    usd: usage ? usage.usd : null, tokens: usage ? usage.input + usage.output + usage.cacheRead + usage.cacheWrite : null,
  };
}

/** Rules-only run (no LLM): deterministic, used by unit tests and as the page fallback. */
export async function runEval(qloo: QlooClient): Promise<EvalRow[]> {
  const rows: EvalRow[] = [];
  for (const s of BRAND_SCENARIOS) rows.push(scoreReport(s, await runBrandAgent(s, { qloo, llm: null })));
  return rows;
}
