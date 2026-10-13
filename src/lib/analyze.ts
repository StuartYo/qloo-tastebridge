// One analysis = agent report + "LLM only" baseline, with cost protection:
// showcase bundle → in-memory answer cache → (LLM budget check) → live run.
import { runBrandAgent, runBridgeAgent } from "./agent";
import { compactDeep } from "./compact";
import { AGENT_MODEL, getLLM, Meter, reserveLlmRun, SMALL_MODEL, type LLM, type Usage } from "./llm";
import { plainBaseline } from "./plainllm";
import { createQlooClient, type QlooClient } from "./qloo";
import { cachedAnswer, storeAnswer } from "./ratelimit";
import { brandKey, bridgeKey, showcaseHit } from "./showcase";
import type { BrandInput, BrandReport, BridgeReport, PlainAnswer } from "./types";

export interface AnalysisBody<R = BrandReport | BridgeReport> {
  report: R;
  baseline: PlainAnswer;
  /** Claude tokens and estimated USD spent producing this answer (when it was produced). */
  usage: Usage | null;
  models: { agent: string; small: string } | null;
  served: "showcase" | "cache" | "live";
  generatedAt: string;
}

const BUDGET_NOTE = "The public demo's daily AI budget is used up, so this answer was assembled by rules from live Qloo data. The preset examples above show full AI results.";

export interface RunOptions { visitor: string; qloo?: QlooClient; llm?: LLM | null; skipCache?: boolean }

async function prepare(key: string, o: RunOptions) {
  if (!o.skipCache) {
    const hit = (await showcaseHit(key)) ?? cachedAnswer<AnalysisBody>(key);
    if (hit) return { hit: { ...hit, served: hit.served === "showcase" ? "showcase" : "cache" } as AnalysisBody };
  }
  let llm = o.llm === undefined ? getLLM() : o.llm;
  let llmNote: string | undefined;
  if (llm && o.llm === undefined) {
    const b = reserveLlmRun(o.visitor);
    if (!b.ok) { llm = null; llmNote = BUDGET_NOTE; }
  }
  return { llm, llmNote, meter: new Meter() };
}

export async function analyzeBrand(input: BrandInput, o: RunOptions): Promise<AnalysisBody<BrandReport>> {
  const key = brandKey(input);
  const p = await prepare(key, o);
  if ("hit" in p) return p.hit as AnalysisBody<BrandReport>;
  const { llm, llmNote, meter } = p;
  const [report, baseline] = await Promise.all([
    runBrandAgent(input, { qloo: o.qloo ?? createQlooClient(), llm, meter, llmNote }),
    plainBaseline("brand", input, llm, meter),
  ]);
  const body: AnalysisBody<BrandReport> = { report: compactDeep(report), baseline, usage: llm ? meter.usage : null, models: llm ? { agent: AGENT_MODEL, small: SMALL_MODEL } : null, served: "live", generatedAt: new Date().toISOString() };
  if (!llmNote) storeAnswer(key, body); // budget-limited rules answers are not cached, so AI answers return once the cap resets
  return body;
}

export async function analyzeBridge(text: string, o: RunOptions): Promise<AnalysisBody<BridgeReport>> {
  const key = bridgeKey(text);
  const p = await prepare(key, o);
  if ("hit" in p) return p.hit as AnalysisBody<BridgeReport>;
  const { llm, llmNote, meter } = p;
  const [report, baseline] = await Promise.all([
    runBridgeAgent(text, { qloo: o.qloo ?? createQlooClient(), llm, meter, llmNote }),
    plainBaseline("bridge", text, llm, meter),
  ]);
  const body: AnalysisBody<BridgeReport> = { report: compactDeep(report), baseline, usage: llm ? meter.usage : null, models: llm ? { agent: AGENT_MODEL, small: SMALL_MODEL } : null, served: "live", generatedAt: new Date().toISOString() };
  if (!llmNote) storeAnswer(key, body); // budget-limited rules answers are not cached, so AI answers return once the cap resets
  return body;
}
