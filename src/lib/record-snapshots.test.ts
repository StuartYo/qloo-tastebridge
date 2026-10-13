// `npm run snapshots:record`: replays every demo/eval input against live Qloo so the responses are
// cached in .cache/qloo/ (git-ignored). The app falls back to them if Qloo is down, or serves only them
// with QLOO_MODE=snapshot.
import { expect, test } from "vitest";
import { runBrandAgent, runBridgeAgent } from "./agent";
import { BRAND_SCENARIOS, BRIDGE_EXAMPLES } from "./demos";
import { createQlooClient } from "./qloo";

const record = process.env.npm_lifecycle_event === "snapshots:record";
if (record) { try { process.loadEnvFile(".env.local"); } catch { /* use shell env */ } }

test.runIf(record)("record Qloo snapshots for demo inputs", async () => {
  const qloo = createQlooClient();
  if (qloo.mode !== "live") throw new Error("QLOO_API_KEY missing");
  for (const s of BRAND_SCENARIOS) { const r = await runBrandAgent(s, { qloo, llm: null }); console.log(s.name, r.sufficiency, r.evidence.length); }
  for (const t of BRIDGE_EXAMPLES) { const r = await runBridgeAgent(t, { qloo, llm: null }); console.log(t, r.seeds.map(x => x.name)); }
  expect(qloo.mode).toBe("live");
}, 600_000);
