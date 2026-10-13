// Baseline for the side-by-side: the same model and settings, the same input, no Qloo tools.
import { AGENT_MODEL, Meter, requestSettings, textOf, type LLM } from "./llm";
import type { BrandInput, PlainAnswer } from "./types";

// Same output shape and length limits as the agent's recommendations, so the comparison is about evidence, not verbosity.
const BRAND_PROMPT = `You advise Taiwanese brands entering Japan. Give 5 concrete recommendations covering entry city, target audience, cultural references or partnerships, positioning, and store format. Title: short imperative, max 10 words. Detail: 1-2 sentences.`;
const BRIDGE_PROMPT = `A person moving from Taiwan to Osaka lists favourites from home. Suggest 5 Japanese equivalents (music, film or TV, brands, Osaka places). Title: the name. Detail: one sentence on why.`;
const SCHEMA = { type: "object", additionalProperties: false, required: ["items"], properties: { items: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "detail"], properties: { title: { type: "string" }, detail: { type: "string" } } } } } };

// Illustrative mock baselines: typical generic answers an LLM gives without data (labelled "illustrative" in the UI).
const MOCK_BRAND: PlainAnswer["items"] = [
  { title: "Launch in Tokyo (Shibuya / Harajuku)", detail: "Tokyo is the largest market and trend-setter for Japan." },
  { title: "Target young women aged 18–34", detail: "This demographic drives food and lifestyle trends on social media." },
  { title: "Lean on Instagram and TikTok influencers", detail: "Partner with popular Japanese influencers to build awareness." },
  { title: "Emphasise authentic Taiwanese heritage", detail: "Japanese consumers value authenticity and story." },
  { title: "Adapt to Japanese quality expectations", detail: "Focus on packaging, service and seasonal limited editions." },
];
const MOCK_BRIDGE: PlainAnswer["items"] = [
  { title: "Listen to mainstream J-pop", detail: "Popular Japanese artists with broad appeal." },
  { title: "Watch well-known anime films", detail: "Beloved worldwide and easy to enjoy." },
  { title: "Visit Dotonbori", detail: "Osaka's most famous food street." },
  { title: "Try takoyaki and okonomiyaki", detail: "Osaka's signature dishes." },
  { title: "Shop at big Japanese chains", detail: "Well-known Japanese brands." },
];

export async function plainBaseline(kind: "brand" | "bridge", input: BrandInput | string, llm: LLM | null, meter?: Meter): Promise<PlainAnswer> {
  const mock: PlainAnswer = { source: "mock", items: kind === "brand" ? MOCK_BRAND : MOCK_BRIDGE };
  if (!llm) return mock;
  const model = AGENT_MODEL;
  const settings = requestSettings(model, "agent");
  try {
    const r = await llm.messages.create({
      model, max_tokens: 1500, ...settings,
      output_config: { ...(settings.output_config as object), format: { type: "json_schema", schema: SCHEMA } },
      system: kind === "brand" ? BRAND_PROMPT : BRIDGE_PROMPT,
      messages: [{ role: "user", content: typeof input === "string" ? input : JSON.stringify(input) }],
    });
    (meter ?? new Meter()).add(model, r.usage);
    if (r.stop_reason === "refusal") return mock;
    const text = textOf(r);
    const j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    return { source: "claude", items: (j.items ?? []).slice(0, 6).map((x: any) => ({ title: String(x.title), detail: String(x.detail ?? "") })) };
  } catch {
    return mock;
  }
}
