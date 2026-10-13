import { mkdtempSync } from "fs";
import os from "os";
import path from "path";
import { describe, expect, test } from "vitest";
import { buildInsightsParams, createQlooClient, nameMatches, QLOO_BASE, qlooMode, toQuery } from "./qloo";

describe("buildInsightsParams", () => {
  test("place query uses a WKT point (lon lat) + radius; country code only without a point", () => {
    const p = buildInsightsParams({ type: "place", entities: ["A", "B"], location: { lat: 34.6937, lon: 135.5023 }, radiusM: 5000, countryCode: "JP", take: 80 });
    expect(p).toMatchObject({ "filter.type": "urn:entity:place", "signal.interests.entities": ["A", "B"], "filter.location": "POINT(135.5023 34.6937)", "filter.location.radius": 5000, take: 50 });
    expect(p["filter.geocode.country_code"]).toBeUndefined();
    expect(buildInsightsParams({ type: "place", entities: ["A"], countryCode: "JP" })["filter.geocode.country_code"]).toBe("JP");
  });
  test("non-place types get a location signal, never geo filters", () => {
    const p = buildInsightsParams({ type: "artist", entities: ["A"], signalLocationQuery: "Japan", countryCode: "JP", location: { lat: 1, lon: 2 } });
    expect(p["signal.location.query"]).toBe("Japan");
    expect(p["filter.geocode.country_code"]).toBeUndefined();
    expect(p["filter.location"]).toBeUndefined();
  });
  test("release country only for TV (live API ignores it for movies)", () => {
    expect(buildInsightsParams({ type: "tv_show", releaseCountry: "Japan" })["filter.release_country"]).toBe("Japan");
    expect(buildInsightsParams({ type: "movie", releaseCountry: "Japan" })["filter.release_country"]).toBeUndefined();
    expect(buildInsightsParams({ type: "brand", releaseCountry: "Japan" })["filter.release_country"]).toBeUndefined();
  });
  test("demographics and heatmap types", () => {
    expect(buildInsightsParams({ type: "demographics", entities: ["A"], take: 5 })).toEqual({ "filter.type": "urn:demographics", "signal.interests.entities": ["A"] });
    expect(buildInsightsParams({ type: "heatmap", entities: ["A"], locationQuery: "Osaka", countryCode: "JP" }))
      .toEqual({ "filter.type": "urn:heatmap", "signal.interests.entities": ["A"], "filter.location.query": "Osaka" });
  });
});

test("toQuery sorts keys, joins arrays, drops empties", () => {
  expect(toQuery({ take: 5, "filter.type": "urn:entity:movie", a: undefined, b: [], "signal.interests.entities": ["X", "Y"] }))
    .toBe("filter.type=urn%3Aentity%3Amovie&signal.interests.entities=X%2CY&take=5");
});

test("mode switch", () => {
  expect(qlooMode({})).toBe("mock");
  expect(qlooMode({ QLOO_API_KEY: "k" })).toBe("live");
  expect(qlooMode({ QLOO_API_KEY: "k", QLOO_MODE: "mock" })).toBe("mock");
  expect(qlooMode({ QLOO_MODE: "snapshot" })).toBe("snapshot");
  expect(qlooMode({ QLOO_MODE: "live" })).toBe("mock");
});

test("mock client answers without network and labels data as mock", async () => {
  const q = createQlooClient({ env: {}, fetch: () => { throw new Error("no network in mock mode"); } });
  expect(q.mode).toBe("mock");
  const [jay] = await q.search("周杰倫", ["artist"]);
  expect(jay.name).toBe("Jay Chou");
  const raw = await q.request("/search", { query: "Mayday" });
  expect(raw.results[0]._mock).toBe(true);
});

test("live client calls the hackathon host with X-Api-Key and normalizes entities", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fake = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ success: true, results: { entities: [{ entity_id: "E1", name: "Dotonbori", subtype: "urn:entity:place", query: { affinity: 0.8 }, location: { lat: 34.66, lon: 135.5 }, tags: [{ id: "t1", name: "Street food" }] }] } }));
  };
  const q = createQlooClient({ env: { QLOO_API_KEY: "test-key", QLOO_SNAPSHOT_DIR: mkdtempSync(path.join(os.tmpdir(), "qs-")) }, fetch: fake });
  const [x] = await q.insights({ type: "place", entities: ["A"], countryCode: "JP" });
  expect(calls[0].url.startsWith(`${QLOO_BASE}/v2/insights?`)).toBe(true);
  expect(calls[0].url).toContain("filter.geocode.country_code=JP");
  expect((calls[0].init.headers as Record<string, string>)["X-Api-Key"]).toBe("test-key");
  expect(x).toMatchObject({ id: "E1", kind: "place", affinity: 0.8, lat: 34.66, lon: 135.5, tags: [{ id: "t1", name: "Street food" }] });
});

test("live failure falls back to a recorded snapshot", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "qs-"));
  const ok = async () => new Response(JSON.stringify({ success: true, results: [{ entity_id: "S1", name: "Saved" }] }));
  await createQlooClient({ env: { QLOO_API_KEY: "k", QLOO_SNAPSHOT_DIR: dir, QLOO_SNAPSHOT_WRITE: "1" }, fetch: ok }).search("x");
  const down = async () => new Response("err", { status: 503 });
  expect((await createQlooClient({ env: { QLOO_API_KEY: "k", QLOO_SNAPSHOT_DIR: dir }, fetch: down }).search("x"))[0].name).toBe("Saved");
  await expect(createQlooClient({ env: { QLOO_API_KEY: "k", QLOO_SNAPSHOT_DIR: dir }, fetch: down }).search("never-recorded")).rejects.toThrow(/503/);
  expect((await createQlooClient({ env: { QLOO_MODE: "snapshot", QLOO_SNAPSHOT_DIR: dir } }).search("x"))[0].id).toBe("S1");
});

test("strict search keeps only name or alias matches (synthetic shapes, no Qloo data)", () => {
  expect(nameMatches("Gong Cha", { name: "Harvard University" })).toBe(false);
  expect(nameMatches("Chatime", { name: "Chatime Indo" })).toBe(true);
  expect(nameMatches("周杰倫", { name: "Example Artist", properties: { akas: [{ value: "周杰倫" }] } })).toBe(true);
  expect(nameMatches("x", { name: "x" })).toBe(false);
});

test("compare reads shared tags, else intersects group A and B tags", async () => {
  const shapes = [
    { results: { tags: [{ tag_id: "t1", name: "Shared One" }], a: [], b: [] } },
    { results: { tags: [], a: [{ tag_id: "t1", name: "Tea" }, { tag_id: "t2", name: "Place" }, { tag_id: "t3", name: "Only A" }], b: [{ tag_id: "t1", name: "Tea" }, { tag_id: "t2", name: "Place" }] } },
  ];
  let i = 0;
  const fake = async () => new Response(JSON.stringify(shapes[i++]));
  const q = createQlooClient({ env: { QLOO_API_KEY: "k", QLOO_CACHE: "off" }, fetch: fake });
  expect(await q.compare(["A"], ["B"])).toEqual(["Shared One"]);
  expect(await q.compare(["A2"], ["B2"])).toEqual(["Tea"]);
});
