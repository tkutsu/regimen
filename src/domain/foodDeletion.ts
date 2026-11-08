import type { State } from "./state";
import type { Change } from "./types";

/** Hides a food from lists and pickers; everything that used it keeps counting by its values. */
export function deleteFood(state: State, foodId: string): Change[] {
  const food = state.foods.get(foodId);
  return food ? [{ type: "food.upsert", food: { ...food, archived: true } }] : [];
}
