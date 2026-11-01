import { useMemo, useState } from "react";
import { LABELS, NUTRIENTS, parseAmount, recipeAsFood, recipeTotals, scale } from "../domain/nutrition";
import { fromRecipeForm, toRecipeForm, type RecipeForm } from "../domain/recipeForm";
import type { Container, Food, Recipe } from "../domain/types";
import { box, Heading, ValueFields } from "./FoodEditor";
import { FoodPicker } from "./FoodPicker";

type Props = {
  recipe: Recipe;
  /** The recipe is already saved, not a draft. */
  saved: boolean;
  /** This draft is the next batch of that recipe. */
  replaces?: Recipe;
  foods: Map<string, Food>;
  /** Most recently used first. */
  recentIds: string[];
  containers: Container[];
  /** Entries and staples that use this recipe. */
  uses: number;
  /** `added` are reference foods picked as ingredients, to become yours with the recipe. */
  onSave: (recipe: Recipe, added: Food[]) => void;
  onNewBatch: () => void;
  onDelete: () => void;
  onToggleFav: (food: Food) => void;
  onClose: () => void;
};

/**
 * Ingredients by raw weight; the weighed total minus its container gives the values per 100 g.
 * Without ingredients, the values are written by hand.
 */
export function RecipeEditor(props: Props) {
  const { recipe, saved, replaces, recentIds, containers, uses, onSave, onNewBatch, onDelete, onToggleFav, onClose } = props;
  const [form, setForm] = useState(() => toRecipeForm(recipe));
  const [picking, setPicking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Reference foods picked so far count as yours until the recipe is saved or dropped.
  const [picked, setPicked] = useState<Food[]>([]);
  const foods = useMemo(() => new Map([...props.foods, ...picked.map((food): [string, Food] => [food.id, food])]), [props.foods, picked]);
  const result = fromRecipeForm(form, recipe.id, foods);
  const patch = (changes: Partial<RecipeForm>) => setForm({ ...form, ...changes });
  const setAmount = (i: number, amount: string) => patch({ ingredients: form.ingredients.map((ing, j) => (i === j ? { ...ing, amount } : ing)) });

  // values as typed so far, even while the form isn't valid yet
  const draft: Recipe = {
    ...recipe,
    ingredients: form.ingredients.map(({ foodId, amount }) => ({ foodId, amount: parseAmount(amount) ?? 0 })),
    totalG: parseAmount(form.totalG) ?? 0,
    containerG: form.containerG,
  };
  const totals = recipeTotals(draft, foods);
  const per100 = recipeAsFood(draft, foods);
  const save = (recipe: Recipe) => onSave(recipe, picked.filter((food) => recipe.ingredients.some((i) => i.foodId === food.id)));
  const byHand = !form.ingredients.length;
  const presets = containers.some((c) => c.grams === form.containerG) || !form.containerG ? containers : [...containers, { id: "other", name: "other", grams: form.containerG }];

  return (
    <div role="dialog" aria-modal="true" aria-label="Recipe" className="fixed inset-0 z-10 flex flex-col bg-bg">
      <header className="flex items-center justify-between border-b border-line p-3">
        <button onClick={onClose} className="px-2 py-2 text-muted">
          Cancel
        </button>
        <h2 className="font-medium">{replaces ? "New batch" : saved ? "Edit recipe" : "New recipe"}</h2>
        <button disabled={!result} onClick={() => result && save(result)} className="px-2 py-2 font-medium text-accent disabled:opacity-40">
          Save
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-md flex-col gap-5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <input
            autoFocus={!saved && !replaces}
            value={form.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Name"
            className={`${box} border-line text-lg`}
          />

          <section>
            <Heading hint="raw weights">Ingredients</Heading>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {form.ingredients.map((ingredient, i) => {
                const food = foods.get(ingredient.foodId);
                const amount = parseAmount(ingredient.amount);
                return (
                  <li key={`${ingredient.foodId}-${i}`} className="flex items-center gap-2 py-1.5 pr-2 pl-4">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{food?.name ?? "missing food"}</span>
                      {food && amount ? <span className="block text-xs text-muted">{Math.round(scale(food, amount).kcal)} kcal</span> : null}
                    </span>
                    <input
                      autoFocus={!ingredient.amount}
                      inputMode="decimal"
                      value={ingredient.amount}
                      onChange={(e) => setAmount(i, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className={`w-20 rounded-lg border bg-bg px-2 py-1 text-right outline-none focus:border-accent ${amount ? "border-line" : "border-bad"}`}
                    />
                    <span className="w-3 text-sm text-muted">{food?.basis === "item" ? "×" : "g"}</span>
                    <button
                      onClick={() => patch({ ingredients: form.ingredients.filter((_, j) => j !== i) })}
                      aria-label="Remove ingredient"
                      className="px-1 text-muted"
                    >
                      ×
                    </button>
                  </li>
                );
              })}
              <li>
                <button onClick={() => setPicking(true)} className="w-full px-4 py-2.5 text-left text-accent">
                  + Add ingredient
                </button>
              </li>
            </ul>
          </section>

          {byHand ? (
            <section>
              <Heading hint="by hand, until it has ingredients">Per 100 g</Heading>
              <ValueFields values={form.values} onChange={(values) => patch({ values })} />
            </section>
          ) : (
            <>
              <section>
                <Heading hint="weigh it all when it's done">Cooked</Heading>
                <div className="flex items-center gap-2">
                  <label className={`${box} w-28 shrink-0 ${parseAmount(form.totalG) === undefined && form.totalG.trim() ? "border-bad" : "border-line"}`}>
                    <span className="block text-xs text-muted">total (g)</span>
                    <input
                      inputMode="decimal"
                      value={form.totalG}
                      onChange={(e) => patch({ totalG: e.target.value })}
                      placeholder="not yet"
                      className="w-full bg-transparent text-lg outline-none placeholder:text-muted/50"
                    />
                  </label>
                  <span className="text-muted">−</span>
                  <select
                    value={form.containerG}
                    onChange={(e) => patch({ containerG: Number(e.target.value) })}
                    className="min-w-0 flex-1 self-stretch rounded-xl border border-line bg-surface px-2 text-fg"
                  >
                    <option value={0}>no container</option>
                    {presets.map((c) => (
                      <option key={c.id} value={c.grams}>
                        {c.name} · {c.grams} g
                      </option>
                    ))}
                  </select>
                </div>
                {totals.weighed ? (
                  <p className="mt-2 px-1 text-sm text-muted">
                    = {Math.round(totals.cookedG)} g cooked from {Math.round(totals.rawG)} g raw (×{(totals.cookedG / totals.rawG).toFixed(2)})
                  </p>
                ) : totals.rawG ? (
                  <p className="mt-2 px-1 text-sm text-muted">Until it's weighed, values use the raw weight.</p>
                ) : (
                  <p className="mt-2 px-1 text-sm text-bad">Its ingredients are counted by the item, so weigh it to get values per 100 g.</p>
                )}
                {draft.totalG > 0 && draft.totalG <= form.containerG && <p className="mt-1 px-1 text-sm text-bad">The total weighs less than its container.</p>}
              </section>

              <section className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-semibold">
                    {Math.round(per100.kcal)}
                    <span className="text-base font-normal text-muted"> kcal / 100 g</span>
                  </span>
                  <span className="text-sm text-muted">batch {Math.round(totals.total.kcal)} kcal</span>
                </div>
                <dl className="mt-2 grid grid-cols-3 gap-x-4 gap-y-1 text-sm">
                  {NUTRIENTS.slice(1).map((key) => (
                    <div key={key} className="flex justify-between">
                      <dt className="text-muted">{LABELS[key]}</dt>
                      <dd>{(per100[key] ?? 0).toFixed(key === "salt" ? 2 : 1)}g</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </>
          )}

          <section>
            <Heading>Note</Heading>
            <textarea
              value={form.note}
              onChange={(e) => patch({ note: e.target.value })}
              rows={3}
              className={`${box} w-full resize-y border-line text-sm`}
            />
          </section>

          {saved && uses > 0 && (
            <section className="flex flex-col gap-2">
              <button onClick={onNewBatch} className="rounded-xl border border-line py-3 text-accent">
                New batch
              </button>
              <p className="px-1 text-xs text-muted">
                Cooking it again? A new batch starts from these ingredients, and the days that ate this one keep its values. Saving here
                instead changes them too.
              </p>
            </section>
          )}

          {saved &&
            (uses > 0 ? null : (
              <button onClick={() => (confirming ? onDelete() : setConfirming(true))} className="rounded-xl border border-line py-3 text-bad">
                {confirming ? "Tap again to delete" : "Delete recipe"}
              </button>
            ))}
        </div>
      </div>
      {picking && (
        <FoodPicker
          foods={props.foods}
          recentIds={recentIds}
          containers={containers}
          addLabel="Add ingredient"
          variants={false}
          onAdd={(food, amount) => {
            if (!props.foods.has(food.id) && !picked.some((p) => p.id === food.id)) setPicked([...picked, food]);
            patch({ ingredients: [...form.ingredients, { foodId: food.id, amount: String(Math.round(amount * 10) / 10) }] });
            setPicking(false);
          }}
          onToggleFav={onToggleFav}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
