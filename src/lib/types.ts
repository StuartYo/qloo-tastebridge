export const ENTITY_TYPES = ["artist", "book", "brand", "destination", "movie", "person", "place", "podcast", "tv_show", "video_game"] as const;
export type EntityKind = (typeof ENTITY_TYPES)[number];
export const urn = (k: EntityKind) => `urn:entity:${k}`;

export type Params = Record<string, string | number | boolean | string[] | undefined>;

export interface Tag { id: string; name: string }

/** Normalized Qloo entity: only the fields the app uses. */
export interface Entity {
  id: string;
  name: string;
  kind: string;
  affinity?: number;
  popularity?: number;
  tags: Tag[];
  lat?: number;
  lon?: number;
  city?: string;
  country?: string;
  address?: string;
  description?: string;
}

export type QlooMode = "live" | "snapshot" | "mock";
export type Confidence = "high" | "medium" | "low" | "insufficient";
export type Sufficiency = "ok" | "thin" | "insufficient";

/** One Qloo call the agent made, kept as citable evidence. */
export interface Evidence {
  id: string;
  tool: string;
  endpoint: string;
  params: Params;
  summary: string;
  count: number;
  items: Entity[];
  /** Who asked for this call: the model ("agent"), the coverage check that fills skipped steps, or the rules fallback. */
  origin?: "agent" | "coverage" | "rules";
}

export interface Recommendation {
  title: string;
  detail: string;
  evidence: string[];
  confidence: Confidence;
  /** Why code lowered the level below what the evidence counts alone would give. */
  confidenceNote?: string;
}

export interface AudienceProfile {
  age: Record<string, number>;
  gender: Record<string, number>;
}

export interface CityFit { name: string; lat: number; lon: number; score: number; count: number; evidence: string }

export interface CityView { city: string; places: Entity[]; heatmap: HeatPoint[]; evidence: string[] }

export interface HeatPoint { lat: number; lon: number; affinity: number }

export interface BrandInput {
  name: string;
  category: string;
  description?: string;
  keywords?: string[];
}

export interface BrandReport {
  kind: "brand";
  input: BrandInput;
  qlooMode: QlooMode;
  llm: "claude" | "rules";
  summary: string;
  sufficiency: Sufficiency;
  seeds: Entity[];
  audience: AudienceProfile | null;
  neighbors: Partial<Record<EntityKind, Entity[]>>;
  cities: CityFit[];
  /** "category": cities scored on same-category venues; "overall": on all places (general taste affinity). */
  cityScope?: "category" | "overall";
  /** Qloo category tag names used for category-specific city scoring. */
  cityCategory?: string[];
  topCity: CityFit | null;
  places: Entity[];
  /** City the places and heatmap belong to (the agent may look at more than the top-ranked city). */
  placesCity?: string;
  /** Every city the agent looked at in detail (top-ranked first). */
  cityViews?: CityView[];
  heatmap: HeatPoint[];
  sharedThemes: string[];
  recommendations: Recommendation[];
  evidence: Evidence[];
  /** Citations the model gave to evidence IDs that don't exist (dropped by code). */
  droppedCitations: number;
  /** Why Claude was not used, when it wasn't. */
  llmNote?: string;
}

export interface BridgePick { entity: Entity; why: string; evidence: string[] }

export interface BridgeReport {
  kind: "bridge";
  input: string;
  qlooMode: QlooMode;
  llm: "claude" | "rules";
  summary: string;
  sufficiency: Sufficiency;
  seeds: Entity[];
  unmatched: string[];
  picks: Partial<Record<EntityKind, BridgePick[]>>;
  places: BridgePick[];
  /** Brand links Qloo returned that share no tags with the favourites (hidden from the picks). */
  hiddenBrands?: string[];
  evidence: Evidence[];
  /** Who wrote the "why you'd like it" lines. */
  explanations: "claude" | "rules";
  llmNote?: string;
}

export interface PlainAnswer { source: "claude" | "mock"; items: { title: string; detail: string }[] }
