import { Bot, Clock, Coins, Database } from "lucide-react";
import type { AnalysisBody } from "@/lib/analyze";

const MODEL_LABEL: Record<string, string> = { "claude-sonnet-5-5": "Claude Sonnet 5.5", "claude-haiku-5-5": "Claude Haiku 5.5", "claude-opus-5-5": "Claude Opus 5.5" };
export const modelLabel = (m: string | undefined) => (m ? MODEL_LABEL[m] ?? m : "");

/** One line under the summary: who answered, where the answer came from, and what it cost. */
export function RunMeta({ body, calls, agentCalls }: { body: AnalysisBody; calls: number; agentCalls: number }) {
  const { report, usage, models, served } = body;
  const servedLabel = served === "showcase" ? "Pre-generated example" : served === "cache" ? "Cached answer" : "Live run";
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
      <span className="flex items-center gap-1"><Bot className="size-3.5" aria-hidden />{report.llm === "claude" ? `${modelLabel(models?.agent)} chose ${agentCalls} of ${calls} Qloo calls` : `Rules-based agent · ${calls} Qloo calls`}</span>
      <span className="flex items-center gap-1"><Database className="size-3.5" aria-hidden />{servedLabel}{body.generatedAt && served !== "live" ? ` · ${body.generatedAt.slice(0, 10)}` : ""}</span>
      {usage && <span className="flex items-center gap-1"><Coins className="size-3.5" aria-hidden />{usage.calls} Claude calls · ~US${usage.usd.toFixed(3)}{usage.cacheRead ? ` · ${Math.round((usage.cacheRead / Math.max(1, usage.cacheRead + usage.input + usage.cacheWrite)) * 100)}% of prompt tokens from cache` : ""}</span>}
      {served === "live" && !usage && <span className="flex items-center gap-1"><Clock className="size-3.5" aria-hidden />No LLM cost</span>}
    </div>
  );
}
