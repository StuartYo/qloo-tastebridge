import type { BrandInput } from "./types";

// Demo and evaluation brands are fictional; Qloo is queried for real comparable brands as proxies.
export interface BrandScenario extends BrandInput {
  id: string;
  demo?: boolean;
  /** What a careful analyst should conclude; used by the evaluation set. */
  expect: { sufficient: boolean; topCityIn?: string[] };
}

export const BRAND_SCENARIOS: BrandScenario[] = [
  { id: "pearl", demo: true, name: "Formosa Pearl", category: "Bubble tea chain", keywords: ["bubble tea", "milk tea"], description: "Mid-priced Taiwanese bubble tea chain, 60 stores in Taiwan, known for brown-sugar pearl milk tea.", expect: { sufficient: true, topCityIn: ["Osaka", "Tokyo", "Fukuoka"] } },
  { id: "goods", demo: true, name: "Island Goods Co.", category: "Indie lifestyle select shop", keywords: ["gift shop", "home goods store"], description: "Curated Taiwanese design objects, stationery and homeware.", expect: { sufficient: true, topCityIn: ["Osaka", "Tokyo", "Fukuoka"] } },
  { id: "leaf", demo: true, name: "Alishan Leaf", category: "High-mountain oolong tea brand", keywords: ["tea store", "oolong"], description: "Premium loose-leaf oolong and gift boxes.", expect: { sufficient: true, topCityIn: ["Kyoto", "Osaka", "Tokyo"] } },
  { id: "pineapple", name: "Sunny Pineapple Bakery", category: "Pineapple cake bakery", keywords: ["pineapple cake", "bakery"], expect: { sufficient: true } },
  { id: "nightowl", name: "Night Owl Bites", category: "Night-market fried chicken stand", keywords: ["fried chicken", "street food"], expect: { sufficient: true, topCityIn: ["Osaka", "Fukuoka", "Tokyo"] } },
  { id: "harbor", name: "Harbor Indie Records", category: "Taiwanese indie music label", keywords: ["Sunset Rollercoaster", "Mayday"], expect: { sufficient: true } },
  { id: "millet", name: "Millet Spirit", category: "Indigenous millet wine micro-brewery", keywords: ["millet wine"], expect: { sufficient: false } },
  { id: "socks", name: "Qx7 Holo Socks", category: "Holographic smart socks", keywords: ["holographic smart socks"], expect: { sufficient: false } },
];

export const DEMO_BRANDS = BRAND_SCENARIOS.filter(s => s.demo);

export const BRIDGE_EXAMPLES = ["周杰倫", "五月天", "海角七號", "牛肉麵", "周杰倫, 想見你, 夜市"];
