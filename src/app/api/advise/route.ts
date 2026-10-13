import { NextResponse } from "next/server";
import { z } from "zod";
import { getLLM, runBrandAgent } from "@/lib/agent";
import { plainBaseline } from "@/lib/plainllm";
import { createQlooClient } from "@/lib/qloo";
import { allow, cachedAnswer, storeAnswer, stripPersonalData } from "@/lib/ratelimit";

export const maxDuration = 60;

const Body = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  keywords: z.array(z.string().trim().min(1).max(60)).max(3).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please give a brand name and category." }, { status: 400 });
  const input = { ...parsed.data, name: stripPersonalData(parsed.data.name), category: stripPersonalData(parsed.data.category), description: parsed.data.description && stripPersonalData(parsed.data.description) };
  if (!input.name || !input.category) return NextResponse.json({ error: "Please give a brand name and category." }, { status: 400 });
  const key = "advise:" + JSON.stringify(input).toLowerCase();
  const hit = cachedAnswer(key);
  if (hit) return NextResponse.json(hit);
  if (!allow(req)) return NextResponse.json({ error: "Demo limit reached. Please wait a minute (or try again tomorrow)." }, { status: 429 });
  const llm = getLLM();
  try {
    const [report, baseline] = await Promise.all([
      runBrandAgent(input, { qloo: createQlooClient(), llm }),
      plainBaseline("brand", input, llm),
    ]);
    const body = { report, baseline };
    storeAnswer(key, body);
    return NextResponse.json(body);
  } catch (e: any) {
    console.error("advise failed:", e?.status ?? "", String(e?.message ?? e).slice(0, 120));
    return NextResponse.json({ error: e?.status === 429 ? "Qloo is busy right now. Please try again in a minute." : "The taste analysis failed. Please try again." }, { status: 502 });
  }
}
