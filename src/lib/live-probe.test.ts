// `npm run probe:live`: runs every demo input through the agents against live Qloo and prints a
// data-quality summary. Responses land in the git-ignored .cache/qloo/ (never committed).
import { expect, test } from "vitest";
import { runBrandAgent, runBridgeAgent } from "./agent";
import { BRAND_SCENARIOS, BRIDGE_EXAMPLES } from "./demos";
import { createQlooClient } from "./qloo";

const live = process.env.npm_lifecycle_event === "probe:live";
const names = (xs: { name: string }[] | undefined, n = 4) => (xs ?? []).slice(0, n).map(x => x.name).join(" / ");

test.runIf(live)("live data-quality probe", async () => {
  const qloo = createQlooClient();
  expect(qloo.mode).toBe("live");
  const only = process.env.PROBE_ONLY?.split(",");
  for (const s of BRAND_SCENARIOS.filter(s => !only || only.includes(s.id))) {
    const t = Date.now();
    const r = await runBrandAgent(s, { qloo, llm: null });
    console.log(`\n=== ${s.name} (${s.category}) — ${r.sufficiency}, ${r.evidence.length} calls, ${((Date.now() - t) / 1000).toFixed(1)}s`);
    console.log("seeds:", r.seeds.map(s => `${s.name} [${s.kind} pop ${s.popularity?.toFixed(2)}]`).join(" / "));
    console.log("audience:", JSON.stringify(r.audience));
    for (const k of ["artist", "movie", "tv_show", "brand"] as const) console.log(`${k}:`, r.neighbors[k]?.length ?? 0, "|", names(r.neighbors[k]));
    console.log("cities:", r.cities.map(c => `${c.name} ${c.score}(${c.count})`).join(", "));
    console.log("places:", r.places.length, "|", names(r.places), "| heat cells", r.heatmap.length);
    console.log("shared themes:", r.sharedThemes.slice(0, 6).join(", "));
    for (const x of r.recommendations) console.log(` - [${x.confidence}] ${x.title}`);
  }
  for (const text of BRIDGE_EXAMPLES.concat(["Jay Chou, Cape No. 7, beef noodle soup"]).filter(() => !only || only.includes("bridge"))) {
    const r = await runBridgeAgent(text, { qloo, llm: null });
    console.log(`\n=== Bridge "${text}" — ${r.sufficiency}, ${r.evidence.length} calls; seeds: ${names(r.seeds)}; unmatched: ${r.unmatched.join(", ")}`);
    for (const k of ["artist", "movie", "tv_show", "brand"] as const) console.log(`${k}:`, names((r.picks[k] ?? []).map(p => p.entity), 3));
    console.log("osaka places:", r.places.length, "|", names(r.places.map(p => p.entity), 3));
  }
}, 900_000);
