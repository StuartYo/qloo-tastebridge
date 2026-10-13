// `npm run showcase:build`: runs every preset (8 evaluation brands + Taste Bridge examples) with the real
// LLM agent and live Qloo, scores the evaluation set, and writes the private bundle to .data/showcase.json
// (git-ignored; `vercel deploy` ships it inside the private deployment). ONLY="pearl|周杰倫" rebuilds a subset.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { expect, test } from "vitest";
import { analyzeBrand, analyzeBridge } from "./analyze";
import { BRAND_SCENARIOS, BRIDGE_EXAMPLES } from "./demos";
import { scoreReport } from "./eval";
import { compactDeep } from "./compact";
import { AGENT_MODEL, addUsage, emptyUsage, getLLM, SMALL_MODEL } from "./llm";
import { createQlooClient } from "./qloo";
import { brandKey, bridgeKey, SHOWCASE_FILE, type ShowcaseBundle } from "./showcase";
import type { BrandReport } from "./types";

const build = process.env.npm_lifecycle_event === "showcase:build";
// The build needs keys only when it calls APIs; COMPACT_ONLY works offline.
if (build) { try { process.loadEnvFile(".env.local"); } catch { /* use shell env */ } }

test.runIf(build)("build showcase bundle with live Qloo + Claude", async () => {
  const qloo = createQlooClient();
  const llm = getLLM();
  if (qloo.mode !== "live") throw new Error("QLOO_API_KEY missing");
  if (!llm) throw new Error("ANTHROPIC_API_KEY missing");
  const only = (process.env.ONLY ?? "").split("|").map(s => s.trim()).filter(Boolean);
  const want = (id: string) => !only.length || only.includes(id);

  const file = SHOWCASE_FILE();
  const prev: ShowcaseBundle | null = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  const bundle: ShowcaseBundle = { version: 1, generatedAt: new Date().toISOString(), model: AGENT_MODEL, smallModel: SMALL_MODEL, entries: { ...(prev?.entries ?? {}) }, eval: prev?.eval };
  let total = emptyUsage();
  // COMPACT_ONLY=1: trim an existing bundle without calling any API.
  if (process.env.COMPACT_ONLY) {
    for (const e of Object.values(bundle.entries)) e.body.report = compactDeep(e.body.report);
    writeFileSync(file, JSON.stringify(bundle));
    return;
  }
  const log: Record<string, unknown>[] = [];

  for (const s of BRAND_SCENARIOS) {
    if (!want(s.id)) continue;
    const input = { name: s.name, category: s.category, description: s.description, keywords: s.keywords };
    const t0 = Date.now();
    const body = await analyzeBrand(input, { visitor: "build", qloo, llm, skipCache: true });
    bundle.entries[brandKey(input)] = { kind: "brand", label: s.name, body: { ...body, served: "showcase" } };
    if (body.usage) total = addUsage(total, body.usage);
    log.push({ id: s.id, llm: body.report.llm, suff: body.report.sufficiency, calls: body.report.evidence.length, llmCalls: body.usage?.calls, usd: body.usage?.usd.toFixed(4), cacheRead: body.usage?.cacheRead, cacheWrite: body.usage?.cacheWrite, secs: Math.round((Date.now() - t0) / 1000) });
  }
  for (const t of BRIDGE_EXAMPLES) {
    if (!want(t)) continue;
    const t0 = Date.now();
    const body = await analyzeBridge(t, { visitor: "build", qloo, llm, skipCache: true });
    bundle.entries[bridgeKey(t)] = { kind: "bridge", label: t, body: { ...body, served: "showcase" } };
    if (body.usage) total = addUsage(total, body.usage);
    log.push({ id: t, llm: body.report.llm, suff: body.report.sufficiency, calls: body.report.evidence.length, llmCalls: body.usage?.calls, usd: body.usage?.usd.toFixed(4), cacheRead: body.usage?.cacheRead, cacheWrite: body.usage?.cacheWrite, secs: Math.round((Date.now() - t0) / 1000) });
  }

  // Score the evaluation set from the stored brand entries.
  bundle.eval = BRAND_SCENARIOS.flatMap(s => {
    const e = bundle.entries[brandKey({ name: s.name, category: s.category, description: s.description, keywords: s.keywords })];
    return e ? [scoreReport(s, e.body.report as BrandReport, e.body.usage)] : [];
  });

  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(bundle));
  console.table(log);
  console.table(bundle.eval.map(r => ({ id: r.id, llm: r.llm, suff: r.sufficiency, top: r.topCity, recCity: r.recommendedCity, agrees: r.cityAgrees, cov: r.citationCoverage.toFixed(2), dropped: r.droppedCitations, honest: r.honest, cityOk: r.cityOk, pass: r.pass, agent: r.agentCalls, filled: r.coverageCalls })));
  console.log(`this run: ${total.calls} Claude calls, in ${total.input} / out ${total.output} / cache read ${total.cacheRead} / cache write ${total.cacheWrite} tokens, ~$${total.usd.toFixed(4)}`);
  expect(Object.keys(bundle.entries).length).toBeGreaterThan(0);
}, 3_600_000);
