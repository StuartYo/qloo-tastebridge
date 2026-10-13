# TasteBridge: a taste-graph localization advisor for Taiwanese brands entering Japan

An AI agent that answers a question every small Taiwanese brand asks before a Japan launch: **"Will our customers' taste travel, and where, to whom, with what cultural references?"** Claude decides which of Qloo's taste-graph tools to call, every recommendation is tied to the Qloo calls behind it, and when the graph is thin the app says *"not enough data"* instead of guessing.

A second tab, **Taste Bridge**, applies the same engine to one person: a student or worker moving from Taiwan to Osaka types what they love at home and gets Japanese music, film, TV, brands and Osaka places that share that taste.

> **Data notice.** With `QLOO_API_KEY` set (server-side only) the app uses the live Qloo hackathon API. Without it, it runs on hand-written mock data (`src/lib/qloo-mock.ts`) and every screen shows a yellow "DEMO DATA" banner. Qloo results describe what groups with a given taste tend to like, never a prediction about one person. No Qloo response data is stored in this repository.

## The problem

Taiwanese F&B and lifestyle brands (bubble tea, tea, bakeries, design goods) increasingly expand to Japan, usually on intuition: "open in Tokyo, target young women, post on Instagram". Market research is out of budget for a 20-store brand, and the cost of picking the wrong city or audience is a failed first store.

## What a plain LLM cannot do, and Qloo can

**Without Qloo, an LLM can only repeat common stereotypes. It cannot measure which Japanese audiences actually share your customers' tastes, how strongly, or in which cities. It also cannot tell you when the evidence is too thin to say.**

The app shows this side by side: for the same input, an **"LLM only"** column (same model, same settings, same input, no tools, same length limits) next to the agent's Qloo-backed answer, where every line carries evidence IDs and a confidence level computed by code.

| | LLM only | LLM + Qloo (TasteBridge) |
|---|---|---|
| City choice | "Tokyo is the biggest market" | City fit from the affinity of same-category venues (e.g. bubble tea shops) per city, compared across 6 cities; gaps under 0.03 reported as a close call |
| Audience | "young women 18–34" | Age/gender affinity of the comparable audience, with "no clear skew" when that is what the data says |
| Cultural hooks | generic "Taiwan heritage" | Japanese artists, films, TV and brands that the same-taste audience likes |
| Where exactly | famous districts | The district where the highest-affinity same-category venues cluster, plus a taste heatmap |
| Thin data | always answers | Refuses: "not enough Qloo data", no city, no audience |

## Features

- **Brand Advisor** (home): brand name + category → a conclusion card (city, district, culture to borrow, audience), then 4–6 recommendations (entry city, target audience, cultural references, positioning, pop-up location), each with confidence and clickable evidence.
- City-fit chart, audience affinity chart, Japanese taste neighbours (music / film / TV / brands), Leaflet + OpenStreetMap map with a Qloo taste heatmap; when the agent inspected two close cities you can switch between them.
- **"What Qloo provided" panel**: every Qloo call with endpoint, parameters, result count, top results, and whether the agent chose it or the coverage check added it.
- **Taste Bridge** tab: Chinese or English favourites (e.g. 周杰倫, 海角七號, 牛肉麵) → Japanese equivalents with a "why you might like it" line written by Claude from the Qloo tags and affinity only, plus an Osaka map. Picks that share Qloo tags with the favourites come first; brand links that share none (usually global luxury labels) are hidden and named in a note. Favourites Qloo doesn't know are listed as not found.
- **Evaluation** tab: 8 fictional brand scenarios run end-to-end with the real agent and live Qloo, scored by code (citations, honesty on thin data, city choice), with per-run cost.
- Works on phones; no AI-generated images (icons are lucide-react).

## How the agent works

```
Browser (Next.js App Router, Tailwind, Leaflet)
   │  POST /api/advise  |  POST /api/bridge          (zod validation, personal data stripped)
   ▼
Cost protection (src/lib/analyze.ts)
   pre-generated showcase bundle → in-memory answer cache → per-visitor / global / USD daily caps
   ▼
Agent (src/lib/agent.ts): Claude tool use, manual loop
   ├─ Claude chooses the tools: search_entities, home_market_proxies, audience_profile,
   │  japan_taste_neighbors, score_japan_cities, city_places, compare_tastes → submit_report
   ├─ after every turn, code tells the model the data coverage it computed (it cannot overrule it)
   ├─ guards: category keywords must name the product (no silent broadening), max 8 turns,
   │  prompt-token ceiling, "wrap up" note near the end, refusal / max_tokens → rules fallback
   ├─ coverage check fills any analysis step the model skipped (labelled "auto-filled")
   ├─ confidence = f(result counts, affinity, # independent endpoints), computed in code, then capped:
   │  close-call city (top-2 gap < 0.03) → at most medium; low-popularity venues → one level lower;
   │  hedged wording ("evidence is moderate") → the level the text admits; overclaiming words are softened
   ├─ citations to evidence IDs that don't exist are dropped and counted
   └─ rules-based agent when there is no Anthropic key or the daily AI budget is used up
   ▼
Qloo client (src/lib/qloo.ts)
   live → https://hackathon.api.qloo.com (X-Api-Key, server-side only), ~4 req/s throttle, bounded retries,
          in-memory + private disk cache (.cache/qloo/, git-ignored), stale cache if Qloo fails
   mock → src/lib/qloo-mock.ts (labelled demo data)
```

Tools: Brand Advisor gives Claude **7 Qloo-backed tools + `submit_report`** (listed above). Taste Bridge reuses `search_entities` and `japan_taste_neighbors`, adds `osaka_places`, and finishes with `submit_picks`.

Models (`src/lib/llm.ts`): the agent loop and the "LLM only" column use **Claude Sonnet 5.5** (`TASTEBRIDGE_MODEL`, without extended thinking, effort `medium`); the Taste Bridge explanations use **Claude Haiku 5.5** (`TASTEBRIDGE_SMALL_MODEL`) with structured JSON output. The tool definitions and system prompt are a fixed, cached prefix, and the growing conversation is cached between loop turns (about 70% of prompt tokens are cache reads in a brand analysis).

Taste Bridge explanations are checked by code: a line is kept only if it mentions a favourite, one of the pick's Qloo tags or its affinity, and makes no individual prediction ("you will love…"); otherwise a rule-built line from the shared tags is shown.

## Our steps ↔ official Qloo workflows

The hackathon kit (`@qloo/qloo-harness`) describes six validated workflows. TasteBridge calls the same REST endpoints directly from its server; this is how each agent tool maps onto them.

| TasteBridge tool | Qloo endpoint | Kit workflow |
|---|---|---|
| `search_entities` | `GET /search` (strict name match) | Describe an entity |
| `home_market_proxies` (keyword → place tag → same-category Taipei venues) | `GET /v2/tags`, then `GET /v2/insights` place + `filter.tags` + `filter.location` | Find Qloo tags (`find_tags`), then discover recommendations |
| `audience_profile` | `GET /v2/insights` `filter.type=urn:demographics` | Compare audiences |
| `japan_taste_neighbors` (artist / movie / tv_show / brand, pinned to Japan) | `GET /v2/insights` + `signal.location.query=Japan` + per-type Japan filter | Discover recommendations |
| `score_japan_cities` (6 cities, 15 km radius each, same-category venues when the category tag is known) | `GET /v2/insights` place + `filter.tags` + WKT point + radius, per city | Rank a shortlist; investigate geographic popularity |
| `city_places` (same-category venues first) + taste heatmap | `GET /v2/insights` place (6 km) and `filter.type=urn:heatmap` | Investigate geographic popularity |
| `compare_tastes` | `GET /v2/analysis/compare` | Compare audiences |
| Taste Bridge `osaka_places` | `GET /v2/insights` place, 5 km around Osaka | Discover recommendations; geographic popularity |

Parameter choices were checked against the live API; details and what did *not* work: [`docs/qloo-api-notes.md`](docs/qloo-api-notes.md). A typical brand analysis makes about 21 Qloo calls (~25–35 s live with the LLM, instant when cached).

## Evaluation (live, 2026-10-13)

8 fictional brands, real Claude agent + live Qloo, scored by code (`src/lib/eval.ts`):

| Check | Result |
|---|---|
| Scenarios passing all checks | 8 / 8 |
| Citation coverage | 100% of recommendations cite existing Qloo evidence; 0 invented evidence IDs |
| Honest on thin data ("millet wine", "holographic smart socks") | 2 / 2 refuse: no city, no audience, "not enough Qloo data" |
| City choice | 6 / 6 recommend Qloo's top-ranked city (or one tied with it) |
| Qloo calls chosen by the model | 100% (the coverage check did not need to add any) |
| Claude cost | About US$0.06 per brand analysis (US$0.051–0.059, average 0.056); US$0.047 average across all eight scenarios (thin-data cases stop early at about US$0.02) |

The first live run failed 4 scenarios; what was wrong and how it was fixed is in [`docs/qloo-api-notes.md`](docs/qloo-api-notes.md#data-quality-observations-2026-10-13).

## Cost protection for the public demo

Measured from token usage at list prices (the Evaluation tab's figures): **about US$0.06 per brand analysis** (US$0.051–0.059, average 0.056; agent loop + "LLM only" column, 6 Claude calls), and **US$0.047 average across all eight scenarios**, because a thin-data brand stops early at about US$0.02. A Taste Bridge query costs about US$0.03.

- **Pre-generated presets.** The 8 evaluation brands and the Taste Bridge examples are pre-generated with the real agent (`npm run showcase:build`), so judges see full results instantly and at no cost.
- **Answer cache** keyed by normalized input (case, spacing, keyword order).
- **Daily caps** (env-configurable): 2 LLM analyses per visitor, 8 in total, US$0.25 estimated spend. When a cap is hit, presets still come from the bundle and other inputs are answered by the rules-based agent on live Qloo data, with a note saying so. The Anthropic workspace's monthly spend limit is the hard stop.
- Qloo side: ~4 requests/second throttle, daily call cap per server process, per-visitor burst limits.

### Where the pre-generated results live

They contain Qloo-derived content, so they are never committed. `npm run showcase:build` writes them to the git-ignored `.data/showcase.json`; the private Qloo response cache is the git-ignored `.cache/qloo/`. The deployment is made from the local folder with `vercel deploy --prod`, which uploads both into the private Vercel deployment (`next.config.ts` traces them into the server function; `.vercelignore` does not exclude them). They are read on the server only and never served to the browser as files. The public GitHub repository contains neither.

## Run it

```bash
npm install
cp .env.example .env.local   # add QLOO_API_KEY and ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

With keys:
- `npm run showcase:build`: run all presets with Claude + live Qloo, score the evaluation set, write `.data/showcase.json` (`ONLY="pearl|周杰倫"` rebuilds a subset). Full run ≈ US$0.5.
- `npm run eval:live`: the evaluation set with the rules-based agent on live Qloo (no LLM cost).
- `npm run probe:live`: data-quality summary for every demo input.
- `npm run snapshots:record`: warm the private Qloo cache (`.cache/qloo/`, git-ignored).

Without `ANTHROPIC_API_KEY` the agent runs its rules-based path and the UI says the AI explanation needs an LLM key.

Submission checklist: [`docs/SUBMISSION-CHECKLIST.md`](docs/SUBMISSION-CHECKLIST.md).

## Limitations

- Brand inputs in the demo are fictional; real small Taiwanese brands are usually not in Qloo, so the agent uses same-category venues in Taipei as proxies and says so. Proxies are stand-ins for customers, not a measurement of the brand.
- Qloo coverage of Japanese venues and Taiwanese entities is not guaranteed in the hackathon environment; that is why data coverage and confidence are first-class outputs.
- City fit is category-specific only when Qloo has a place tag for the brand's category (bubble tea, tea store, bakery, gift shop...). Otherwise the city score is the overall taste affinity of the brand's audience, not category-specific, and the UI says so. The top two cities are often within 0.03; that is reported as a close call and the city recommendation is capped at medium confidence.
- Japanese culture neighbours are popularity-biased: the same well-known names recur across different inputs.
- Qloo's Japan filters for music are genre tags ("Japanese", "J-Pop") that also match Korean and Taiwanese acts popular in Japan. Qloo has no nationality field, so the app drops artists, films and shows whose Qloo description names another country (e.g. 東方神起, described as a South Korean duo) and keeps entities without a description; the evidence panel lists what was left out. Names in Japanese script are shown with the English name from Qloo's description, e.g. "Mika Nakashima (中島美嘉)".
- Taste Bridge Osaka places: venues sharing Qloo tags with the favourites come first; stations, hotels and venues themed on another country (e.g. an Australian pub) sink to the end unless they share a tag.
- "Brands" means brands Qloo lists with Japan as a key market, not Japanese-owned brands.
- Food words typed in Chinese (牛肉麵, 夜市) usually have no Qloo entity; they are reported as not found.
- Audience and affinity numbers describe taste correlation, not sales forecasts or any individual's preferences.
- Spend caps are kept in server memory, so they are per instance; the Anthropic workspace limit is the global stop.

## License

MIT. See [LICENSE](LICENSE).
