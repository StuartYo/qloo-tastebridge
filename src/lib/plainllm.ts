// Baseline for the side-by-side: the same model, same input, no Qloo tools.
import type { LLM } from "./agent";
import { MODEL } from "./agent";
import type { BrandInput, PlainAnswer } from "./types";

const BRAND_PROMPT = `You advise Taiwanese brands entering Japan. Give 5 concrete recommendations (city, audience, partnerships, positioning, store format).
Reply with JSON only: {"items":[{"title":"...","detail":"..."}]}`;
const BRIDGE_PROMPT = `A Taiwanese person lists favourites. Suggest Japanese equivalents (music, film/TV, brands, Osaka places), 5 items.
Reply with JSON only: {"items":[{"title":"...","detail":"..."}]}`;

// Illustrative mock baselines: typical generic answers an LLM gives without data (labelled "mock" in the UI).
const MOCK_BRAND: PlainAnswer["items"] = [
  { title: "Launch in Tokyo (Shibuya / Harajuku)", detail: "Tokyo is the largest market and trend-setter for Japan." },
  { title: "Target young women aged 18–34", detail: "This demographic drives food and lifestyle trends on social media." },
  { title: "Lean on Instagram and TikTok influencers", detail: "Partner with popular Japanese influencers to build awareness." },
  { title: "Emphasise authentic Taiwanese heritage", detail: "Japanese consumers value authenticity and story." },
  { title: "Adapt to Japanese quality expectations", detail: "Focus on packaging, service and seasonal limited editions." },
];
const MOCK_BRIDGE: PlainAnswer["items"] = [
  { title: "Listen to J-Pop like Arashi or Utada Hikaru", detail: "Popular Japanese artists with broad appeal." },
  { title: "Watch Studio Ghibli films", detail: "Beloved worldwide and easy to enjoy." },
  { title: "Visit Dotonbori", detail: "Osaka's most famous food street." },
  { title: "Try takoyaki and okonomiyaki", detail: "Osaka's signature dishes." },
  { title: "Shop at Uniqlo and MUJI", detail: "Well-known Japanese brands." },
];

export async function plainBaseline(kind: "brand" | "bridge", input: BrandInput | string, llm: LLM | null): Promise<PlainAnswer> {
  if (!llm) return { source: "mock", items: kind === "brand" ? MOCK_BRAND : MOCK_BRIDGE };
  try {
    const r = await llm.messages.create({ model: MODEL, max_tokens: 1500, system: kind === "brand" ? BRAND_PROMPT : BRIDGE_PROMPT, messages: [{ role: "user", content: JSON.stringify(input) }] });
    const text = (r.content ?? []).map((c: any) => (c.type === "text" ? c.text : "")).join("");
    const j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    return { source: "claude", items: (j.items ?? []).slice(0, 6).map((x: any) => ({ title: String(x.title), detail: String(x.detail ?? "") })) };
  } catch {
    return { source: "mock", items: kind === "brand" ? MOCK_BRAND : MOCK_BRIDGE };
  }
}
