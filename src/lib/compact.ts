// Responses carry only what the UI shows: Qloo entities can have dozens of tags and long descriptions,
// which made one analysis ~700 KB. Trimmed before anything is sent to the browser or cached.
import type { Entity } from "./types";

const MAX_TAGS = 8;
const MAX_DESC = 240;

export function compactEntity(x: Entity): Entity {
  return { ...x, tags: x.tags.slice(0, MAX_TAGS), description: x.description && x.description.length > MAX_DESC ? x.description.slice(0, MAX_DESC - 1) + "…" : x.description };
}

const isEntity = (v: any): v is Entity => v && typeof v === "object" && typeof v.id === "string" && typeof v.name === "string" && Array.isArray(v.tags);

/** Deep-copies a report, trimming every entity it contains. */
export function compactDeep<T>(v: T): T {
  if (Array.isArray(v)) return v.map(compactDeep) as T;
  if (isEntity(v)) return compactEntity(v) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, compactDeep(x)])) as T;
  return v;
}
