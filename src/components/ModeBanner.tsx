import { FlaskConical, Info } from "lucide-react";
import type { QlooMode } from "@/lib/types";

export function ModeBanner({ mode, anthropic }: { mode: QlooMode; anthropic: boolean }) {
  if (mode === "live" && anthropic) return null;
  // Yellow = not real Qloo data. Live Qloo data without an LLM key only gets a neutral notice.
  if (mode === "mock" || mode === "snapshot") {
    const qloo = mode === "mock" ? "DEMO DATA: Qloo results are a hand-written mock, not real Qloo data" : "Qloo results are replayed from the local cache";
    return (
      <div className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-900 sm:text-sm">
        <FlaskConical className="size-4 shrink-0" aria-hidden />
        <span>{qloo}{anthropic ? "" : " · AI explanation needs an LLM key"}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center gap-2 border-b border-stone-200 bg-stone-100 px-4 py-2 text-center text-xs text-stone-700 sm:text-sm">
      <Info className="size-4 shrink-0" aria-hidden />
      <span>Live Qloo data. AI explanation needs an LLM key. Until then, text is assembled by rules from the Qloo results.</span>
    </div>
  );
}

export function MockTag({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">Demo data</span>;
}
