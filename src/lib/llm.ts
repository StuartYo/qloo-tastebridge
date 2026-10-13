// Claude access: client, model choice, request settings, token/cost metering and spend caps.
// Keys stay server-side; nothing here logs a key or a prompt.
import Anthropic from "@anthropic-ai/sdk";
import { devAnthropicKey } from "./devkey";

export type LLM = { messages: { create(args: any): Promise<any> } };

/** Agent loop + "LLM only" baseline (same model for a fair comparison). */
export const AGENT_MODEL = process.env.TASTEBRIDGE_MODEL || "claude-sonnet-5-5";
/** Small grounded writing steps (Taste Bridge "why you'd like it"). */
export const SMALL_MODEL = process.env.TASTEBRIDGE_SMALL_MODEL || "claude-haiku-5-5";
type Effort = "low" | "medium" | "high";
const AGENT_EFFORT = (process.env.TASTEBRIDGE_EFFORT as Effort) || "medium";

// USD per million tokens (Claude API list prices, 2026-10). Cache writes 1.25x input, reads 0.1x input.
const PRICES: Record<string, { in: number; out: number }> = {
  "claude-sonnet-5-5": { in: 2, out: 10 },
  "claude-haiku-5-5": { in: 0.1, out: 0.5 },
  "claude-opus-5-5": { in: 4, out: 20 },
};

export function hasAnthropicKey() { return !!devAnthropicKey(); }

export function getLLM(): LLM | null {
  const apiKey = devAnthropicKey();
  if (!apiKey) return null;
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 45_000 });
  return {
    messages: {
      create(args: any) {
        // Server-side refusal fallback (Claude API, Sonnet 5.5 "default" form). Haiku has no server-side fallback.
        if (args.model === "claude-sonnet-5-5") return (client.beta.messages.create as any)({ ...args, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
        return client.messages.create(args);
      },
    },
  };
}

/** Request settings per model: Sonnet 5.5 runs without extended thinking (`between_tools`) to keep the
 *  agent cheap and fast; the tool plan is spelled out in the system prompt, so deep thinking adds little. */
export function requestSettings(model: string, kind: "agent" | "small") {
  const effort: Effort = kind === "small" ? "low" : AGENT_EFFORT;
  const s: Record<string, unknown> = { output_config: { effort } };
  if (model === "claude-sonnet-5-5") s.thinking = { type: "between_tools" };
  return s;
}

// ---------- metering ----------
export interface Usage { calls: number; input: number; output: number; cacheWrite: number; cacheRead: number; usd: number }
export const emptyUsage = (): Usage => ({ calls: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, usd: 0 });

export function costOf(model: string, u: { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null }) {
  const p = PRICES[model] ?? PRICES["claude-sonnet-5-5"];
  const inp = u.input_tokens ?? 0, out = u.output_tokens ?? 0, cw = u.cache_creation_input_tokens ?? 0, cr = u.cache_read_input_tokens ?? 0;
  return (inp * p.in + cw * p.in * 1.25 + cr * p.in * 0.1 + out * p.out) / 1e6;
}

export class Meter {
  usage = emptyUsage();
  add(model: string, u: any) {
    if (!u) return;
    this.usage.calls++;
    this.usage.input += u.input_tokens ?? 0;
    this.usage.output += u.output_tokens ?? 0;
    this.usage.cacheWrite += u.cache_creation_input_tokens ?? 0;
    this.usage.cacheRead += u.cache_read_input_tokens ?? 0;
    this.usage.usd += costOf(model, u);
    spend.add(costOf(model, u));
  }
  /** Prompt tokens seen so far in this request (all kinds) — used to cap a runaway loop. */
  get promptTokens() { return this.usage.input + this.usage.cacheRead + this.usage.cacheWrite; }
}

export const addUsage = (a: Usage, b: Usage): Usage => ({ calls: a.calls + b.calls, input: a.input + b.input, output: a.output + b.output, cacheWrite: a.cacheWrite + b.cacheWrite, cacheRead: a.cacheRead + b.cacheRead, usd: a.usd + b.usd });

// ---------- spend caps (per server instance; the Anthropic workspace's monthly cap is the hard stop) ----------
const num = (v: string | undefined, d: number) => (v !== undefined && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : d);
export const CAPS = {
  /** LLM analyses per visitor per day (each = agent loop + baseline [+ explanations]). */
  visitorDaily: num(process.env.LLM_VISITOR_DAILY_RUNS, 2),
  /** LLM analyses per day across all visitors. */
  globalDaily: num(process.env.LLM_DAILY_RUNS, 8),
  /** Estimated USD per day across all visitors. */
  dailyUsd: num(process.env.LLM_DAILY_USD, 0.25),
};

const today = () => new Date().toISOString().slice(0, 10);
const spend = {
  day: "", usd: 0, runs: 0,
  roll() { const d = today(); if (this.day !== d) { this.day = d; this.usd = 0; this.runs = 0; visitors.clear(); } },
  add(usd: number) { this.roll(); this.usd += usd; },
};
const visitors = new Map<string, number>();

export type BudgetDecision = { ok: true } | { ok: false; reason: "visitor" | "global" | "usd" };

/** Reserve one LLM analysis for this visitor, or say why not. */
export function reserveLlmRun(visitor: string, caps = CAPS): BudgetDecision {
  spend.roll();
  if (spend.usd >= caps.dailyUsd) return { ok: false, reason: "usd" };
  if (spend.runs >= caps.globalDaily) return { ok: false, reason: "global" };
  const n = visitors.get(visitor) ?? 0;
  if (n >= caps.visitorDaily) return { ok: false, reason: "visitor" };
  visitors.set(visitor, n + 1);
  spend.runs++;
  if (visitors.size > 5000) visitors.clear();
  return { ok: true };
}

export function spendToday() { spend.roll(); return { usd: spend.usd, runs: spend.runs }; }
/** Test helper. */
export function resetSpend() { spend.day = ""; spend.roll(); }

/** Text of a response, read by block type (responses can start with thinking blocks). */
export const textOf = (res: any) => (res?.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
