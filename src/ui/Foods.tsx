import { useMemo, useState } from "react";
import { unknownNutrients } from "../domain/nutrition";
import { searchFoods } from "../domain/search";
import type { State } from "../domain/state";
import type { Change, Food } from "../domain/types";
import { FoodEditor } from "./FoodEditor";

type Props = { state: State; commit: (...changes: Change[]) => void };

/** Your foods: favourites, then by group, or search results while typing. */
export function Foods({ state, commit }: Props) {
  const [query, setQuery] = useState("");
  const [onlyUnknown, setOnlyUnknown] = useState(false);
  const [editing, setEditing] = useState<Food | "new">();

  const foods = useMemo(() => [...state.foods.values()], [state.foods]);
  const incomplete = useMemo(() => foods.filter((food) => unknownNutrients(food).length), [foods]);
  const groups = useMemo(() => [...new Set(foods.map((food) => food.group).filter(Boolean))].sort(), [foods]);
  const uses = useMemo(() => usage(state), [state]);
  const sections = useMemo((): [string, Food[]][] => {
    const shown = onlyUnknown ? incomplete : foods;
    return query.trim() ? [["", searchFoods(shown, query, 200)]] : byGroup(shown);
  }, [foods, incomplete, onlyUnknown, query]);

  const close = () => setEditing(undefined);
  const food = editing === "new" ? undefined : editing;

  return (
    <div className="flex flex-col gap-3 pb-24">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${foods.length} foods`}
        className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent"
      />
      {incomplete.length > 0 && (
        <button
          onClick={() => setOnlyUnknown(!onlyUnknown)}
          aria-pressed={onlyUnknown}
          className={`self-start rounded-full border px-3 py-1 text-sm ${onlyUnknown ? "border-accent text-accent" : "border-line text-muted"}`}
        >
          {incomplete.length} with unknown values
        </button>
      )}

      {sections.map(
        ([title, list]) =>
          list.length > 0 && (
            <section key={title}>
              {title && <h2 className="mb-1 px-1 text-xs font-medium tracking-wide text-muted uppercase">{title}</h2>}
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                {list.map((food) => (
                  <li key={food.id}>
                    <FoodRow food={food} onPick={() => setEditing(food)} />
                  </li>
                ))}
              </ul>
            </section>
          ),
      )}
      {query.trim() && !sections[0][1].length && <p className="py-6 text-center text-sm text-muted">No foods match “{query.trim()}”</p>}

      <button
        onClick={() => setEditing("new")}
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 mx-auto max-w-md rounded-2xl bg-accent py-3.5 font-medium text-bg shadow-lg"
      >
        New food
      </button>
      {editing && (
        <FoodEditor
          food={food}
          groups={groups}
          uses={food ? (uses.get(food.id) ?? 0) : 0}
          onSave={(saved) => {
            commit({ type: "food.upsert", food: saved });
            close();
          }}
          onDelete={() => {
            if (food) commit({ type: "food.delete", foodId: food.id });
            close();
          }}
          onClose={close}
        />
      )}
    </div>
  );
}

function FoodRow({ food, onPick }: { food: Food; onPick: () => void }) {
  const unknown = unknownNutrients(food);
  return (
    <button onClick={onPick} className="flex w-full items-baseline gap-2 px-4 py-2.5 text-left">
      {food.fav && <span className="text-accent">★</span>}
      <span className="min-w-0 flex-1 truncate">{food.name}</span>
      {unknown.length > 0 && (
        <span title={`unknown: ${unknown.join(", ")}`} className="text-xs text-muted">
          ?
        </span>
      )}
      <span className="w-20 shrink-0 text-right text-sm text-muted">
        {Math.round(food.kcal)}
        <span className="text-xs"> /{food.basis === "item" ? "item" : "100g"}</span>
      </span>
    </button>
  );
}

/** Favourites on their own, then the rest by group, each sorted by name. */
function byGroup(foods: Food[]): [string, Food[]][] {
  const sorted = [...foods].sort((a, b) => a.name.localeCompare(b.name));
  const groups = new Map<string, Food[]>();
  for (const food of sorted) {
    if (food.fav) continue;
    const group = food.group || "other";
    groups.set(group, [...(groups.get(group) ?? []), food]);
  }
  return [["favourites", sorted.filter((food) => food.fav)], ...[...groups].sort(([a], [b]) => a.localeCompare(b))];
}

/** How many entries and recipe ingredients point at each food. */
function usage(state: State): Map<string, number> {
  const counts = new Map<string, number>();
  const count = (foodId: string) => counts.set(foodId, (counts.get(foodId) ?? 0) + 1);
  for (const entry of state.entries.values()) count(entry.foodId);
  for (const recipe of state.recipes.values()) recipe.ingredients.forEach((ingredient) => count(ingredient.foodId));
  return counts;
}
