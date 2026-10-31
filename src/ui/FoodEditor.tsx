import { useState } from "react";
import { fromForm, readValue, toForm, type FoodForm } from "../domain/foodForm";
import { LABELS, NUTRIENTS } from "../domain/nutrition";
import { newId } from "../domain/state";
import type { Food } from "../domain/types";

type Props = {
  food?: Food;
  groups: string[];
  /** Entries and recipe ingredients that use the food. */
  uses: number;
  onSave: (food: Food) => void;
  onDelete: () => void;
  onClose: () => void;
};

export const box = "rounded-xl border bg-surface px-3 py-2 outline-none focus:border-accent";
const border = (text: string) => (Number.isNaN(readValue(text)) ? "border-bad" : "border-line");

/** Edits a food, or creates one when none is given. Nothing is written until Save. */
export function FoodEditor({ food, groups, uses, onSave, onDelete, onClose }: Props) {
  const [id] = useState(() => food?.id ?? newId());
  const [form, setForm] = useState(() => toForm(food));
  const [confirming, setConfirming] = useState(false);
  const saved = fromForm(form, id);
  const patch = (changes: Partial<FoodForm>) => setForm({ ...form, ...changes });
  const setVariant = (i: number, changes: Partial<FoodForm["variants"][number]>) =>
    patch({ variants: form.variants.map((v, j) => (i === j ? { ...v, ...changes } : v)) });

  return (
    <div className="fixed inset-0 z-10 flex flex-col bg-bg">
      <header className="flex items-center justify-between border-b border-line p-3">
        <button onClick={onClose} className="px-2 py-2 text-muted">
          Cancel
        </button>
        <h2 className="font-medium">{food ? "Edit food" : "New food"}</h2>
        <button disabled={!saved} onClick={() => saved && onSave(saved)} className="px-2 py-2 font-medium text-accent disabled:opacity-40">
          Save
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-md flex-col gap-5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2">
            <input
              autoFocus={!food}
              value={form.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Name"
              className={`${box} min-w-0 flex-1 border-line text-lg`}
            />
            <button
              onClick={() => patch({ fav: !form.fav })}
              aria-label="Favourite"
              aria-pressed={form.fav}
              className={`px-1 text-2xl ${form.fav ? "text-accent" : "text-line"}`}
            >
              ★
            </button>
          </div>

          <div className="flex gap-2">
            <input
              list="food-groups"
              value={form.group}
              onChange={(e) => patch({ group: e.target.value })}
              placeholder="Group"
              className={`${box} min-w-0 flex-1 border-line`}
            />
            <datalist id="food-groups">
              {groups.map((group) => (
                <option key={group} value={group} />
              ))}
            </datalist>
            <div className="flex gap-1 rounded-xl bg-line/50 p-1 text-sm">
              {(["100g", "item"] as const).map((basis) => (
                <button
                  key={basis}
                  onClick={() => patch({ basis })}
                  className={`rounded-lg px-3 ${form.basis === basis ? "bg-surface font-medium shadow-sm" : "text-muted"}`}
                >
                  {basis === "item" ? "per item" : "per 100 g"}
                </button>
              ))}
            </div>
          </div>

          <section>
            <Heading hint="blank = unknown">{form.basis === "item" ? "Per item" : "Per 100 g"}</Heading>
            <div className="grid grid-cols-2 gap-2">
              {NUTRIENTS.map((key) => (
                <label key={key} className={`${box} ${border(form.values[key])}`}>
                  <span className="block text-xs text-muted">
                    {LABELS[key]}
                    {key !== "kcal" && " (g)"}
                  </span>
                  <input
                    inputMode="decimal"
                    value={form.values[key]}
                    onChange={(e) => patch({ values: { ...form.values, [key]: e.target.value } })}
                    placeholder={key === "kcal" ? "required" : "?"}
                    className="w-full bg-transparent text-lg outline-none placeholder:text-muted/50"
                  />
                </label>
              ))}
            </div>
            {food && uses > 0 && <p className="mt-2 text-xs text-muted">Changes also apply to past days that use it.</p>}
          </section>

          <section>
            <Heading hint="grams × factor = the values above">Variants</Heading>
            <div className="flex flex-col gap-2">
              {form.variants.map((variant, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={variant.name}
                    onChange={(e) => setVariant(i, { name: e.target.value })}
                    placeholder="raw"
                    className={`${box} min-w-0 flex-1 border-line`}
                  />
                  <span className="text-muted">×</span>
                  <input
                    inputMode="decimal"
                    value={variant.factor}
                    onChange={(e) => setVariant(i, { factor: e.target.value })}
                    placeholder="2.4"
                    className={`${box} w-20 text-right ${border(variant.factor)}`}
                  />
                  <button
                    onClick={() => patch({ variants: form.variants.filter((_, j) => j !== i) })}
                    aria-label="Remove variant"
                    className="px-1 text-muted"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button onClick={() => patch({ variants: [...form.variants, { name: "", factor: "" }] })} className="self-start text-sm text-accent">
                + Add variant
              </button>
            </div>
          </section>

          <section>
            <Heading>Note</Heading>
            <textarea
              value={form.note}
              onChange={(e) => patch({ note: e.target.value })}
              rows={3}
              className={`${box} w-full resize-y border-line text-sm`}
            />
          </section>

          {food &&
            (uses > 0 ? (
              <p className="text-center text-sm text-muted">
                Used {uses} {uses === 1 ? "time" : "times"} in your log or recipes, so it can't be deleted.
              </p>
            ) : (
              <button onClick={() => (confirming ? onDelete() : setConfirming(true))} className="rounded-xl border border-line py-3 text-bad">
                {confirming ? "Tap again to delete" : "Delete food"}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

export function Heading({ hint, children }: { hint?: string; children: React.ReactNode }) {
  return (
    <h3 className="mb-2 flex justify-between px-1 text-xs text-muted">
      <span className="font-medium tracking-wide uppercase">{children}</span>
      {hint}
    </h3>
  );
}
