import { mkdtempSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, test } from "vitest";
import { analyzeBrand } from "./analyze";
import { costOf, reserveLlmRun, resetSpend } from "./llm";
import { createQlooClient } from "./qloo";
import { brandKey, bridgeKey, resetShowcase } from "./showcase";

const qloo = () => createQlooClient({ env: {} });

describe("cost protection", () => {
  afterEach(() => { resetSpend(); resetShowcase(); delete process.env.SHOWCASE_FILE; });

  test("cache keys ignore case, spacing and order", () => {
    expect(brandKey({ name: " Formosa  Pearl", category: "Bubble Tea chain", keywords: ["milk tea", "bubble tea"] }))
      .toBe(brandKey({ name: "formosa pearl", category: "bubble tea CHAIN", keywords: ["Bubble Tea", "milk tea"] }));
    expect(bridgeKey("周杰倫、海角七號")).toBe(bridgeKey("海角七號, 周杰倫 "));
  });

  test("per-visitor, global and USD caps", () => {
    const caps = { visitorDaily: 2, globalDaily: 3, dailyUsd: 1 };
    expect(reserveLlmRun("a", caps).ok).toBe(true);
    expect(reserveLlmRun("a", caps).ok).toBe(true);
    expect(reserveLlmRun("a", caps)).toEqual({ ok: false, reason: "visitor" });
    expect(reserveLlmRun("b", caps).ok).toBe(true);
    expect(reserveLlmRun("c", caps)).toEqual({ ok: false, reason: "global" });
  });

  test("cost estimate uses cache pricing", () => {
    // 1M cache reads on Sonnet 5.5 = $0.20; 1M output = $10.
    expect(costOf("claude-sonnet-5-5", { cache_read_input_tokens: 1_000_000 })).toBeCloseTo(0.2);
    expect(costOf("claude-sonnet-5-5", { output_tokens: 1_000_000 })).toBeCloseTo(10);
    expect(costOf("claude-haiku-5-5", { input_tokens: 1_000_000 })).toBeCloseTo(0.1);
  });

  test("preset inputs are served from the showcase bundle without any LLM or Qloo call", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "showcase-"));
    const file = path.join(dir, "showcase.json");
    const input = { name: "Formosa Pearl", category: "Bubble tea chain" };
    writeFileSync(file, JSON.stringify({ version: 1, generatedAt: "x", model: "m", smallModel: "s", entries: { [brandKey(input)]: { kind: "brand", label: "p", body: { report: { kind: "brand", marker: 1 }, baseline: { source: "claude", items: [] }, usage: null, models: null, served: "live", generatedAt: "x" } } } }));
    process.env.SHOWCASE_FILE = file;
    resetShowcase();
    const llm = { messages: { create: async () => { throw new Error("must not be called"); } } };
    const body = await analyzeBrand({ name: "formosa pearl ", category: "Bubble Tea Chain" }, { visitor: "v", qloo: qloo(), llm });
    expect(body.served).toBe("showcase");
    expect((body.report as any).marker).toBe(1);
  });

  test("with no LLM the agent still answers from Qloo (rules), labelled", async () => {
    const body = await analyzeBrand({ name: "Island Goods Co.", category: "Indie lifestyle select shop" }, { visitor: "v", qloo: qloo(), llm: null, skipCache: true });
    expect(body.report.llm).toBe("rules");
    expect(body.baseline.source).toBe("mock");
    expect(body.usage).toBeNull();
  });
});

test("responses trim entities to what the UI shows", async () => {
  const { compactDeep } = await import("./compact");
  const e = { id: "x", name: "X", kind: "place", tags: Array.from({ length: 30 }, (_, i) => ({ id: `t${i}`, name: `T${i}` })), description: "d".repeat(1000) };
  const out = compactDeep({ report: { places: [e], evidence: [{ id: "E1", items: [e] }] } });
  expect(out.report.places[0].tags).toHaveLength(8);
  expect(out.report.evidence[0].items[0].description!.length).toBeLessThanOrEqual(240);
  expect(e.tags).toHaveLength(30);
});
