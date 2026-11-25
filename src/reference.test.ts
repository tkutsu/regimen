import { describe, expect, it, vi } from "vitest";
import type { Food } from "./domain/types";
import { copiedFrom, useReference } from "./reference";
import { searchFoods } from "./domain/search";

const setFoods = vi.hoisted(() => vi.fn());
vi.mock("react", () => ({
  useEffect: (effect: () => void) => effect(),
  useState: () => [[], setFoods],
}));

const food = (note: string, basis: Food["basis"] = "100g"): Food => ({ id: "kiwi", name: "kiwi", basis, group: "", fav: false, note, kcal: 61 });

describe("copiedFrom", () => {
  it("reads the source line of a note, wherever it is", () => {
    expect(copiedFrom(food("source: USDA FDC 168153"))).toBe("usda-168153");
    expect(copiedFrom(food("150g per apple\nsource: CIQUAL 27031 (Gilthead seabream, roasted/baked)"))).toBe("ciqual-27031");
    expect(copiedFrom(food("source: Open Food Facts 5201182023053\nunsaturated fat estimate"))).toBe("off-5201182023053");
  });

  it("ignores notes that only borrow from a source", () => {
    expect(copiedFrom(food("sugar source: Open Food Facts 5059319024592"))).toBeUndefined();
    expect(copiedFrom(food("source: Vlaha label (Open Food Facts 5201418000094)"))).toBeUndefined();
    expect(copiedFrom(food("source: sheet note on white wine"))).toBeUndefined();
    expect(copiedFrom(food(""))).toBeUndefined();
  });

  it("leaves the row pickable when the food is per item", () => {
    expect(copiedFrom(food("source: USDA FDC 174915", "item"))).toBeUndefined();
  });
});

it("loads variant notes and searchable aliases while preserving source identity and unknown nutrients", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({
    sources: {},
    foods: [["usda", "1", "Pasta, dry", "Pasta", 350, 12, null],
            ["usda", "2", "Rice, dry", "Rice", 360, 7]],
    notes: { "usda-1": "Pasta shapes: fusilli, penne, orzo." },
    keywords: { "usda-1": ["fusilli", "penne", "orzo"] },
  }) }));
  try {
    useReference();
    await vi.waitFor(() => expect(setFoods).toHaveBeenCalledOnce());
    const foods = setFoods.mock.calls[0][0] as Food[];
    expect(foods[0].note).toBe("source: USDA FDC 1\nPasta shapes: fusilli, penne, orzo.");
    expect(foods[1].note).toBe("source: USDA FDC 2");
    expect(copiedFrom(foods[0])).toBe("usda-1");
    expect(foods[0].fiber).toBeUndefined();
    expect(searchFoods(foods, "orzo").map(food => food.id)).toEqual(["usda-1"]);
  } finally {
    vi.unstubAllGlobals();
  }
});
