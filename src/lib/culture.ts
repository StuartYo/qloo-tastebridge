// Display and filtering rules for Japan-side results, shared by the agents and the UI.
import type { Entity } from "./types";

const CJK = /[぀-ヿ㐀-鿿]/;
const LATIN_NAME = /^[A-Za-z][A-Za-z .'\-]{1,60}$/;

/** English name for an entity whose Qloo name is in Japanese or Chinese script, taken from Qloo's own
 *  description ("Mika Nakashima is a Japanese singer…" or "小池徹平 (Koike Teppei) is…"). */
export function englishName(x: Pick<Entity, "name" | "description">): string | undefined {
  if (!CJK.test(x.name)) return undefined;
  const d = (x.description ?? "").trim();
  if (!d) return undefined;
  const bracket = d.match(/^\S[^()]{0,40}?\(([^)]{2,60})\)/);
  if (bracket && d.startsWith(x.name)) {
    const en = bracket[1].split(/[,;]/)[0].trim();
    if (LATIN_NAME.test(en)) return en;
  }
  const lead = d.match(/^([A-Za-z][A-Za-z .'\-]{1,60}?)(?:,| is | was | \()/);
  if (lead && LATIN_NAME.test(lead[1].trim())) return lead[1].trim();
  return undefined;
}

/** "Mika Nakashima (中島美嘉)" for names in Japanese/Chinese script, else the Qloo name unchanged. */
export function displayName(x: Pick<Entity, "name" | "description">): string {
  const en = englishName(x);
  return en ? `${en} (${x.name})` : x.name;
}

// Qloo has no nationality field for artists, films or shows, and its Japan pins are genre tags
// ("Japanese", "J-Pop") that also cover Korean and Taiwanese acts popular in Japan. The rule: an entity
// whose Qloo description names another country or language scene, and does not call it Japanese, is
// not shown as Japanese culture. Entities without a description are kept (the Japan filters still apply).
const FOREIGN = /\b(south korean|korean|k-pop|taiwanese|mandopop|cantopop|c-pop|chinese|hong kong|american|british|english|french|thai|filipino|indonesian|vietnamese|australian|canadian)\b/i;
const JAPANESE = /\bjapan(ese)?\b/i;
export function isJapaneseCulture(x: Pick<Entity, "description">): boolean {
  // Only the first sentence says what the entity is; later sentences often add "popular in Japan".
  const first = (x.description ?? "").split(/(?<=[a-z)\]])\.\s/)[0];
  if (!first) return true;
  if (JAPANESE.test(first)) return true;
  return !FOREIGN.test(first);
}

// Taste Bridge places: venues that share Qloo tags with the favourites come first; generic transit and
// lodging, and venues themed on another country (e.g. an Australian pub), sink to the end unless they
// share a tag. Same idea as hiding brand links that share no tags with the favourites.
const GENERIC_PLACE = /\b(station|hotel|hostel|inn|parking|airport)\b/i;
const GENERIC_TAG = /^(hotel|hostel|lodging|subway station|train station|(one|two|three|four|five) star)$/i;
const FOREIGN_THEME = /\b(australian|irish|british|english|american|german|italian|mexican|hawaiian|french|spanish|indian|thai|korean)\b/i;
export function placeOverlap(x: Entity, seeds: Entity[]): string[] {
  const seedTags = new Set(seeds.flatMap(s => s.tags.map(t => t.name.toLowerCase())));
  return x.tags.filter(t => seedTags.has(t.name.toLowerCase())).map(t => t.name);
}
export function isOffTastePlace(x: Entity): boolean {
  // Theme = the name or a cuisine/venue-type tag ("Australian cuisine"), not payment tags like "American express".
  const themed = FOREIGN_THEME.test(x.name) || x.tags.some(t => FOREIGN_THEME.test(t.name) && /(cuisine|restaurant|pub|bar|food)$/i.test(t.name));
  return GENERIC_PLACE.test(x.name) || x.tags.some(t => GENERIC_TAG.test(t.name)) || themed;
}
/** Stable re-rank: tag overlap first, then off-taste venues last; Qloo's affinity order otherwise. */
export function rankPlaces(places: Entity[], seeds: Entity[]): Entity[] {
  const score = (x: Entity) => (placeOverlap(x, seeds).length > 0 ? 0 : isOffTastePlace(x) ? 2 : 1);
  return places.map((x, i) => ({ x, i, s: score(x) })).sort((a, b) => a.s - b.s || a.i - b.i).map(r => r.x);
}
