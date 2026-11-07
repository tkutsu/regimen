import { allFoods, countsOf } from "./nutrition";
import type { State } from "./state";
import type { Change, Food } from "./types";

/**
 * Saves a food without changing days before today: an entry there that would count
 * differently, directly or through a recipe, keeps the values it counted by.
 */
export function saveFood(state: State, food: Food, today: string): Change[] {
  const before = allFoods(state);
  const after = allFoods({ ...state, foods: new Map(state.foods).set(food.id, food) });
  const changes: Change[] = [];
  for (const entry of state.entries.values()) {
    const was = before.get(entry.foodId);
    const now = after.get(entry.foodId);
    if (entry.date >= today || entry.frozen || !was || !now) continue;
    const counts = countsOf(was);
    if (JSON.stringify(counts) !== JSON.stringify(countsOf(now))) changes.push({ type: "entry.upsert", entry: { ...entry, frozen: counts } });
  }
  return [...changes, { type: "food.upsert", food }];
}
