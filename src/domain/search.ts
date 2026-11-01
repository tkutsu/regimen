import type { State } from "./state";
import type { Food } from "./types";

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/ς/g, "σ");

// Names repeat across searches (19k reference foods on every keystroke), so split each once.
type Name = { text: string; words: string[] };
const names = new Map<string, Name>();
const parse = (name: string): Name => {
  let result = names.get(name);
  if (!result) {
    const text = normalize(name);
    names.set(name, (result = { text, words: text.split(/[^\p{L}\p{N}]+/u) }));
  }
  return result;
};

/**
 * Foods whose name or keywords match every word of the query, in any order. A word matches
 * anywhere in the name or, from four letters on, the start of a name's word with
 * a typo past the first letter (two typos from seven letters). Favourites come
 * first, then foods used recently, then names where the words are whole words or
 * start one (so "egg" ranks "egg, whole" over "eggplant"), then shorter names,
 * which tend to be the plain version of a food. Typos cost rank.
 *
 * `recent` lists food ids, most recently used first.
 */
export function searchFoods(foods: Iterable<Food>, query: string, limit = 50, recent: string[] = []): Food[] {
  const words = normalize(query).split(/[\s,]+/).filter(Boolean).map(matcher);
  if (!words.length) return [];
  const recency = new Map(recent.map((id, rank) => [id, 30 / (1 + rank / 3)]));
  const scored: { food: Food; score: number }[] = [];
  for (const food of foods) {
    const name = parse(food.name);
    const candidates = [name, ...(food.keywords ?? []).map(parse)];
    let score = Number(food.fav) * 100 + (recency.get(food.id) ?? 0) - name.text.length / 100;
    if (candidates.some((candidate) => candidate.text.startsWith(words[0].word))) score += 5;
    for (const word of words) {
      const points = Math.max(...candidates.map((candidate) => word.score(candidate) ?? -Infinity));
      if (points === -Infinity) {
        score = -Infinity;
        break;
      }
      score += points;
    }
    if (score > -Infinity) scored.push({ food, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ food }) => food);
}

/** Points for how well one query word matches a name, or undefined when it doesn't. */
function matcher(word: string) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const whole = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "u");
  const start = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}`, "u");
  const typos = word.length >= 7 ? 2 : word.length >= 4 ? 1 : 0;
  return {
    word,
    score({ text, words }: Name): number | undefined {
      if (text.includes(word)) return whole.test(text) ? 20 : start.test(text) ? 10 : 0;
      let fewest = Infinity;
      if (typos) for (const token of words) if (token[0] === word[0]) fewest = Math.min(fewest, prefixDistance(word, token, typos));
      return fewest <= typos ? -5 * fewest : undefined;
    },
  };
}

/**
 * Fewest edits (a letter added, dropped, changed, or two swapped) that turn `word`
 * into the start of `token`; anything over `max` comes back as Infinity.
 */
function prefixDistance(word: string, token: string, max: number): number {
  let before: number[] = [];
  let above = Array.from({ length: token.length + 1 }, (_, j) => j);
  let fewest = 0;
  for (let i = 1; i <= word.length; i++) {
    const row = [i];
    fewest = i;
    for (let j = 1; j <= token.length; j++) {
      const change = word[i - 1] === token[j - 1] ? 0 : 1;
      row[j] = Math.min(above[j] + 1, row[j - 1] + 1, above[j - 1] + change);
      if (i > 1 && j > 1 && word[i - 1] === token[j - 2] && word[i - 2] === token[j - 1]) row[j] = Math.min(row[j], before[j - 2] + 1);
      fewest = Math.min(fewest, row[j]);
    }
    if (fewest > max) return Infinity;
    [before, above] = [above, row];
  }
  return fewest;
}

/** Foods eaten or planned, most recent first, without repeats. */
export function recentFoodIds(state: State): string[] {
  const entries = [...state.entries.values()].sort((a, b) => b.date.localeCompare(a.date));
  return [...new Set(entries.map((entry) => entry.foodId))];
}
