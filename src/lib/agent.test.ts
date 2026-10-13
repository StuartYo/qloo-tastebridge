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
      req => { const ids = lastToolResult(req).results.map((x: any) => x.id); seedId = ids[0]; return [toolUse("t2", "japan_taste_neighbors", { entity_ids: ids, kinds: ["artist"] })]; },
      () => [toolUse("t3", "submit_report", { summary: "S", recommendations: [{ title: "Partner with J-pop acts", detail: "d", evidence_ids: ["E2", "E99"] }] })],
    ]);
    const r = await runBrandAgent(DEMO_BRANDS[0], { qloo: qloo(), llm });
    expect(llm.calls).toHaveLength(3);
    expect(llm.calls[0].model).toBe("claude-sonnet-5-5");
    expect(r.llm).toBe("claude");
    // The model's summary is kept; code prepends a hedge only when its own coverage verdict is "insufficient".
    expect(r.summary.endsWith("S")).toBe(true);
    expect(r.summary.startsWith("Qloo has too little data")).toBe(r.sufficiency === "insufficient");
    expect(r.droppedCitations).toBe(1);
    // Prompt caching: stable system block is a cache breakpoint, plus automatic caching of the history.
    expect(llm.calls[0].system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(llm.calls[0].cache_control).toEqual({ type: "ephemeral" });
    expect(llm.calls[0].thinking).toEqual({ type: "between_tools" });
    // Evidence is stamped with who asked for it.
    expect(r.evidence[0].origin).toBe("agent");
    expect(r.evidence.some(e => e.origin === "coverage")).toBe(true);
    // Coverage verdict from code is appended once per turn.
    expect(JSON.stringify(llm.calls[1].messages.at(-1).content)).toContain("data_coverage");
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

describe("guards", () => {
  test("category keywords must name the product (no silent broadening)", async () => {
    const { keywordGrounded } = await import("./agent");
    const millet = { name: "Millet Spirit", category: "Indigenous millet wine micro-brewery", keywords: ["millet wine"] };
    expect(keywordGrounded("millet wine", millet)).toBe(true);
    expect(keywordGrounded("bar", millet)).toBe(false);
    expect(keywordGrounded("brewery", millet)).toBe(false);
    expect(keywordGrounded("brewery", { name: "X", category: "Indigenous millet wine micro-brewery" })).toBe(true);
    expect(keywordGrounded("bakery", { name: "Sunny", category: "Pineapple cake bakery" })).toBe(true);
  });

  test("an off-product keyword is refused before any Qloo call", async () => {
    const llm = scriptedLLM([
      () => [toolUse("t1", "home_market_proxies", { keyword: "bar" })],
      () => [toolUse("t2", "submit_report", { summary: "Not enough Qloo data.", recommendations: [{ title: "Not enough data", detail: "d", evidence_ids: [] }] })],
    ]);
    const millet = BRAND_SCENARIOS.find(s => s.id === "millet")!;
    const r = await runBrandAgent(millet, { qloo: qloo(), llm });
    expect(lastToolResult(llm.calls[1]).error).toMatch(/not one of the brand's own product words/);
    expect(r.evidence.filter(e => e.origin === "agent")).toHaveLength(0);
  });

  test("Taste Bridge explanations: grounded lines kept, ungrounded ones replaced by rules", async () => {
    const { groundedWhy } = await import("./agent");
    const seed = { id: "s", name: "Jay Chou", kind: "artist", tags: [{ id: "t", name: "Mandopop" }] };
    const pick = { id: "p", name: "Some Artist", kind: "artist", affinity: 0.9, tags: [{ id: "t2", name: "Ballad" }] };
    expect(groundedWhy("People who like Jay Chou also tend to like this.", pick, [seed])).toBe(true);
    expect(groundedWhy("Both are tagged ballad.", pick, [seed])).toBe(true);
    expect(groundedWhy("A legendary singer who won ten awards.", pick, [seed])).toBe(false);
    expect(groundedWhy("You will love this, like Jay Chou.", pick, [seed])).toBe(false);
  });

  test("bridge agent uses Claude for explanations and validates reported matches", async () => {
    let n = 0;
    const llm: LLM & { calls: any[] } = { calls: [], messages: { async create(req: any) {
      llm.calls.push(req);
      if (req.model === "claude-haiku-5-5") {
        const picks = JSON.parse(req.messages[0].content.replace(/^<qloo_results>|<\/qloo_results>$/g, "")).picks;
        return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ explanations: picks.map((p: any, i: number) => ({ entity_id: p.entity_id, why: i === 0 ? "Invented award-winning legend." : "People who like Jay Chou also tend to like this." })) }) }] };
      }
      n++;
      if (n === 1) return { content: [toolUse("a", "search_entities", { query: "周杰倫" })] };
      const found = JSON.parse(llm.calls.filter(c => c.model !== "claude-haiku-5-5")[1].messages[2].content[0].content).results[0].id;
      return { content: [toolUse("b", "submit_picks", { summary: "People who like Jay Chou also tend to like these.", matched: [{ favourite: "周杰倫", entity_id: found }, { favourite: "x", entity_id: "BOGUS" }], unmatched: [] })] };
    } } };
    const r = await runBridgeAgent("周杰倫", { qloo: qloo(), llm });
    expect(r.llm).toBe("claude");
    expect(r.explanations).toBe("claude");
    expect(r.seeds.map(s => s.name)).toEqual(["Jay Chou"]);
    const whys = [...Object.values(r.picks).flat(), ...r.places].map(p => p!.why);
    expect(whys.some(w => w.startsWith("People who like Jay Chou"))).toBe(true);
    expect(whys.some(w => w.includes("Invented"))).toBe(false);
  });
});

describe("confidence rules (code, not the model)", () => {
  const venue = (id: string, popularity: number) => ({ id, name: id, kind: "place", affinity: 0.8, popularity, tags: [] });
  function ctxWith(scores: number[]) {
    const ctx = new Ctx(qloo());
    ctx.seeds = [venue("s1", 0.9), venue("s2", 0.9), venue("s3", 0.9)];
    ctx.neighbors = { artist: Array.from({ length: 8 }, (_, i) => venue(`a${i}`, 0.9)) };
    scores.forEach((score, i) => {
      const id = ctx.record("city_fit", "/v2/insights", {}, Array.from({ length: 10 }, (_, j) => venue(`c${i}${j}`, 0.9)), `city ${i}`);
      ctx.cities.push({ name: `C${i}`, lat: 0, lon: 0, score, count: 10, evidence: id });
    });
    ctx.record("audience_profile", "/v2/insights", {}, [], "aud", 12);
    return ctx;
  }
  test("a close-call city is at most medium; a clear lead can be high", () => {
    const close = ctxWith([0.9, 0.88]);
    expect(finalizeRecs(close, [{ title: "Enter C0 first", detail: "C0 0.9 vs C1 0.88.", evidence: ["E1", "E2", "E3"] }])[0]).toMatchObject({ confidence: "medium" });
    const clear = ctxWith([0.9, 0.7]);
    expect(finalizeRecs(clear, [{ title: "Enter C0 first", detail: "C0 0.9 vs C1 0.7.", evidence: ["E1", "E2", "E3"] }])[0].confidence).toBe("high");
  });
  test("low-popularity venues drop one level; hedged wording caps the level", async () => {
    const { textCeiling, softenClaims } = await import("./agent");
    const ctx = ctxWith([0.9, 0.7]);
    const v = ctx.record("city_places", "/v2/insights", {}, Array.from({ length: 10 }, (_, j) => venue(`v${j}`, 0.2)), "venues");
    const [r] = finalizeRecs(ctx, [{ title: "Pop up near V0", detail: "Top venues.", evidence: [v, "E3"] }]);
    expect(r.confidence).toBe("medium");
    expect(r.confidenceNote).toMatch(/low Qloo popularity/);
    const [h] = finalizeRecs(ctx, [{ title: "Enter C0", detail: "The evidence is moderate.", evidence: ["E1", "E2", "E3"] }]);
    expect(h.confidence).toBe("medium");
    expect(textCeiling("This is my own suggestion and has no Qloo support.")).toBe("low");
    expect(softenClaims("Strong evidence confirms a clear winner.")).toBe("evidence suggests a leader.");
  });
});

test("Taste Bridge hides brand links that share no tags with the favourites", async () => {
  const r = await runBridgeAgent("周杰倫", { qloo: qloo(), llm: null });
  const brands = r.picks.brand ?? [];
  const seedTags = new Set(r.seeds.flatMap(s => s.tags.map(t => t.name)));
  expect(brands.every(p => p.entity.tags.some(t => seedTags.has(t.name)))).toBe(true);
  expect(Array.isArray(r.hiddenBrands)).toBe(true);
});
