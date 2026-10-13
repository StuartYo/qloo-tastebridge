// MOCK DATA — hand-written for development and the keyless demo. Not Qloo data.
// Affinity scores are computed from tag overlap so results stay consistent across calls;
// they only imitate the shape of real Qloo responses (documented fields: entity_id, name,
// subtype, properties, popularity, tags, query.affinity; demographics; heatmap).
import { CITY_CENTERS } from "./geo";
import type { Params } from "./types";

type Region = "TW" | "JP" | "GLOBAL";
interface M { id: string; name: string; akas: string[]; subtype: string; tags: string[]; pop: number; region: Region; city?: string; lat?: number; lon?: number; address?: string; sparse?: boolean }

export const MOCK_TAGS: Record<string, string> = {
  mandopop: "Mandopop", jpop: "J-Pop", rock: "Rock", indie: "Indie", ballad: "Ballad", band: "Band", rnb: "R&B", city_pop: "City Pop",
  nostalgia: "Nostalgia", youth: "Youth culture", coming_of_age: "Coming of age", slice_of_life: "Slice of life", romance: "Romance",
  seaside: "Seaside town", family: "Family", food_drama: "Food drama", anime: "Anime", music_film: "Music film",
  tea: "Tea", bubble_tea: "Bubble tea", dessert: "Dessert", cafe: "Cafe", street_food: "Street food", noodles: "Noodles",
  comfort_food: "Comfort food", night_market: "Night market", souvenir: "Souvenir", bakery: "Bakery",
  minimalist: "Minimalist design", lifestyle: "Lifestyle", design: "Design", craft: "Craft", select_shop: "Select shop", vintage: "Vintage",
  premium: "Premium", healthy: "Healthy", fried_chicken: "Fried chicken", oolong: "Oolong", millet_wine: "Millet wine", indigenous: "Indigenous culture",
};

const e = (id: string, name: string, subtype: string, region: Region, tags: string[], pop: number, akas: string[] = [], geo?: [string, number, number, string?], sparse?: boolean): M =>
  ({ id: `MOCK-${id}`, name, akas, subtype: `urn:entity:${subtype}`, tags, pop, region, city: geo?.[0], lat: geo?.[1], lon: geo?.[2], address: geo?.[3], sparse });

export const MOCK_ENTITIES: M[] = [
  // Taiwan seeds
  e("TW-ART-1", "Jay Chou", "artist", "TW", ["mandopop", "rnb", "ballad", "youth", "nostalgia"], 0.97, ["周杰倫", "周杰伦"]),
  e("TW-ART-2", "Mayday", "artist", "TW", ["mandopop", "rock", "band", "youth", "coming_of_age"], 0.95, ["五月天"]),
  e("TW-ART-3", "Jolin Tsai", "artist", "TW", ["mandopop", "youth", "design"], 0.9, ["蔡依林"]),
  e("TW-ART-4", "Sunset Rollercoaster", "artist", "TW", ["indie", "city_pop", "band", "nostalgia"], 0.72, ["落日飛車"]),
  e("TW-MOV-1", "Cape No. 7", "movie", "TW", ["music_film", "seaside", "romance", "nostalgia", "band"], 0.82, ["海角七號", "海角七号"]),
  e("TW-MOV-2", "You Are the Apple of My Eye", "movie", "TW", ["coming_of_age", "romance", "youth", "nostalgia"], 0.85, ["那些年，我們一起追的女孩", "那些年"]),
  e("TW-TV-1", "Someday or One Day", "tv_show", "TW", ["romance", "nostalgia", "youth", "music_film"], 0.8, ["想見你"]),
  e("TW-PLC-1", "Taipei Beef Noodle House (mock)", "place", "TW", ["noodles", "comfort_food", "street_food"], 0.7, ["牛肉麵", "beef noodle", "beef noodles"], ["Taipei", 25.0418, 121.5440]),
  e("TW-PLC-2", "Raohe Night Market", "place", "TW", ["night_market", "street_food", "fried_chicken"], 0.8, ["饒河夜市", "夜市", "night market"], ["Taipei", 25.0510, 121.5775]),
  e("TW-PLC-3", "Da'an Bubble Tea Bar (mock)", "place", "TW", ["bubble_tea", "tea", "youth", "dessert"], 0.82, [], ["Taipei", 25.0330, 121.5430]),
  e("TW-PLC-4", "Ximen Brown Sugar Milk Tea (mock)", "place", "TW", ["bubble_tea", "dessert", "youth", "street_food"], 0.8, [], ["Taipei", 25.0422, 121.5079]),
  e("TW-PLC-5", "Zhongshan Tea Lab (mock)", "place", "TW", ["bubble_tea", "tea", "cafe", "design"], 0.75, [], ["Taipei", 25.0526, 121.5205]),
  e("TW-BRD-1", "Chatime", "brand", "TW", ["bubble_tea", "tea", "youth", "dessert"], 0.78, ["日出茶太", "milk tea", "bubble tea"]),
  e("TW-BRD-2", "Gong Cha", "brand", "TW", ["bubble_tea", "tea", "youth"], 0.8, ["貢茶", "milk tea", "bubble tea"]),
  e("TW-BRD-3", "Tiger Sugar", "brand", "TW", ["bubble_tea", "dessert", "youth", "premium"], 0.7, ["老虎堂", "bubble tea", "brown sugar"]),
  e("TW-BRD-4", "Taiwan Oolong Leaf Co. (mock)", "brand", "TW", ["tea", "oolong", "premium", "craft", "healthy"], 0.6, ["oolong", "烏龍茶", "high mountain tea"]),
  e("TW-BRD-5", "Pineapple Cake House (mock)", "brand", "TW", ["bakery", "souvenir", "dessert", "craft"], 0.55, ["鳳梨酥", "pineapple cake"]),
  e("TW-BRD-6", "Island Design Store (mock)", "brand", "TW", ["select_shop", "lifestyle", "design", "minimalist", "craft"], 0.5, ["select shop", "lifestyle store", "gift shop", "選物店"]),
  e("TW-BRD-7", "Hot-Star Style Chicken (mock)", "brand", "TW", ["fried_chicken", "street_food", "night_market", "youth"], 0.6, ["雞排", "fried chicken", "street food"]),
  e("TW-BRD-8", "Mountain Millet Brewers (mock)", "brand", "TW", ["millet_wine", "indigenous", "craft"], 0.08, ["小米酒", "millet wine"], undefined, true),

  // Japan: artists
  e("JP-ART-1", "Kenshi Yonezu", "artist", "JP", ["jpop", "youth", "design", "ballad"], 0.95),
  e("JP-ART-2", "Official HIGE DANdism", "artist", "JP", ["jpop", "band", "ballad", "youth"], 0.93),
  e("JP-ART-3", "back number", "artist", "JP", ["jpop", "band", "ballad", "romance", "coming_of_age"], 0.88),
  e("JP-ART-4", "Aimyon", "artist", "JP", ["jpop", "indie", "nostalgia", "romance"], 0.86),
  e("JP-ART-5", "Yogee New Waves", "artist", "JP", ["indie", "city_pop", "band", "nostalgia"], 0.6),
  e("JP-ART-6", "Mr.Children", "artist", "JP", ["jpop", "rock", "band", "nostalgia", "coming_of_age"], 0.9),
  e("JP-ART-7", "YOASOBI", "artist", "JP", ["jpop", "anime", "youth"], 0.96),
  e("JP-ART-8", "Tatsuro Yamashita", "artist", "JP", ["city_pop", "nostalgia", "rnb"], 0.8),
  // Japan: movies / TV
  e("JP-MOV-1", "Linda Linda Linda", "movie", "JP", ["music_film", "band", "coming_of_age", "youth"], 0.6),
  e("JP-MOV-2", "Your Name.", "movie", "JP", ["anime", "romance", "youth", "nostalgia"], 0.97),
  e("JP-MOV-3", "Little Forest", "movie", "JP", ["food_drama", "slice_of_life", "comfort_food", "healthy"], 0.55),
  e("JP-MOV-4", "Our Little Sister", "movie", "JP", ["family", "seaside", "slice_of_life", "nostalgia"], 0.65),
  e("JP-MOV-5", "Swing Girls", "movie", "JP", ["music_film", "band", "coming_of_age", "youth"], 0.58),
  e("JP-TV-1", "Midnight Diner", "tv_show", "JP", ["food_drama", "comfort_food", "slice_of_life", "nostalgia"], 0.75),
  e("JP-TV-2", "Solitary Gourmet", "tv_show", "JP", ["food_drama", "street_food", "comfort_food", "noodles"], 0.8),
  e("JP-TV-3", "Orange Days", "tv_show", "JP", ["romance", "youth", "coming_of_age", "music_film"], 0.6),
  // Japan: brands
  e("JP-BRD-1", "MUJI", "brand", "JP", ["minimalist", "lifestyle", "design", "select_shop"], 0.95),
  e("JP-BRD-2", "Afternoon Tea LIVING", "brand", "JP", ["lifestyle", "tea", "design", "dessert"], 0.6),
  e("JP-BRD-3", "Lupicia", "brand", "JP", ["tea", "premium", "souvenir", "craft"], 0.65),
  e("JP-BRD-4", "Kaldi Coffee Farm", "brand", "JP", ["cafe", "souvenir", "lifestyle"], 0.7),
  e("JP-BRD-5", "BEAMS", "brand", "JP", ["select_shop", "design", "vintage", "youth"], 0.75),
  e("JP-BRD-6", "Ippodo Tea", "brand", "JP", ["tea", "premium", "craft", "healthy"], 0.55),
  e("JP-BRD-7", "Yoshimiya Karaage (mock)", "brand", "JP", ["fried_chicken", "street_food", "comfort_food"], 0.4),
  e("JP-BRD-8", "Kobe Fugetsudo", "brand", "JP", ["bakery", "souvenir", "dessert", "premium"], 0.6),

  // Japan: places (approximate coordinates)
  e("JP-PLC-1", "Dotonbori", "place", "JP", ["street_food", "night_market", "fried_chicken", "youth"], 0.98, [], ["Osaka", 34.6687, 135.5013, "Dotonbori, Chuo Ward, Osaka"]),
  e("JP-PLC-2", "Kuromon Ichiba Market", "place", "JP", ["street_food", "comfort_food", "souvenir"], 0.9, [], ["Osaka", 34.6654, 135.5066, "Nipponbashi, Chuo Ward, Osaka"]),
  e("JP-PLC-3", "Nakazakicho Cafe Street", "place", "JP", ["cafe", "vintage", "select_shop", "craft", "dessert"], 0.65, [], ["Osaka", 34.7068, 135.5050, "Nakazakicho, Kita Ward, Osaka"]),
  e("JP-PLC-4", "Amerikamura", "place", "JP", ["youth", "vintage", "select_shop", "bubble_tea"], 0.8, [], ["Osaka", 34.6723, 135.4983, "Nishishinsaibashi, Chuo Ward, Osaka"]),
  e("JP-PLC-5", "Shinsekai", "place", "JP", ["street_food", "nostalgia", "fried_chicken"], 0.85, [], ["Osaka", 34.6525, 135.5063, "Ebisuhigashi, Naniwa Ward, Osaka"]),
  e("JP-PLC-6", "Tenjinbashisuji Shopping Street", "place", "JP", ["street_food", "nostalgia", "comfort_food", "noodles"], 0.75, [], ["Osaka", 34.7010, 135.5120, "Tenjinbashi, Kita Ward, Osaka"]),
  e("JP-PLC-7", "Kitahama Retro (tea room)", "place", "JP", ["tea", "dessert", "nostalgia", "premium"], 0.55, [], ["Osaka", 34.6900, 135.5070, "Kitahama, Chuo Ward, Osaka"]),
  e("JP-PLC-8", "Umeda Chaya-machi", "place", "JP", ["design", "lifestyle", "select_shop", "cafe"], 0.7, [], ["Osaka", 34.7075, 135.4985, "Chayamachi, Kita Ward, Osaka"]),
  e("JP-PLC-9", "Shinsaibashi Bubble Tea Stand (mock)", "place", "JP", ["bubble_tea", "tea", "youth", "dessert"], 0.6, [], ["Osaka", 34.6750, 135.5010, "Shinsaibashi, Chuo Ward, Osaka"]),
  e("JP-PLC-10", "Tsuruhashi Koreatown", "place", "JP", ["street_food", "night_market", "comfort_food"], 0.6, [], ["Osaka", 34.6650, 135.5310, "Tsuruhashi, Ikuno Ward, Osaka"]),
  e("JP-PLC-11", "Osaka Noodle Counter (mock)", "place", "JP", ["noodles", "comfort_food"], 0.5, [], ["Osaka", 34.6960, 135.4950, "Fukushima, Osaka"]),
  e("JP-PLC-12", "Horie Design Street", "place", "JP", ["design", "minimalist", "select_shop", "lifestyle", "craft"], 0.6, [], ["Osaka", 34.6740, 135.4930, "Horie, Nishi Ward, Osaka"]),
  e("JP-PLC-13", "Shimokitazawa", "place", "JP", ["vintage", "indie", "select_shop", "youth", "cafe"], 0.85, [], ["Tokyo", 35.6616, 139.6680]),
  e("JP-PLC-14", "Harajuku Takeshita Street", "place", "JP", ["youth", "bubble_tea", "dessert", "street_food"], 0.95, [], ["Tokyo", 35.6712, 139.7050]),
  e("JP-PLC-15", "Kiyosumi-Shirakawa Cafes", "place", "JP", ["cafe", "minimalist", "design", "craft"], 0.6, [], ["Tokyo", 35.6810, 139.7990]),
  e("JP-PLC-16", "Ameyoko Market", "place", "JP", ["street_food", "night_market", "souvenir"], 0.85, [], ["Tokyo", 35.7100, 139.7745]),
  e("JP-PLC-17", "Daikanyama T-Site", "place", "JP", ["design", "lifestyle", "select_shop", "minimalist"], 0.7, [], ["Tokyo", 35.6490, 139.6990]),
  e("JP-PLC-18", "Nishiki Market", "place", "JP", ["street_food", "souvenir", "craft", "tea"], 0.9, [], ["Kyoto", 35.0050, 135.7649]),
  e("JP-PLC-19", "Uji Tea Street", "place", "JP", ["tea", "premium", "craft", "healthy", "souvenir"], 0.75, [], ["Kyoto", 34.8890, 135.8070]),
  e("JP-PLC-20", "Kyoto Okazaki Design Hub (mock)", "place", "JP", ["design", "craft", "minimalist"], 0.4, [], ["Kyoto", 35.0130, 135.7820]),
  e("JP-PLC-21", "Nakasu Yatai Stalls", "place", "JP", ["street_food", "night_market", "noodles", "comfort_food"], 0.85, [], ["Fukuoka", 33.5925, 130.4060]),
  e("JP-PLC-22", "Tenjin Underground Mall", "place", "JP", ["youth", "bubble_tea", "lifestyle"], 0.7, [], ["Fukuoka", 33.5895, 130.3990]),
  e("JP-PLC-23", "Daimyo Select Shops", "place", "JP", ["select_shop", "vintage", "design"], 0.55, [], ["Fukuoka", 33.5870, 130.3940]),
  e("JP-PLC-24", "Nijo Market", "place", "JP", ["street_food", "souvenir"], 0.7, [], ["Sapporo", 43.0590, 141.3580]),
  e("JP-PLC-25", "Osu Shopping District", "place", "JP", ["street_food", "vintage", "youth", "bubble_tea"], 0.7, [], ["Nagoya", 35.1590, 136.9030]),
];

const byId = new Map(MOCK_ENTITIES.map(x => [x.id, x]));

const tagObj = (k: string) => ({ id: `urn:tag:keyword:mock:${k}`, name: MOCK_TAGS[k] ?? k, type: "urn:tag:keyword:mock" });
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const list = (v: Params[string]) => (Array.isArray(v) ? v : typeof v === "string" && v ? v.split(",") : []).map(s => String(s).trim()).filter(Boolean);

function toRaw(x: M, affinity?: number) {
  return {
    entity_id: x.id, name: x.name, type: "urn:entity", subtype: x.subtype, popularity: x.pop,
    properties: { ...(x.address ? { address: x.address } : {}), ...(x.city ? { geocode: { city: x.city, country_code: x.region === "JP" ? "JP" : x.region } } : {}), akas: x.akas.map(value => ({ value })) },
    ...(x.lat !== undefined ? { location: { lat: x.lat, lon: x.lon } } : {}),
    tags: x.tags.map(tagObj),
    ...(affinity !== undefined ? { query: { affinity } } : {}),
    _mock: true,
  };
}

function affinity(seedTags: Set<string>, x: M) {
  if (!seedTags.size) return x.pop * 0.6;
  const overlap = x.tags.filter(t => seedTags.has(t)).length;
  return r3(Math.min(0.99, (overlap / Math.sqrt(x.tags.length * seedTags.size)) * 1.1 + x.pop * 0.15));
}

function distKm(a: [number, number], b: [number, number]) {
  const dLat = (a[0] - b[0]) * 111, dLon = (a[1] - b[1]) * 111 * Math.cos((a[0] * Math.PI) / 180);
  return Math.hypot(dLat, dLon);
}

function insights(params: Params) {
  const type = String(params["filter.type"] ?? "");
  const seeds = list(params["signal.interests.entities"]).map(id => byId.get(id)).filter((x): x is M => !!x);
  const seedTags = new Set(seeds.flatMap(s => s.tags));
  const sparse = seeds.length > 0 && seeds.every(s => s.sparse);

  if (type === "urn:demographics") {
    const young = ["youth", "anime", "bubble_tea", "dessert", "fried_chicken", "street_food", "indie"];
    const old = ["nostalgia", "premium", "craft", "healthy", "oolong", "family", "ballad"];
    return { success: true, duration: 0.01, results: { demographics: seeds.filter(s => !s.sparse).map(s => {
      const y = s.tags.filter(t => young.includes(t)).length, o = s.tags.filter(t => old.includes(t)).length, d = (y - o) / Math.max(1, s.tags.length);
      const fem = s.tags.some(t => ["dessert", "cafe", "lifestyle", "design", "romance", "tea"].includes(t)) ? 0.18 : -0.06;
      return { entity_id: s.id, query: {
        age: { "24_and_younger": r3(0.35 * d + 0.05), "25_to_29": r3(0.25 * d + 0.12), "30_to_34": r3(0.08), "35_to_44": r3(-0.15 * d), "45_to_54": r3(-0.3 * d - 0.05), "55_and_older": r3(-0.4 * d - 0.1) },
        gender: { female: r3(fem), male: r3(-fem) },
      } };
    }) } };
  }

  if (type === "urn:heatmap") {
    const city = Object.keys(CITY_CENTERS).find(c => String(params["filter.location.query"] ?? "").toLowerCase().includes(c.toLowerCase())) ?? "Osaka";
    const [clat, clon] = CITY_CENTERS[city];
    const places = MOCK_ENTITIES.filter(x => x.city === city && x.lat !== undefined).map(x => ({ x, a: affinity(seedTags, x) }));
    const heatmap = [];
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
      const p: [number, number] = [clat + i * 0.008, clon + j * 0.01];
      const a = sparse ? 0 : Math.max(0, ...places.map(({ x, a }) => a * Math.exp(-distKm(p, [x.lat!, x.lon!]) / 0.9)));
      if (a > 0.05) heatmap.push({ location: { latitude: r3(p[0]), longitude: r3(p[1]), geohash: `mock${i + 3}${j + 3}` }, query: { affinity: r3(a), affinity_rank: 0, popularity: 0 } });
    }
    return { success: true, duration: 0.01, results: { heatmap } };
  }

  let pool = MOCK_ENTITIES.filter(x => x.subtype === type && !seeds.includes(x));
  const country = params["filter.geocode.country_code"], city = params["filter.geocode.name"];
  const filterTags = list(params["filter.tags"]);
  const mockTags = filterTags.filter(t => t.startsWith("urn:tag:keyword:mock:")).map(t => t.slice("urn:tag:keyword:mock:".length));
  const jpTaste = String(params["signal.location.query"] ?? "").match(/japan|osaka|tokyo|kyoto/i) || params["filter.release_country"] === "Japan" || filterTags.some(t => /japan/i.test(t));
  if (country || jpTaste) pool = pool.filter(x => x.region === (country ?? "JP"));
  if (city) pool = pool.filter(x => x.city === city);
  if (mockTags.length) pool = pool.filter(x => x.tags.some(t => mockTags.includes(t)));
  if (params["filter.location"]) {
    const loc = String(params["filter.location"]);
    const wkt = loc.match(/POINT\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i);
    const [lat, lon] = wkt ? [Number(wkt[2]), Number(wkt[1])] : loc.split(",").map(Number);
    const radiusKm = Number(params["filter.location.radius"] ?? 10000) / 1000;
    pool = pool.filter(x => x.lat !== undefined && distKm([lat, lon], [x.lat, x.lon!]) <= radiusKm);
  }
  let scored = pool.map(x => ({ x, a: affinity(seedTags, x) })).filter(s => s.a > 0.2).sort((a, b) => b.a - a.a);
  if (!seeds.length && mockTags.length) scored = pool.map(x => ({ x, a: x.pop })).sort((a, b) => b.a - a.a);
  if (sparse) scored = scored.filter(s => s.x.tags.filter(t => seedTags.has(t)).length >= 2).slice(0, 1);
  const take = Number(params.take ?? 20);
  return { success: true, duration: 0.01, results: { entities: scored.slice(0, take).map(s => toRaw(s.x, s.a)) } };
}

export function mockGet(p: string, params: Params): any {
  if (p === "/search") {
    const q = String(params.query ?? "").toLowerCase().trim();
    const types = list(params.types);
    const hits = MOCK_ENTITIES.filter(x => (!types.length || types.includes(x.subtype)) && q &&
      [x.name, ...x.akas, ...x.tags.map(t => MOCK_TAGS[t])].some(s => s.toLowerCase().includes(q) || (q.length >= 4 && s.length >= 5 && q.includes(s.toLowerCase()))));
    return { success: true, duration: 0.01, results: hits.slice(0, Number(params.take ?? 10)).map(x => toRaw(x)) };
  }
  if (p === "/v2/insights") return insights(params);
  if (p === "/v2/tags") {
    const q = String(params["filter.query"] ?? "").toLowerCase();
    const tags = Object.keys(MOCK_TAGS).filter(k => q && (MOCK_TAGS[k].toLowerCase().includes(q) || k.includes(q))).slice(0, Number(params.take ?? 20))
      .map(k => ({ tag_id: `urn:tag:keyword:mock:${k}`, name: MOCK_TAGS[k], subtype: "urn:tag:category:place:mock" }));
    return { success: true, duration: 0.01, results: { tags } };
  }
  if (p === "/v2/analysis/compare") {
    const a = new Set(list(params["a.signal.interests.entities"]).flatMap(id => byId.get(id)?.tags ?? []));
    const b = list(params["b.signal.interests.entities"]).flatMap(id => byId.get(id)?.tags ?? []);
    return { success: true, duration: 0.01, results: [...new Set(b.filter(t => a.has(t)))].map(k => ({ tag_id: `urn:tag:keyword:mock:${k}`, name: MOCK_TAGS[k] })) };
  }
  if (p === "/entities") {
    return { success: true, duration: 0.01, results: list(params.entity_ids).map(id => byId.get(id)).filter((x): x is M => !!x).map(x => toRaw(x)) };
  }
  return { success: false, results: [] };
}
