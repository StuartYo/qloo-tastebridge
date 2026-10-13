import { describe, expect, test } from "vitest";
import { Ctx, finalizeRecs, MAX_STEPS, runBrandAgent, runBridgeAgent, splitFavourites, type LLM } from "./agent";
import { BRAND_SCENARIOS, DEMO_BRANDS } from "./demos";
import { createQlooClient } from "./qloo";

const qloo = () => createQlooClient({ env: {} });
const toolUse = (id: string, name: string, input: unknown) => ({ type: "tool_use", id, name, input });

function scriptedLLM(steps: ((req: any) => any[])[]): LLM & { calls: any[] } {
  const calls: any[] = [];
  return { calls, messages: { async create(req: any) { calls.push(req); const s = steps[Math.min(calls.length - 1, steps.length - 1)]; return { content: s(req) }; } } };
}
const lastToolResult = (req: any) => JSON.parse(req.messages.at(-1).content[0].content);

describe("brand agent", () => {
  test("rules fallback: every recommendation cites existing evidence", async () => {
    const r = await runBrandAgent(DEMO_BRANDS[0], { qloo: qloo(), llm: null });
    expect(r.llm).toBe("rules");
    expect(r.sufficiency).toBe("ok");
    const ids = new Set(r.evidence.map(e => e.id));
    expect(r.recommendations.length).toBeGreaterThanOrEqual(4);
    for (const rec of r.recommendations) { expect(rec.evidence.length).toBeGreaterThan(0); rec.evidence.forEach(id => expect(ids.has(id)).toBe(true)); }
    expect(new Set(r.evidence.map(e => e.endpoint))).toEqual(new Set(["/search", "/v2/tags", "/v2/insights", "/v2/analysis/compare"]));
  });

  test("no Qloo match → says insufficient instead of guessing", async () => {
    const socks = BRAND_SCENARIOS.find(s => s.id === "socks")!;
    const r = await runBrandAgent(socks, { qloo: qloo(), llm: null });
    expect(r.sufficiency).toBe("insufficient");
    expect(r.topCity).toBeNull();
    expect(r.recommendations.every(x => x.confidence === "insufficient")).toBe(true);
  });

  test("Claude loop: tools run, bogus citations dropped, confidence computed by code, coverage filled", async () => {
    let seedId = "";
    const llm = scriptedLLM([
      () => [toolUse("t1", "search_entities", { query: "bubble tea", types: ["brand"] })],
      req => { seedId = lastToolResult(req).results[0].id; return [toolUse("t2", "japan_taste_neighbors", { entity_ids: [seedId], kind: "artist" })]; },
      () => [toolUse("t3", "submit_report", { summary: "S", recommendations: [{ title: "Partner with J-pop acts", detail: "d", evidence_ids: ["E2", "E99"] }] })],
    ]);
    const r = await runBrandAgent(DEMO_BRANDS[0], { qloo: qloo(), llm });
    expect(llm.calls).toHaveLength(3);
    expect(llm.calls[0].model).toBe("claude-sonnet-5-5");
    expect(r.llm).toBe("claude");
    expect(r.summary).toBe("S");
    expect(r.recommendations[0].evidence).toEqual(["E2"]);
    expect(["high", "medium", "low", "insufficient"]).toContain(r.recommendations[0].confidence);
    expect(r.seeds[0].id).toBe(seedId);
    expect(r.cities.length).toBeGreaterThan(0);
    expect(r.audience).not.toBeNull();
  });

  test("Claude failure falls back to rules", async () => {
    const llm: LLM = { messages: { create: async () => { throw new Error("overloaded"); } } };
    const r = await runBrandAgent(DEMO_BRANDS[1], { qloo: qloo(), llm });
    expect(r.llm).toBe("rules");
    expect(r.recommendations.length).toBeGreaterThan(0);
  });

  test("loop stops after MAX_STEPS", async () => {
    const llm = scriptedLLM([() => [toolUse("t", "search_entities", { query: "tea" })]]);
    const r = await runBrandAgent(DEMO_BRANDS[2], { qloo: qloo(), llm });
    expect(llm.calls).toHaveLength(MAX_STEPS);
    expect(r.llm).toBe("rules");
  });
});

test("finalizeRecs marks unsupported claims", () => {
  const ctx = new Ctx(qloo());
  ctx.record("search_entities", "/search", {}, [], "nothing", 0);
  const [rec] = finalizeRecs(ctx, [{ title: "Open in Tokyo", detail: "", evidence: ["E1"] }]);
  expect(rec.confidence).toBe("insufficient");
  expect(rec.title).toMatch(/^Not enough Qloo data/);
});

test("splitFavourites handles Chinese punctuation", () => {
  expect(splitFavourites("周杰倫、五月天，海角七號\n牛肉麵")).toEqual(["周杰倫", "五月天", "海角七號", "牛肉麵"]);
});

test("bridge agent maps Taiwanese favourites to Japan and Osaka", async () => {
  const r = await runBridgeAgent("周杰倫, 海角七號, 不存在的東西", { qloo: qloo(), llm: null });
  expect(r.seeds.map(s => s.name)).toEqual(["Jay Chou", "Cape No. 7"]);
  expect(r.unmatched).toEqual(["不存在的東西"]);
  expect(r.picks.artist?.length).toBeGreaterThan(0);
  expect(r.places.every(p => p.entity.lat !== undefined)).toBe(true);
  expect(r.picks.movie?.[0].why).toMatch(/Qloo affinity/);
});
