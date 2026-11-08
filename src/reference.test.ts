import { describe, expect, it } from "vitest";
import type { Food } from "./domain/types";
import { copiedFrom } from "./reference";

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
