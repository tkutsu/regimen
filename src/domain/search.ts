import type { State } from "./state";
import type { Food } from "./types";

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * Foods whose name contains every word of the query. Favourites come first, then
 * names where the words are whole words or start one (so "egg" ranks "egg, whole"
 * over "eggplant"), then shorter names, which tend to be the plain version of a food.
 */
export function searchFoods(foods: Iterable<Food>, query: string, limit = 50): Food[] {
  const words = normalize(query).split(/[\s,]+/).filter(Boolean);
  if (!words.length) return [];
  const scored: { food: Food; score: number }[] = [];
  for (const food of foods) {
    const name = normalize(food.name);
    if (!words.every((word) => name.includes(word))) continue;
    const count = (pattern: (word: string) => string) => words.filter((word) => new RegExp(pattern(escape(word))).test(name)).length;
    const wholeWords = count((word) => `(^|[^a-z0-9])${word}($|[^a-z0-9])`);
    const wordStarts = count((word) => `(^|[^a-z0-9])${word}`);
    const leads = name.startsWith(words[0]) ? 1 : 0;
    const score = Number(food.fav) * 100 + wholeWords * 10 + wordStarts * 10 + leads * 5 - name.length / 100;
    scored.push({ food, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ food }) => food);
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Foods eaten or planned most recently, newest first, without repeats. */
export function recentFoodIds(state: State, limit = 15): string[] {
  const entries = [...state.entries.values()].sort((a, b) => b.date.localeCompare(a.date));
  return [...new Set(entries.map((entry) => entry.foodId))].slice(0, limit);
}
