import { expect, test } from "vitest";
import { runEval } from "./eval";
import { createQlooClient } from "./qloo";

test("evaluation set passes on mock data (8 scenarios incl. 2 thin-data cases)", async () => {
  const rows = await runEval(createQlooClient({ env: {} }));
  expect(rows).toHaveLength(8);
  expect(rows.filter(r => !r.expectedSufficient)).toHaveLength(2);
  expect(rows.filter(r => !r.pass)).toEqual([]);
});

// After the key arrives: `npm run eval:live` (reads QLOO_API_KEY from .env.local).
const live = process.env.npm_lifecycle_event === "eval:live";
if (live) { try { process.loadEnvFile(".env.local"); } catch { /* use shell env */ } }
test.runIf(live)("evaluation set on live Qloo", async () => {
  const qloo = createQlooClient();
  if (qloo.mode !== "live") throw new Error("QLOO_API_KEY missing");
  const rows = await runEval(qloo);
  console.table(rows);
  expect(rows).toHaveLength(8);
}, 180_000);
