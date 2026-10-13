# TasteBridge — a taste-graph localization advisor for Taiwanese brands entering Japan

An AI agent that answers a question every small Taiwanese brand asks before a Japan launch: **"Will our customers' taste travel — and where, to whom, with what cultural references?"** It queries [Qloo](https://www.qloo.com/)'s taste graph through a multi-step tool loop, ties every recommendation to the Qloo calls behind it, and says *"not enough data"* when the graph is thin instead of guessing.

A second tab, **Taste Bridge**, applies the same engine to one person: a student or worker moving from Taiwan to Osaka types what they love at home and gets Japanese music, film, TV, brands and Osaka places that share that taste.

> **Data notice.** With `QLOO_API_KEY` set (server-side only) the app uses the live Qloo hackathon API. Without it, the app runs on hand-written mock data (`src/lib/qloo-mock.ts`) and every screen shows a yellow "DEMO DATA" banner. The mock imitates the response shapes; it is not Qloo data. Qloo results describe what groups with a given taste tend to like, never a prediction about one person.

## The problem

Taiwanese F&B and lifestyle brands (bubble tea, tea, bakeries, design goods) increasingly expand to Japan, usually on intuition: "open in Tokyo, target young women, post on Instagram". Market research firms are out of budget for a 20-store brand, and the cost of picking the wrong city or audience is a failed first store.

## What a plain LLM cannot do — and Qloo can

**Without Qloo, an LLM can only repeat common stereotypes. It cannot measure which Japanese audiences actually share your customers' tastes, how strongly, or in which cities — and it cannot tell you when the evidence is too thin to say.**

The app shows this side by side: for the same input, an "LLM only" column (same model, no tools) next to the agent's Qloo-backed answer, where every line carries evidence IDs and a confidence level.

| | LLM only | LLM + Qloo (TasteBridge) |
|---|---|---|
| City choice | "Tokyo is the biggest market" | City fit from place affinity per city, compared across 6 cities |
| Audience | "young women 18–34" | Age/gender affinity of comparable brands' audiences |
| Cultural hooks | generic "Taiwan heritage" | Japanese artists, films, TV, brands that the same-taste audience likes |
| Where exactly | famous districts | Taste heatmap + highest-affinity venues around the city centre |
| Thin data | always answers | Marks claims "insufficient data" and refuses to recommend |

## Features

- **Brand Advisor** (home): brand name + category → summary, 4–6 recommendations (entry city, target audience, cultural references, positioning vs Japanese benchmarks, pop-up location), each with confidence and clickable evidence.
- City-fit chart, audience affinity chart, Japanese taste neighbours (music / film / TV / brands), Leaflet + OpenStreetMap map with a Qloo taste heatmap.
- **"What Qloo provided" panel**: every Qloo call with endpoint, parameters, result count and top results.
- **Taste Bridge** tab: Chinese or English favourites (e.g. 周杰倫, 海角七號, 牛肉麵) → Japanese equivalents with "why you'd like it", similarity bars and an Osaka map.
- **Evaluation** tab: 8 fictional brand scenarios, including 2 where Qloo should have too little data; checks citations, honesty and city choice.
- Works on phones; no AI-generated images (icons are lucide-react).

## How Qloo is used

| Endpoint | Purpose |
|---|---|
| `GET /search` | Resolve the brand and personal favourites (周杰倫, 海角七號…) to entity IDs; filler results that don't match the name are dropped |
| `GET /v2/tags` | Turn a category keyword ("bubble tea") into a Qloo place tag |
| `GET /v2/insights` `filter.type=urn:entity:place` + `filter.tags=<category>` + `filter.location=POINT(Taipei)` | Home-market taste proxies: same-category venues in Taipei, for brands Qloo doesn't know |
| `GET /v2/insights` `filter.type=urn:demographics` | Audience age/gender affinity |
| `GET /v2/insights` artist / movie / tv_show / brand + `signal.location.query=Japan` + a per-type Japan filter (Japanese music genre tags, Japanese media tags, `filter.release_country=Japan`, "key market: Japan" tag) | Japanese cultural taste neighbours |
| `GET /v2/insights` `filter.type=urn:entity:place` + `filter.location=POINT(lon lat)` + 15 km radius, per city | City fit across Tokyo, Osaka, Kyoto, Fukuoka, Nagoya, Sapporo |
| same, 6 km radius, same-category venues first | Concrete pop-up locations in the best city |
| `GET /v2/insights` `filter.type=urn:heatmap` | Taste heatmap over the city |
| `GET /v2/analysis/compare` | Taste themes shared by the home-market venues and the top venues in Japan |

A typical brand analysis makes ~21 Qloo calls (~7–15 s live, instant when cached). Every parameter choice above was checked against the live API; details, what did *not* work, and data-quality notes: [`docs/qloo-api-notes.md`](docs/qloo-api-notes.md).

## Architecture

```
Browser (Next.js App Router, Tailwind, Leaflet)
   │  POST /api/advise  |  POST /api/bridge      (zod validation, per-IP daily cap)
   ▼
Agent (src/lib/agent.ts)
   ├─ Claude tool loop (max 8 steps): search_entities, search_tags, audience_profile,
   │  japan_taste_neighbors, score_japan_cities, city_places, compare_tastes → submit_report
   ├─ Coverage check: fills any analysis step Claude skipped
   ├─ Confidence = f(result counts, affinity, # independent endpoints) — computed in code,
   │  never by the model; citations to unknown evidence IDs are dropped
   └─ Rules-based fallback when no ANTHROPIC_API_KEY or Claude fails
   ▼
Qloo client (src/lib/qloo.ts)
   live  → https://hackathon.api.qloo.com (X-Api-Key, server-side only), throttled to ~4 req/s,
           in-memory + private disk cache (.cache/qloo/, git-ignored), stale cache if Qloo fails
   snapshot → serves only cached responses (QLOO_MODE=snapshot)
   mock  → src/lib/qloo-mock.ts (labelled demo data)
API routes: per-visitor daily + per-minute caps, cached answers for repeated inputs,
            e-mails / phone numbers / URLs stripped before anything reaches Qloo
```

The "LLM only" column (`src/lib/plainllm.ts`) calls the same model with no tools. Without an Anthropic key it shows an illustrative mock answer, labelled as such.

## Run it

```bash
npm install
cp .env.example .env.local   # optional: add QLOO_API_KEY and ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

With a Qloo key:
- `npm run eval:live` — run the 8-scenario evaluation against live Qloo (8/8 on 2026-10-13).
- `npm run probe:live` — print a data-quality summary for every demo input.
- `npm run snapshots:record` — warm the private cache (`.cache/qloo/`, git-ignored) for all demo inputs. The app falls back to it if Qloo is unavailable; `QLOO_MODE=snapshot` serves only the cache.

Without `ANTHROPIC_API_KEY` the agent runs its rules-based path on live Qloo data, and the UI says "AI explanation needs an LLM key".

## Limitations

- Brand inputs in the demo are fictional; real Taiwanese brands may not exist in Qloo, so the agent uses comparable brands and venues as proxies and says so.
- Qloo coverage of Japanese venues and of Taiwanese entities is not guaranteed in the hackathon environment; that is why sufficiency and confidence are first-class outputs.
- City fit scores are close together across the six cities (differences of 0.01–0.05); the app calls small gaps a "close call".
- Japanese culture neighbours are popularity-biased: the same well-known names recur across different inputs.
- "Brands" means brands Qloo lists with Japan as a key market, not Japanese-owned brands.
- Food words typed in Chinese (牛肉麵, 夜市) only match venue names in Qloo, so those matches are weak.
- Qloo data is never committed to this repository (Qloo hackathon rule). Cached responses live in the git-ignored `.cache/qloo/`.
- Audience and affinity numbers describe taste correlation, not sales forecasts.

## License

MIT — see [LICENSE](LICENSE).
