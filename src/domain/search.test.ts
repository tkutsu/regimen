import { describe, expect, it } from "vitest";
import { searchFoods } from "./search";
import type { Food } from "./types";

const food = (name: string, fav = false): Food => ({
  id: name,
  name,
  basis: "100g",
  group: "",
  fav,
  note: "",
  kcal: 0,
  prot: 0,
  fiber: 0,
  satFat: 0,
  unsatFat: 0,
  salt: 0,
});

const names = (foods: Food[]) => foods.map((f) => f.name);

describe("searchFoods", () => {
  it("matches every word in any order, ignoring case and accents", () => {
    const foods = [food("Peppers, sweet, red, raw"), food("Pepper, black"), food("Crème fraîche")];
    expect(names(searchFoods(foods, "red pepper"))).toEqual(["Peppers, sweet, red, raw"]);
    expect(names(searchFoods(foods, "creme"))).toEqual(["Crème fraîche"]);
  });

  it("ranks whole-word starts over substrings, then shorter names", () => {
    const foods = [food("eggplant"), food("egg, whole, raw, fresh"), food("egg")];
    expect(names(searchFoods(foods, "egg"))).toEqual(["egg", "egg, whole, raw, fresh", "eggplant"]);
  });

  it("puts favourites first", () => {
    const foods = [food("oats"), food("overnight oats", true)];
    expect(names(searchFoods(foods, "oats"))[0]).toBe("overnight oats");
  });

  it("returns nothing for an empty query", () => {
    expect(searchFoods([food("oats")], "  ")).toEqual([]);
  });
});
