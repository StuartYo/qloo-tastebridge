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
| `GET /search?query=…&types=urn:entity:brand,…&take=…` | Works. Response `{ results: [entity…] }`. **After the real hit it pads with loosely related filler** (e.g. a tea-chain name searched as a brand returned a university and a sports league). We keep only results whose name or `properties.akas` contain the query. |
| `/search` `filter.location` | Must be `lat,lon` (WKT is rejected here). Not used. |
| `/search` `sort_by=popularity` | Returns globally popular entities unrelated to the query. Not used. |
| `GET /v2/tags?filter.query=…&filter.parents.types=urn:entity:place` | Works. Shape `{ results: { tags: [{ id, name, type, parents, popularity }] } }` (field is `id`, not `tag_id`). |
| `/v2/insights` `filter.type=urn:demographics` | Works. One row per entity *that has data* (often fewer rows than seeds). Values are relative affinity (−1…1). |
| `/v2/insights` `urn:entity:artist` + `signal.location.query=Japan` | Works but barely shifts results (K-pop dominated). **Adding `filter.tags` with Japanese music genres** (`urn:tag:genre:music:japanese`, `j_pop`, `jpop`, `japanese_pop`, `japanese_rock`, …) gives well-known Japanese pop artists. Multiple `filter.tags` behave as OR. |
| `urn:entity:movie` + `filter.release_country=Japan` | **Silently ignored** (US films came back; `JP` returned 0). Use `filter.tags` `urn:tag:keyword:media:japanese`, `…:japanese_drama`, `urn:tag:subgenre:qloo:anime`. |
| `urn:entity:tv_show` + `filter.release_country=Japan` | Works (Japanese shows). |
| `urn:entity:brand` + any location | No geo filter for brands. **`filter.tags=urn:tag:key_market:qloo:japan`** returns brands Qloo lists with Japan as a key market (a mix of Japanese and international consumer brands). That is "active in Japan", not "Japanese-owned"; the UI says so. |
| `urn:entity:place` + `filter.geocode.name=Osaka` | **Returned 0** (geocode city for Osaka places is "Osaka Prefecture"). Not used. |
| `urn:entity:place` + `filter.location=34.69,135.50` | **400 "WKT format is invalid"**. Use `filter.location=POINT(135.5023 34.6937)` (lon lat) + `filter.location.radius` (metres). |
| `urn:entity:place` + `filter.location.query=Osaka` | Works. |
| `urn:entity:place` + `filter.geocode.country_code=JP` | Works (mixed cities). |
| `urn:entity:place` + `filter.tags=<category tag>` + `filter.location=POINT(Taipei)` (no signal) | Works: real same-category venues in Taipei (e.g. bubble tea shops). Used as home-market taste proxies. |
| `signal.interests.tags` alone | Returns a flat affinity (same value for every result), useless for ranking; demographics with only tags → empty. Not used as a signal. |
| `sort_by` | Only `affinity`, `distance`, `rating`, `quality` (400 otherwise). |
| `/v2/insights` `filter.type=urn:heatmap` + `filter.location.query=<city>` | Works. `{ results: { heatmap: [{ location: { latitude, longitude, geohash }, query: { affinity, affinity_rank, popularity, … } }] } }`. |
| `GET /v2/analysis/compare` | Works. Shape `{ results: { tags: [shared…], a: [tags of A], b: [tags of B] } }`, each tag `{ tag_id, name, subtype, query: { count } }`. `tags` is often empty; tags are type-specific, so **place vs brand shares nothing**: compare venues with venues. We fall back to intersecting A and B by tag name. |
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

## Data-quality observations (2026-10-13)

Entity names returned by Qloo are deliberately not listed here (no Qloo response content in this repository).

Rules agent, no LLM:
- Brand advisor, 6 "should have data" scenarios: all produced cited reports. Category proxies return real
  same-category venues in Taipei, and the Japanese cities have matching venues of the same kind (bubble tea
  shops in Tokyo/Osaka, tea houses in Kyoto, bakeries in Osaka). Good.
- City fit: all six cities return 10 matching places; scores differ by only 0.01–0.05, so the app labels a
  small gap a "close call" instead of claiming a clear winner. Thin as a differentiator.
- Culture neighbours: real Japanese results, but popularity-biased: the same few well-known artists, films and
  shows appear for many different inputs. Medium.
- Brands with Japan as a key market: plausible but generic (luxury and beauty brands dominate). Thin.
- Demographics: available for most venue proxies; often a weak skew. Medium.
- Compare: useful only venue-to-venue (shared drink, cuisine and atmosphere tags). Medium.
- Honesty cases: "holographic smart socks" → no proxies → insufficient; "millet wine" → 2 obscure venues
  (popularity 0.44) → insufficient.
- Taste Bridge: Chinese names of a Mandopop singer, a Taiwanese band and two Taiwanese films resolve to the
  right entities (directly or via their English titles). Food words (牛肉麵, 夜市) only match venue names, so the
  agent reports them as not found rather than forcing an unrelated venue.

Claude agent (Sonnet 5.5, tool use) on the same 8 scenarios: what the evaluation found and what was changed:
- The model was told the data coverage after every tool result. Early in a run (proxies found, nothing measured
  yet) code reported "insufficient", so the model stopped after one turn on 4 of 6 good scenarios. Fix: the
  coverage note is sent once per turn and has explicit early states ("no_proxies_yet",
  "proxies_found_measure_next").
- On "millet wine" the model broadened the keyword to "bar" / "brewery", found popular generic venues, and the
  thin-data case turned into a confident answer (its own summary still said the proxies were imperfect). Fix:
  category keywords must name the product (the input's keywords, else its category words); off-product keywords
  are refused before any Qloo call.
- The model sometimes fetched places for the runner-up city last, so the map showed a different city from the
  top-ranked one. Fix: every city the agent inspected is kept; the report leads with the top-ranked city and
  lets the reader switch.
- After the fixes: 8/8 pass, 100% citation coverage, no invented evidence IDs, both thin-data cases refuse,
  6/6 recommended cities match Qloo's ranking (or a tie with it). The model chose every Qloo call in all 8 runs.

## Judge feedback round (2026-10-13, evening)

- **City fit was not category-specific.** With only `signal.interests.entities` + location, the top places
  behind a city's score were hotels, kimono rental and steak houses, not bubble tea shops. Checked live:
  adding the brand's category tag (`filter.tags`, the same tag `home_market_proxies` found) to the 15 km city
  query returns same-category venues per city. Cities are now scored on those venues; the evidence row says
  "matching Bubble Tea venues". If the tag finds fewer than 3 venues across all cities, the app falls back to
  all places and labels the score "overall taste affinity of the brand's audience, not category-specific".
  Effect: scores spread out (for the bubble tea sample, two cities have venues near 0.8, others drop to 0 to 0.5),
  so the ranking now carries information.
- **Confidence vs. wording.** A HIGH label sat next to text saying "the evidence is moderate", and a city
  recommendation was HIGH with a 0.02 gap. Code now caps a city recommendation at medium when the top-two gap
  is under 0.03, lowers venue advice one level when the cited venues' mean Qloo popularity is under 0.5, lowers
  the level to what the text itself admits ("moderate", "close call", "no Qloo support"), and softens
  overclaiming words ("confirms", "clear winner") whenever the level is below high. The reason is shown under
  the pill.
- **Taste Bridge brands.** Brand neighbours that share no tag with the favourites (global luxury labels and
  airlines, linked to almost any audience) are hidden and named in a note; other picks are ranked with
  tag-sharing items first.

## Final review round (2026-10-13, night)

- **Non-Japanese acts in "Japanese music".** The music Japan filter is a set of genre tags ("Japanese",
  "J-Pop"), and Qloo applies them to Korean and Taiwanese acts popular in Japan (東方神起 / TVXQ, 陳建騏,
  宇宙人 / Cosmos People). Qloo returns no nationality field, so code reads the first sentence of each entity's
  Qloo description: if it names another country or scene ("South Korean", "Taiwanese", "Mandopop", "American")
  and does not say "Japanese", the entity is left out of the artist / film / TV lists (`src/lib/culture.ts`).
  The evidence row names what was left out. Entities without a description are kept.
- **Display names.** Japanese-script names are shown as "English (日本語)", with the English name taken from
  the Qloo description ("Mika Nakashima (中島美嘉)").
- **Taste Bridge Osaka places.** The 12 places Qloo returns are re-ranked: venues sharing a Qloo tag with the
  favourites first, then the rest in Qloo's order, and stations, hotels/hostels (by name or a lodging tag) and
  venues themed on another country (by name or a cuisine/venue tag, e.g. an Australian pub) last unless they
  share a tag. Claude sees the list in that order.
- **Sample brand description** no longer states an age ("young urban customers"): the Qloo audience for the
  bubble tea proxies leans 35–44, and the description was steering the "LLM only" column.
