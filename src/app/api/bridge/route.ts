import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeBridge } from "@/lib/analyze";
import { bridgeKey, showcaseHit } from "@/lib/showcase";
import { allow, cachedAnswer, clientKey, stripPersonalData } from "@/lib/ratelimit";

export const maxDuration = 60;

const Body = z.object({ text: z.string().trim().min(1).max(200) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Type one or more favourites." }, { status: 400 });
  // Only titles/names of public works and places go to Qloo, never contact details.
  const text = stripPersonalData(parsed.data.text);
  if (!text) return NextResponse.json({ error: "Type one or more favourites (songs, artists, films, dishes, places)." }, { status: 400 });
  const key = bridgeKey(text);
  const memo = cachedAnswer<object>(key);
  const hit = (await showcaseHit(key)) ?? (memo && { ...memo, served: "cache" });
  if (hit) return NextResponse.json(hit);
  if (!allow(req)) return NextResponse.json({ error: "Demo limit reached. Please wait a minute (or try again tomorrow). The examples still work." }, { status: 429 });
  try {
    return NextResponse.json(await analyzeBridge(text, { visitor: clientKey(req) }));
  } catch (e: any) {
    console.error("bridge failed:", e?.status ?? "", String(e?.message ?? e).slice(0, 120));
    return NextResponse.json({ error: e?.status === 429 ? "Qloo is busy right now. Please try again in a minute." : "The taste analysis failed. Please try again, or pick an example." }, { status: 502 });
  }
}
