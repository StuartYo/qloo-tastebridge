import { describe, expect, test } from "vitest";
import { displayName, englishName, isJapaneseCulture, rankPlaces } from "./culture";
import type { Entity } from "./types";

const e = (name: string, description?: string, tags: string[] = []): Entity => ({ id: name, name, kind: "artist", description, tags: tags.map(t => ({ id: t, name: t })) });

describe("display names", () => {
  test("English name first, original script in brackets", () => {
    expect(displayName(e("中島美嘉", "Mika Nakashima is a Japanese singer and actress."))).toBe("Mika Nakashima (中島美嘉)");
    expect(displayName(e("小池徹平", "小池徹平 (Koike Teppei) is a Japanese singer and actor."))).toBe("Koike Teppei (小池徹平)");
    expect(displayName(e("山下智久", "山下智久 (Tomohisa Yamashita), also known as Yamapi, is a Japanese singer."))).toBe("Tomohisa Yamashita (山下智久)");
  });
  test("names already in Latin script, or without an English name, are unchanged", () => {
    expect(displayName(e("Last Letter", "Last Letter (2020) is a Japanese film."))).toBe("Last Letter");
    expect(englishName(e("陳建騏", "陳建騏 is a Mandopop singer."))).toBeUndefined();
    expect(displayName(e("大塚愛"))).toBe("大塚愛");
  });
});

describe("Japanese culture filter", () => {
  test("drops acts Qloo describes as from another country", () => {
    expect(isJapaneseCulture(e("東方神起", "Tohoshinki, also known as TVXQ, is a South Korean pop duo. It became hugely popular in Japan."))).toBe(false);
    expect(isJapaneseCulture(e("宇宙人", "宇宙人 (Cosmos People) is a Taiwanese indie pop band."))).toBe(false);
    expect(isJapaneseCulture(e("陳建騏", "陳建騏 is a Mandopop singer and songwriter."))).toBe(false);
  });
  test("keeps Japanese acts, mixed origins that include Japanese, and entities without a description", () => {
    expect(isJapaneseCulture(e("中島美嘉", "Mika Nakashima is a Japanese singer."))).toBe(true);
    expect(isJapaneseCulture(e("宇多田ヒカル", "Utada Hikaru is a Japanese-American singer-songwriter."))).toBe(true);
    expect(isJapaneseCulture(e("Spy x Family", "Spy x Family (2022) is an animated action-comedy series."))).toBe(true);
    expect(isJapaneseCulture(e("X"))).toBe(true);
  });
});

describe("Taste Bridge place ranking", () => {
  const seed = e("周杰倫", "Taiwanese singer", ["Taiwanese", "Pop"]);
  test("tag overlap first, generic or foreign-themed venues last, Qloo order otherwise", () => {
    const places = [e("The Australian Pub", "", ["Pub culture"]), e("Dragon", "", ["Beer"]), e("Nippombashi Station", "", ["Subway station"]), e("Taiwan Kitchen", "", ["Taiwanese"]), e("Pokémon Center Osaka", "", ["Shopping", "American express"])];
    expect(rankPlaces(places, [seed]).map(p => p.name)).toEqual(["Taiwan Kitchen", "Dragon", "Pokémon Center Osaka", "The Australian Pub", "Nippombashi Station"]);
  });
});
