// Qloo client for the hackathon environment. Every call goes through `request`, which picks
// live API, local cache, or mock data — so the rest of the app never knows the difference.
// Verified against the live hackathon API on 2026-10-13 (see docs/qloo-api-notes.md).
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import path from "path";
import { devQlooKey } from "./devkey";
import { mockGet } from "./qloo-mock";
import { toQuery } from "./qloo-query";
import type { Entity, EntityKind, Params, QlooMode, Tag } from "./types";
import { urn } from "./types";

export { toQuery };

export const QLOO_BASE = "https://hackathon.api.qloo.com";

export interface InsightsQuery {
  type: EntityKind | "demographics" | "heatmap";
  entities?: string[];
  signalTags?: string[];
  filterTags?: string[];
  /** Taste of people in a place (signal.location.query), used for non-place types. */
  signalLocationQuery?: string;
  /** Hard geo filter, place/destination/heatmap only. Sent as WKT POINT(lon lat). */
  location?: { lat: number; lon: number };
  radiusM?: number;
  locationQuery?: string;
  countryCode?: string;
  releaseCountry?: string;
  take?: number;
  page?: number;
  explain?: boolean;
}

const GEO_TYPES = new Set(["place", "destination", "heatmap"]);

/** WKT point; the live API rejects "lat,lon" for filter.location on insights. */
export const wktPoint = (lat: number, lon: number) => `POINT(${lon} ${lat})`;

export function buildInsightsParams(q: InsightsQuery): Params {
  const type = q.type === "demographics" ? "urn:demographics" : q.type === "heatmap" ? "urn:heatmap" : urn(q.type);
  const p: Params = { "filter.type": type };
  if (q.entities?.length) p["signal.interests.entities"] = q.entities;
  if (q.signalTags?.length) p["signal.interests.tags"] = q.signalTags;
  if (q.filterTags?.length && q.type !== "demographics") p["filter.tags"] = q.filterTags;
  if (GEO_TYPES.has(q.type)) {
    if (q.location) p["filter.location"] = wktPoint(q.location.lat, q.location.lon);
    else if (q.locationQuery) p["filter.location.query"] = q.locationQuery;
    if (q.radiusM !== undefined && (q.location || q.locationQuery)) p["filter.location.radius"] = q.radiusM;
    if (q.countryCode && q.type !== "heatmap" && !q.location && !q.locationQuery) p["filter.geocode.country_code"] = q.countryCode;
  } else if (q.signalLocationQuery && q.type !== "demographics") {
    p["signal.location.query"] = q.signalLocationQuery;
  }
  // Live check: filter.release_country=Japan works for tv_show; for movie it is silently ignored.
  if (q.releaseCountry && q.type === "tv_show") p["filter.release_country"] = q.releaseCountry;
  if (q.take && q.type !== "demographics") p.take = Math.min(q.take, 50);
  if (q.page && q.page > 1) p.page = q.page;
  if (q.explain) p["feature.explainability"] = true;
  return p;
}

export function qlooMode(env: Record<string, string | undefined> = process.env): QlooMode {
  const m = env.QLOO_MODE;
  if (m === "mock" || m === "snapshot") return m;
  return env.QLOO_API_KEY ? "live" : "mock";
}

/** Mode for the running server: also sees a dev key stored only in the Windows user environment. */
export const serverQlooMode = () => qlooMode({ ...process.env, QLOO_API_KEY: devQlooKey() });

// ---- cache: private, server-side, never committed (Qloo hackathon rule) ----
export const snapshotKey = (p: string, params: Params) => createHash("sha1").update(`${p}?${toQuery(params)}`).digest("hex").slice(0, 16);
const cacheDir = (env: Record<string, string | undefined>) =>
  env.QLOO_SNAPSHOT_DIR ?? env.QLOO_CACHE_DIR ?? (env.VERCEL ? "/tmp/qloo-cache" : path.join(process.cwd(), ".cache", "qloo"));
const CACHE_TTL_MS = 14 * 24 * 3600 * 1000;
function readCache(dir: string, key: string, maxAgeMs = Infinity): unknown | null {
  const f = path.join(dir, `${key}.json`);
  try {
    if (!existsSync(f) || Date.now() - statSync(f).mtimeMs > maxAgeMs) return null;
    return JSON.parse(readFileSync(f, "utf8")).response ?? null;
  } catch { return null; }
}
function writeCache(dir: string, key: string, p: string, params: Params, response: unknown) {
  try { mkdirSync(dir, { recursive: true }); writeFileSync(path.join(dir, `${key}.json`), JSON.stringify({ path: p, params, savedAt: new Date().toISOString(), response })); } catch { /* read-only host */ }
}

// In-process memo shared by all requests (the key is per path+params, so it is safe to share).
const MEMO = new Map<string, { at: number; value: unknown }>();
const MEMO_MAX = 600;
const MEMO_TTL_MS = 6 * 3600 * 1000;
const INFLIGHT = new Map<string, Promise<unknown>>();
function memoGet(k: string) { const m = MEMO.get(k); if (!m || Date.now() - m.at > MEMO_TTL_MS) return undefined; return m.value; }
function memoSet(k: string, value: unknown) { if (MEMO.size >= MEMO_MAX) MEMO.delete(MEMO.keys().next().value!); MEMO.set(k, { at: Date.now(), value }); }

// ---- throttle: the hackathon key allows 5 requests/second and 10,000/month (response headers) ----
const MIN_GAP_MS = 230;
let nextSlot = 0;
async function slot() {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + MIN_GAP_MS;
  if (at > now) await new Promise(r => setTimeout(r, at - now));
}
// Daily ceiling on live calls per server process; past it, only cached answers are served.
const daily = { day: "", n: 0 };
function takeDailyBudget(limit: number) {
  const day = new Date().toISOString().slice(0, 10);
  if (daily.day !== day) { daily.day = day; daily.n = 0; }
  if (daily.n >= limit) return false;
  daily.n++; return true;
}
export class QlooError extends Error { constructor(message: string, public status?: number) { super(message); } }

// ---- normalization ----
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
export function normalizeEntity(r: any): Entity {
  const loc = r.location ?? r.properties?.location ?? {};
  const geo = r.properties?.geocode ?? {};
  const tags: Tag[] = (r.tags ?? []).map((t: any) => ({ id: String(t.id ?? t.tag_id ?? ""), name: String(t.name ?? t.id ?? "") })).filter((t: Tag) => t.id);
  return {
    id: String(r.entity_id ?? r.id ?? ""),
    name: String(r.name ?? "Unknown"),
    kind: String(r.subtype ?? r.types?.[0] ?? r.type ?? "").replace("urn:entity:", ""),
    affinity: num(r.query?.affinity),
    popularity: num(r.popularity),
    tags,
    lat: num(loc.lat) ?? num(loc.latitude),
    lon: num(loc.lon) ?? num(loc.lng) ?? num(loc.longitude),
    city: geo.city ?? geo.name,
    country: geo.country_code,
    address: r.properties?.address,
    description: r.properties?.short_description ?? r.properties?.description ?? r.disambiguation,
  };
}

/** Search returns loosely related filler after the real hit (e.g. "Gong Cha" → universities); keep only name/alias matches. */
const norm = (s: string) => s.toLowerCase().normalize("NFKC").replace(/[\s\p{P}\p{S}]+/gu, "");
export function nameMatches(query: string, raw: any): boolean {
  const q = norm(query);
  if (q.length < 2) return false;
  const names = [raw?.name, ...(raw?.properties?.akas ?? []).map((a: any) => a?.value ?? a)].filter((x): x is string => typeof x === "string").map(norm).filter(Boolean);
  return names.some(n => n.includes(q) || (n.length >= 4 && n.length * 2 >= q.length && q.includes(n)));
}

export interface QlooClient {
  mode: QlooMode;
  request(p: string, params: Params): Promise<any>;
  search(query: string, types?: EntityKind[], take?: number, opts?: { strict?: boolean }): Promise<Entity[]>;
  insights(q: InsightsQuery): Promise<Entity[]>;
  demographics(entityIds: string[]): Promise<{ age: Record<string, number>; gender: Record<string, number> } | null>;
  heatmap(entityIds: string[], locationQuery: string): Promise<{ lat: number; lon: number; affinity: number }[]>;
  compare(a: string[], b: string[]): Promise<string[]>;
  tags(query: string, take?: number, parentType?: EntityKind): Promise<(Tag & { type?: string })[]>;
}

type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

export function createQlooClient(opts: { env?: Record<string, string | undefined>; fetch?: FetchFn } = {}): QlooClient {
  const env = opts.env ?? { ...process.env, QLOO_API_KEY: devQlooKey() };
  const mode = qlooMode(env);
  const doFetch: FetchFn = opts.fetch ?? ((u, i) => fetch(u, i));
  const dir = cacheDir(env);
  const useDisk = env.QLOO_CACHE !== "off";
  const dailyLimit = Number(env.QLOO_DAILY_CALL_CAP ?? 2000);

  async function live(p: string, params: Params, key: string) {
    if (!takeDailyBudget(dailyLimit)) throw new QlooError("Daily Qloo call budget used up; only cached results are available today.", 429);
    for (let attempt = 0; ; attempt++) {
      await slot();
      const res = await doFetch(`${QLOO_BASE}${p}?${toQuery(params)}`, { headers: { "X-Api-Key": env.QLOO_API_KEY ?? "" }, signal: AbortSignal.timeout(25000) });
      if (res.status === 429 && attempt < 2) {
        const wait = Math.min(5, Number(res.headers.get("x-second-ratelimit-reset") ?? 1) || 1);
        await new Promise(r => setTimeout(r, wait * 1000 + 100));
        continue;
      }
      if (!res.ok) throw new QlooError(`Qloo ${res.status} on ${p}`, res.status);
      const json = await res.json();
      if (useDisk) writeCache(dir, key, p, params, json);
      return json;
    }
  }

  async function request(p: string, params: Params) {
    if (mode === "mock") return mockGet(p, params);
    const key = snapshotKey(p, params);
    const mk = `${dir}|${key}`;
    const m = memoGet(mk);
    if (m !== undefined) return m;
    if (mode === "snapshot") {
      const s = readCache(dir, key);
      if (!s) throw new QlooError(`No cached response for ${p} (${key})`);
      return s;
    }
    const fresh = useDisk ? readCache(dir, key, CACHE_TTL_MS) : null;
    if (fresh) { memoSet(mk, fresh); return fresh; }
    if (INFLIGHT.has(mk)) return INFLIGHT.get(mk);
    const job = live(p, params, key)
      .then(j => { memoSet(mk, j); return j; })
      .catch(e => { const stale = readCache(dir, key); if (stale) return stale; throw e; })
      .finally(() => INFLIGHT.delete(mk));
    INFLIGHT.set(mk, job);
    return job;
  }

  const rawEntities = (j: any): any[] => (Array.isArray(j?.results) ? j.results : j?.results?.entities ?? []);

  return {
    mode,
    request,
    async search(query, types, take = 5, o = {}) {
      const params: Params = { query, take };
      if (types?.length) params.types = types.map(urn);
      const raws = rawEntities(await request("/search", params));
      return (o.strict ? raws.filter(r => nameMatches(query, r)) : raws).map(normalizeEntity);
    },
    async insights(q) {
      return rawEntities(await request("/v2/insights", buildInsightsParams(q))).map(normalizeEntity);
    },
    async demographics(ids) {
      const j = await request("/v2/insights", buildInsightsParams({ type: "demographics", entities: ids }));
      const rows: any[] = j?.results?.demographics ?? [];
      if (!rows.length) return null;
      const avg = (pick: (r: any) => Record<string, number> | undefined) => {
        const out: Record<string, number> = {};
        for (const r of rows) for (const [k, v] of Object.entries(pick(r) ?? {})) out[k] = (out[k] ?? 0) + Number(v) / rows.length;
        return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Math.round(v * 1000) / 1000]));
      };
      return { age: avg(r => r.query?.age), gender: avg(r => r.query?.gender) };
    },
    async heatmap(ids, locationQuery) {
      const j = await request("/v2/insights", buildInsightsParams({ type: "heatmap", entities: ids, locationQuery }));
      return (j?.results?.heatmap ?? []).map((h: any) => ({ lat: Number(h.location?.latitude), lon: Number(h.location?.longitude), affinity: Number(h.query?.affinity ?? 0) }))
        .filter((h: any) => Number.isFinite(h.lat) && Number.isFinite(h.lon));
    },
    async compare(a, b) {
      // Live shape: { results: { tags: [shared…], a: [tags of A], b: [tags of B] } }.
      const j = await request("/v2/analysis/compare", { "a.signal.interests.entities": a, "b.signal.interests.entities": b, take: 20 });
      const res = j?.results ?? {};
      let rows: any[] = Array.isArray(res) ? res : res.tags ?? [];
      if (!rows.length && Array.isArray(res.a) && Array.isArray(res.b)) {
        const key = (t: any) => String(t.name ?? t.tag_id).toLowerCase();
        const inB = new Set(res.b.map(key));
        rows = res.a.filter((t: any) => inB.has(key(t)));
      }
      const generic = /^(place|restaurant|brand|food & beverage|point of interest|establishment)$/i;
      const seen = new Set<string>();
      return rows.map(r => String(r.name ?? r.tag_id ?? r.entity_id ?? "")).filter(n => n && !generic.test(n) && !seen.has(n.toLowerCase()) && seen.add(n.toLowerCase()));
    },
    async tags(query, take = 5, parentType) {
      const params: Params = { "filter.query": query, take };
      if (parentType) params["filter.parents.types"] = urn(parentType);
      const j = await request("/v2/tags", params);
      return (j?.results?.tags ?? []).map((t: any) => ({ id: String(t.tag_id ?? t.id), name: String(t.name), type: t.type ?? t.subtype }));
    },
  };
}
