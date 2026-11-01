import { useMemo, useState } from "react";
import { recipeAsFood, unknownNutrients } from "../domain/nutrition";
import { newBatch } from "../domain/recipeForm";
import { recentFoodIds, searchFoods } from "../domain/search";
import { newId, type State } from "../domain/state";
import type { Change, Food, Recipe } from "../domain/types";
import { FoodEditor } from "./FoodEditor";
import { RecipeEditor } from "./RecipeEditor";

type Props = { state: State; commit: (...changes: Change[]) => void };

/** Your recipes, then your foods: favourites, then by group, or search results while typing. */
export function Foods({ state, commit }: Props) {
  const [query, setQuery] = useState("");
  const [onlyUnknown, setOnlyUnknown] = useState(false);
  const [editing, setEditing] = useState<Food | "new">();
  const [cooking, setCooking] = useState<{ recipe: Recipe; replaces?: Recipe }>();

  const foods = useMemo(() => [...state.foods.values()], [state.foods]);
  const incomplete = useMemo(() => foods.filter((food) => unknownNutrients(food).length), [foods]);
  const groups = useMemo(() => [...new Set(foods.map((food) => food.group).filter(Boolean))].sort(), [foods]);
  const uses = useMemo(() => usage(state), [state]);
  const recent = useMemo(() => recentFoodIds(state), [state]);
  const sections = useMemo((): [string, Food[]][] => {
    const shown = onlyUnknown ? incomplete : foods;
    return query.trim() ? [["", searchFoods(shown, query, 200, recent)]] : byGroup(shown);
  }, [foods, incomplete, onlyUnknown, query, recent]);

  const recipes = useMemo(
    () =>
      [...state.recipes.values()]
        .filter((recipe) => !recipe.archived && recipe.name.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [state.recipes, query],
  );

  const close = () => setEditing(undefined);
  const food = editing === "new" ? undefined : editing;
  const emptyRecipe = (): Recipe => ({ id: newId(), name: "", ingredients: [], totalG: 0, containerG: 0 });

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

      {recipes.length > 0 && (
        <section>
          <h2 className="mb-1 px-1 text-xs font-medium tracking-wide text-muted uppercase">recipes</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {recipes.map((recipe) => (
              <li key={recipe.id}>
                <FoodRow food={recipeAsFood(recipe, state.foods)} onPick={() => setCooking({ recipe })} />
              </li>
            ))}
          </ul>
        </section>
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
      {query.trim() && !sections[0][1].length && !recipes.length && <p className="py-6 text-center text-sm text-muted">No foods match “{query.trim()}”</p>}

      <div className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 mx-auto grid max-w-md grid-cols-2 gap-2">
        <button onClick={() => setCooking({ recipe: emptyRecipe() })} className="rounded-2xl border border-line bg-surface py-3.5 font-medium shadow-lg">
          New recipe
        </button>
        <button onClick={() => setEditing("new")} className="rounded-2xl bg-accent py-3.5 font-medium text-bg shadow-lg">
          New food
        </button>
      </div>
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
      {cooking && (
        <RecipeEditor
          key={cooking.recipe.id}
          recipe={cooking.recipe}
          saved={state.recipes.has(cooking.recipe.id)}
          replaces={cooking.replaces}
          foods={state.foods}
          recentIds={recent}
          containers={state.settings.containers}
          uses={uses.get(cooking.recipe.id) ?? 0}
          onSave={(recipe) => {
            const old = cooking.replaces;
            commit(...(old ? [{ type: "recipe.upsert" as const, recipe: { ...old, archived: true } }] : []), { type: "recipe.upsert", recipe });
            setCooking(undefined);
          }}
          onNewBatch={() => setCooking({ recipe: newBatch(cooking.recipe, newId()), replaces: cooking.recipe })}
          onDelete={() => {
            commit({ type: "recipe.delete", recipeId: cooking.recipe.id });
            setCooking(undefined);
          }}
          onClose={() => setCooking(undefined)}
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
      <span className="shrink-0 text-right text-sm text-muted">
        {Math.round(food.kcal)}
        <span className="text-xs"> kcal/{food.basis === "item" ? "item" : "100g"}</span>
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
