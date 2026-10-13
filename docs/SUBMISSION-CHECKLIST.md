# Submission checklist

Maps the hackathon kit's [`docs/SUBMISSION.md`](https://github.com/qloo/qloo-hackathon-kit/blob/main/docs/SUBMISSION.md) (6 items) and the Devpost requirements to where each one is answered. Status as of 2026-10-13 (after the judge-feedback round).

## Kit items

| # | Kit asks for | Where it is answered | Status |
|---|---|---|---|
| 1 | A short product problem statement | README → "The problem"; Devpost description | Done |
| 2 | The Qloo workflow or MCP tools used and why they fit | README → "Our steps ↔ official Qloo workflows" and "How the agent works" | Done |
| 3 | A redacted request-to-result explanation, including entity/tag choices | Below ("Request to result") and `docs/qloo-api-notes.md` | Done |
| 4 | A short demo or screenshots with no credential or personal data | Devpost: demo video (under 3 minutes, recorded from the deployed site) and cover image; no keys or personal data visible | Done |
| 5 | Setup steps another participant can run from a clean environment | README → "Run it" (`npm install`, `.env.local`, `npm run dev`; tests and build commands) | Done |
| 6 | Known limitations, including what the result does not establish | README → "Limitations"; the app's data-coverage line and confidence pills | Done |

The kit also says judges should consider usefulness, technical execution, provenance and user clarity, responsible data handling, and reproducibility:

| Criterion | Evidence in the project |
|---|---|
| Usefulness | Brand Advisor answers a real pre-launch question (city, audience, cultural hooks, pop-up spots); Taste Bridge for people moving to Osaka |
| Technical execution | Claude tool-use loop over 8 Qloo-backed tools; confidence computed in code; prompt caching; tests (`npm test`), live evaluation 8/8; city fit scored on same-category venues |
| Provenance and user clarity | Every recommendation cites evidence IDs and its confidence is capped by code rules shown under the pill; the "What Qloo provided" panel lists each call with parameters and whether the agent chose it; "LLM only" column for contrast; mock and cached data are labelled |
| Responsible data handling | Keys server-side only; e-mails, phone numbers and URLs stripped before Qloo; no Qloo data in the repo; results described as group tendencies; thin data → refusal |
| Reproducibility | `npm run showcase:build` re-runs the evaluation; `npm run eval:live` runs it without LLM cost; Qloo parameters documented in `docs/qloo-api-notes.md` |

## Request to result (redacted)

Input: fictional brand "Formosa Pearl", category "Bubble tea chain", keywords "bubble tea", "milk tea".

1. `GET /search?query=Formosa Pearl&types=urn:entity:brand` → no match (expected for a small brand).
2. `GET /v2/tags?filter.query=bubble tea&filter.parents.types=urn:entity:place` → the agent keeps the place tag whose name contains the whole keyword (a "category" tag beats dish or menu tags).
3. `GET /v2/insights?filter.type=urn:entity:place&filter.tags=<that tag>&filter.location=POINT(121.5654 25.033)&filter.location.radius=15000&take=3` → three bubble tea venues in Taipei. These become the taste proxies for the brand's home customers.
4. With the proxy IDs as `signal.interests.entities`: demographics, Japanese culture neighbours (artist / movie / TV / brand with a Japan filter each), and place insights within 15 km of six city centres, filtered to the same category tag (`filter.tags`), so each city is scored on its bubble tea venues.
5. City places (6 km, same-category tag first) and a heatmap for the best city and the runner-up; compare home proxies with the top venues there.
6. Claude writes 4–6 recommendations citing evidence IDs; code drops unknown IDs and computes confidence from result counts, affinity and the number of independent endpoints, then caps it (close-call city at most medium, low-popularity venues one level lower, never above what the text itself admits).

Result (shape, not data): an entry city reported as a close call with the runner-up (fit gap under 0.03), an audience skew by age band, Japanese culture references, positioning against brands with Japan as a key market, and a pop-up area with named venues, each with evidence IDs and a confidence level.

What it does not establish: sales, demand or an individual's preferences; Qloo affinity is a taste correlation for groups.

## Devpost requirements

| Requirement | Status |
|---|---|
| Working demo link judges can use end to end, free, until judging ends (2026-11-16) | Done: https://qloo-tastebridge.vercel.app ; presets pre-generated so judges never hit the AI caps; keys set as Vercel environment variables |
| Public code repository with all source and run instructions | Done: https://github.com/StuartYo/qloo-tastebridge ; `.data/`, `.cache/`, `screenshots/` and `.env*` are git-ignored (checked with `git ls-files`) |
| Text description of what the project does and what is Qloo-powered | Done: kept outside this repo; pasted into Devpost |
| Hosted publicly (not local only) | Done (Vercel; deployed from the local folder with `vercel deploy --prod`, which ships the private results bundle inside the deployment) |
| Open-source license visible in the repo's About | Done: `LICENSE` (MIT) |
| English throughout | Done |

Before each release: run `gitleaks detect` on the repo, `npm run typecheck && npm run lint && npm test && npm run build`, and open each tab of the deployed site on a phone.
