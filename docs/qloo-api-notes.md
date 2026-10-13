# Qloo API notes (hackathon environment)

First written from the docs on 2026-10-11; **verified against the live hackathon API on 2026-10-13**.
"Verified" below means we sent the request with a hackathon key and looked at the response. No Qloo
response data is stored in this repository; the app caches responses only in the git-ignored `.cache/qloo/`.

Sources
- Hackathon developer guide: https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide
- Starter kit: https://github.com/qloo/qloo-hackathon-kit (`docs/SUBMISSION.md`, `docs/API_ACCESS.md`, `docs/SAFE_USE.md`)
- Insights deep dive, entity type parameter guide, search, tags, compare reference pages on docs.qloo.com

## Access (verified)

- Base URL `https://hackathon.api.qloo.com`; header `X-Api-Key: <key>`. Keys stay server-side only.
- **Rate limits come back as response headers**: `x-second-ratelimit-limit: 5`, `x-month-ratelimit-limit: 10000`
  (plus `-remaining` and `-reset`). The app throttles to ~4 requests/second, retries a 429 at most twice
  after `x-second-ratelimit-reset`, and caps live calls per server process per day (`QLOO_DAILY_CALL_CAP`, default 2000).
- Latency: 0.2–4 s typical; a few place queries took 11–13 s. Client timeout is 25 s.
- Private server-side caching is allowed with no time limit; Qloo data must not go into a public repo.
- Event rules (kit email): don't send personal data (names, e-mails, device IDs) to Qloo; results describe
  group tendencies, not one person.

## What works, what doesn't (verified)

| Call | Result |
|---|---|
| `GET /search?query=…&types=urn:entity:brand,…&take=…` | Works. Response `{ results: [entity…] }`. **After the real hit it pads with loosely related filler** (e.g. "Gong Cha" as brand → Harvard, NBA). We keep only results whose name or `properties.akas` contain the query. |
| `/search` `filter.location` | Must be `lat,lon` (WKT is rejected here). Not used. |
| `/search` `sort_by=popularity` | Returns globally popular entities unrelated to the query. Not used. |
| `GET /v2/tags?filter.query=…&filter.parents.types=urn:entity:place` | Works. Shape `{ results: { tags: [{ id, name, type, parents, popularity }] } }` (field is `id`, not `tag_id`). |
| `/v2/insights` `filter.type=urn:demographics` | Works. One row per entity *that has data* (often fewer rows than seeds). Values are relative affinity (−1…1). |
| `/v2/insights` `urn:entity:artist` + `signal.location.query=Japan` | Works but barely shifts results (K-pop dominated). **Adding `filter.tags` with Japanese music genres** (`urn:tag:genre:music:japanese`, `j_pop`, `jpop`, `japanese_pop`, `japanese_rock`, …) gives real J-pop (宇多田ヒカル, 中島美嘉, 浜崎あゆみ). Multiple `filter.tags` behave as OR. |
| `urn:entity:movie` + `filter.release_country=Japan` | **Silently ignored** (US films came back; `JP` returned 0). Use `filter.tags` `urn:tag:keyword:media:japanese`, `…:japanese_drama`, `urn:tag:subgenre:qloo:anime`. |
| `urn:entity:tv_show` + `filter.release_country=Japan` | Works (Japanese shows). |
| `urn:entity:brand` + any location | No geo filter for brands. **`filter.tags=urn:tag:key_market:qloo:japan`** returns brands Qloo lists with Japan as a key market (LINE, Genki Sushi, Yoshinoya, Shake Shack…). That is "active in Japan", not "Japanese-owned"; the UI says so. |
| `urn:entity:place` + `filter.geocode.name=Osaka` | **Returned 0** (geocode city for Osaka places is "Osaka Prefecture"). Not used. |
| `urn:entity:place` + `filter.location=34.69,135.50` | **400 "WKT format is invalid"**. Use `filter.location=POINT(135.5023 34.6937)` (lon lat) + `filter.location.radius` (metres). |
| `urn:entity:place` + `filter.location.query=Osaka` | Works. |
| `urn:entity:place` + `filter.geocode.country_code=JP` | Works (mixed cities). |
| `urn:entity:place` + `filter.tags=<category tag>` + `filter.location=POINT(Taipei)` (no signal) | Works: real same-category venues in Taipei (e.g. bubble tea shops). Used as home-market taste proxies. |
| `signal.interests.tags` alone | Returns a flat affinity (same value for every result) — useless for ranking; demographics with only tags → empty. Not used as a signal. |
| `sort_by` | Only `affinity`, `distance`, `rating`, `quality` (400 otherwise). |
| `/v2/insights` `filter.type=urn:heatmap` + `filter.location.query=<city>` | Works. `{ results: { heatmap: [{ location: { latitude, longitude, geohash }, query: { affinity, affinity_rank, popularity, … } }] } }`. |
| `GET /v2/analysis/compare` | Works. Shape `{ results: { tags: [shared…], a: [tags of A], b: [tags of B] } }`, each tag `{ tag_id, name, subtype, query: { count } }`. `tags` is often empty; tags are type-specific, so **place vs brand shares nothing** — compare venues with venues. We fall back to intersecting A and B by tag name. |
| Entity location | `location: { lat, lon, geohash }` on places; `properties.geocode.city/country_code`. |

## How this app maps to the API

| Need | Call |
|---|---|
| Brand itself | `/search?query=<brand>&types=urn:entity:brand` (strict name match; small Taiwanese brands are usually absent) |
| Category → tag | `/v2/tags?filter.query=bubble tea&filter.parents.types=urn:entity:place` → prefer `category:place`/`genre:place` tags whose name contains the whole keyword |
| Home-market proxies | `/v2/insights?filter.type=urn:entity:place&filter.tags=<tag>&filter.location=POINT(121.5654 25.033)&filter.location.radius=15000&take=3` |
| Audience | `/v2/insights?filter.type=urn:demographics&signal.interests.entities=…` |
| Japanese culture neighbours | `/v2/insights?filter.type=<artist/movie/tv_show/brand>&signal.interests.entities=…&signal.location.query=Japan` + the per-type Japan filter above |
| City fit | per city: `filter.type=urn:entity:place&signal.interests.entities=…&filter.location=POINT(<city centre>)&filter.location.radius=15000&take=10` |
| Pop-up venues | same, 6 km radius, first with `filter.tags=<category tag>` (same-category venues), else any place |
| Heatmap | `filter.type=urn:heatmap&filter.location.query=<city>&signal.interests.entities=…` |
| Shared themes | `/v2/analysis/compare` A = proxies, B = top venues in the chosen city (or Japan-market brands when proxies are brands/artists) |

## Data-quality observations (2026-10-13, rules agent, no LLM)

- Brand advisor, 6 "should have data" scenarios: all produced cited reports. Bubble tea → same-category venues
  in Osaka/Tokyo include Gong Cha, Yifang Taiwan Fruit Tea, Chun Shui Tang; oolong tea → Kyoto with Uji tea houses;
  pineapple cake → Osaka bakeries. Good.
- City fit: all six cities return 10 matching places; scores differ by only 0.01–0.05, so the app labels a
  small gap a "close call" instead of claiming a clear winner. Thin as a differentiator.
- Culture neighbours: real Japanese results, but popularity-biased — the same few names (中島美嘉, 小池徹平,
  "Last Letter", "The Makanai") appear for many inputs. Medium.
- Brands with Japan as a key market: plausible but generic (luxury / K-beauty). Thin.
- Demographics: available for most venue proxies; often a weak skew. Medium.
- Compare: useful only venue-to-venue (e.g. "Bubble Tea Store, Jasmine Tea, Layered, Sweet"). Medium.
- Honesty cases: "holographic smart socks" → no proxies → insufficient; "millet wine" → 2 obscure venues
  (popularity 0.44) → insufficient. Live eval 8/8.
- Taste Bridge: 周杰倫 / 五月天 / 海角七號 (Cape No. 7) / 想見你 (Someday or One Day) resolve to the right
  entities. Food words (牛肉麵, 夜市) only match venue names, so 夜市 resolves to an unrelated guesthouse — thin.
