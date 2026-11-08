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
  sugar: 0,
});

const names = (foods: Food[]) => foods.map((f) => f.name);

describe("searchFoods generics", () => {
  const generic = { ...food("Rice, white, dry"), keywords: ["ρύζι"] };
  const brand = food("Ρύζι");

  it("ranks a generic above a same-quality match, however short that name is", () => {
    expect(names(searchFoods([brand, generic], "ρύζι"))).toEqual(["Ρύζι", "Rice, white, dry"]);
    expect(names(searchFoods([brand, generic], "ρύζι", 50, [], new Set([generic.id])))).toEqual(["Rice, white, dry", "Ρύζι"]);
  });

  it("doesn't lift a weaker match over a whole word", () => {
    const longer = food("Eggplant");
    expect(names(searchFoods([longer, food("Egg")], "egg", 50, [], new Set([longer.id])))).toEqual(["Egg", "Eggplant"]);
  });
});

describe("searchFoods", () => {
  it("searches Greek keywords with accents, final sigma and fuzzy typos", () => {
    const chicken = { ...food("Chicken breast"), keywords: ["κοτόπουλο", "στήθος", "poultry"] };
    for (const query of ["κοτοπουλο", "στηθοσ", "κοτοπυολο", "στηθοσ chicken", "poultry κοτοπουλο"]) {
      expect(searchFoods([chicken], query)).toEqual([chicken]);
    }
    expect(searchFoods([chicken], "chiken breast")).toEqual([chicken]);
  });

  it("ranks keywords like names without rewarding repeated aliases", () => {
    const plain = { ...food("Chicken"), keywords: ["κοτόπουλο", "κοτόπουλο"] };
    const soup = { ...food("Chicken soup"), keywords: ["κοτόπουλο"] };
    expect(searchFoods([soup, plain], "κοτοπουλο")).toEqual([plain, soup]);
    expect(searchFoods([plain, { ...soup, fav: true }], "κοτοπουλο")[0].fav).toBe(true);
    expect(searchFoods([plain, soup], "κοτοπουλο", 1, [soup.id])).toEqual([soup]);
  });

  it("uses edited keywords immediately and stops matching removed ones", () => {
    const item = food("Chicken");
    expect(searchFoods([{ ...item, keywords: ["κοτόπουλο"] }], "κοτοπουλο")).toHaveLength(1);
    expect(searchFoods([{ ...item, keywords: ["poultry"] }], "κοτοπουλο")).toEqual([]);
  });

  it("matches every word in any order, ignoring case and accents", () => {
    const foods = [food("Peppers, sweet, red, raw"), food("Pepper, black"), food("Crème fraîche")];
    expect(names(searchFoods(foods, "red pepper"))).toEqual(["Peppers, sweet, red, raw"]);
    expect(names(searchFoods(foods, "creme"))).toEqual(["Crème fraîche"]);
  });

  it("matches Greek without tonos or final-sigma differences", () => {
    const foods = [food("Τραχανάς γλυκός"), food("Γιαούρτι 2%")];
    expect(names(searchFoods(foods, "τραχανασ"))).toEqual(["Τραχανάς γλυκός"]);
    expect(names(searchFoods(foods, "γιαουρτι"))).toEqual(["Γιαούρτι 2%"]);
  });

  it("ranks whole-word starts over substrings, then shorter names", () => {
    const foods = [food("eggplant"), food("egg, whole, raw, fresh"), food("egg")];
    expect(names(searchFoods(foods, "egg"))).toEqual(["egg", "egg, whole, raw, fresh", "eggplant"]);
  });

  it("puts favourites first", () => {
    const foods = [food("oats"), food("overnight oats", true)];
    expect(names(searchFoods(foods, "oats"))[0]).toBe("overnight oats");
  });

  it("forgives a typo from four letters on, two from seven", () => {
    const foods = [food("Chicken breast, roasted"), food("Γιαούρτι 2%"), food("Rice, white")];
    expect(names(searchFoods(foods, "chiken brest"))).toEqual(["Chicken breast, roasted"]);
    expect(names(searchFoods(foods, "chcikne"))).toEqual(["Chicken breast, roasted"]);
    expect(names(searchFoods(foods, "γιαουτρι"))).toEqual(["Γιαούρτι 2%"]);
    expect(names(searchFoods(foods, "ruce"))).toEqual(["Rice, white"]);
    expect(names(searchFoods(foods, "rcie"))).toEqual(["Rice, white"]);
    expect(searchFoods(foods, "rce")).toEqual([]);
    expect(searchFoods(foods, "chkn")).toEqual([]);
  });

  it("ranks exact matches over typos", () => {
    const foods = [food("ricotta"), food("rice")];
    expect(names(searchFoods(foods, "rice"))).toEqual(["rice", "ricotta"]);
  });

  it("ranks recently used foods first, the most recent highest", () => {
    const foods = [food("egg"), food("eggplant"), food("egg noodles")];
    expect(names(searchFoods(foods, "egg", 50, ["egg noodles", "eggplant"]))).toEqual(["egg noodles", "eggplant", "egg"]);
  });

  it("returns nothing for an empty query", () => {
    expect(searchFoods([food("oats")], "  ")).toEqual([]);
  });
});
