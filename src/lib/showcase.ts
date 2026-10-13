// Pre-generated results for the preset examples, so judges see full results instantly and the demo never
// looks broken when the daily LLM caps are reached. The bundle holds Qloo-derived content, so it is never
// committed: it lives in the git-ignored .data/showcase.json, and `vercel deploy` uploads it from the local
// folder into the private deployment (next.config.ts traces it into the server function). It is read on the
// server only and never served to the browser as a file.
import { existsSync, readFileSync } from "fs";
import path from "path";
import type { BrandInput } from "./types";
import type { EvalRow } from "./eval";
import type { AnalysisBody } from "./analyze";

export interface ShowcaseEntry { kind: "brand" | "bridge"; label: string; body: AnalysisBody }
export interface ShowcaseBundle {
  version: 1;
  generatedAt: string;
  model: string;
  smallModel: string;
  entries: Record<string, ShowcaseEntry>;
  eval?: EvalRow[];
}

const norm = (s: string | undefined) => (s ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
/** Same brand input → same key, regardless of case, spacing or keyword order. */
export const brandKey = (i: BrandInput) => "brand:" + JSON.stringify([norm(i.name), norm(i.category), norm(i.description), (i.keywords ?? []).map(norm).filter(Boolean).sort()]);
export const bridgeKey = (text: string) => "bridge:" + JSON.stringify(text.split(/[,，、;；\n/]+/).map(norm).filter(Boolean).slice(0, 5).sort());

export const SHOWCASE_FILE = () => process.env.SHOWCASE_FILE || path.join(process.cwd(), ".data", "showcase.json");

let loaded: { at: number; value: ShowcaseBundle | null } | undefined;
let inflight: Promise<ShowcaseBundle | null> | undefined;

async function fetchBundle(): Promise<ShowcaseBundle | null> {
  const file = SHOWCASE_FILE();
  try { if (existsSync(/*turbopackIgnore: true*/ file)) return JSON.parse(readFileSync(/*turbopackIgnore: true*/ file, "utf8")); } catch { /* no bundle */ }
  return null;
}

export async function loadShowcase(): Promise<ShowcaseBundle | null> {
  // A found bundle is kept for the process lifetime; a miss is retried after 5 minutes.
  if (loaded && (loaded.value || Date.now() - loaded.at < 5 * 60_000)) return loaded.value;
  inflight ??= fetchBundle().then(value => { loaded = { at: Date.now(), value }; inflight = undefined; return value; });
  return inflight;
}

export async function showcaseHit(key: string): Promise<AnalysisBody | undefined> {
  const b = await loadShowcase();
  const e = b?.entries[key];
  return e ? { ...e.body, served: "showcase" } : undefined;
}

/** Test helper. */
export function resetShowcase() { loaded = undefined; inflight = undefined; }
