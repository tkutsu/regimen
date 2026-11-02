import { useMemo, useState } from "react";
import { LABELS, NUTRIENTS, parseAmount, scale } from "../domain/nutrition";
import { searchFoods } from "../domain/search";
import type { Container, Food, Variant } from "../domain/types";
import { sourceOf, useReference } from "../reference";
import { Dialog, useBack } from "./Dialog";
import { Star } from "./fields";
import { transition } from "./motion";

type Props = {
  foods: Map<string, Food>;
  /** Most recently used first. */
  recentIds: string[];
  containers: Container[];
  onAdd: (food: Food, amount: number, done: boolean, variant?: Variant) => void;
  onToggleFav: (food: Food) => void;
  onClose: () => void;
  /** One button with this label instead of Plan and Eaten. */
  addLabel?: string;
};

/**
 * Favourites and recent foods until you type; then your foods, recent ones first,
 * followed by the bundled reference tables. A reference food is copied into your foods when added.
 */
export function FoodPicker({ foods, recentIds, containers, onAdd, onToggleFav, onClose, addLabel }: Props) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Food>();
  const reference = useReference(true);

  const sections = useMemo((): [string, Food[]][] => {
    if (!query.trim()) {
      const favs = [...foods.values()].filter((food) => food.fav).sort((a, b) => a.name.localeCompare(b.name));
      const recent = recentIds
        .map((id) => foods.get(id))
        .filter((food): food is Food => !!food && !food.fav)
        .slice(0, 15);
      return [
        ["Favourites", favs],
        ["Recent", recent],
      ];
    }
    const unsaved = reference.filter((food) => !foods.has(food.id));
    return [
      ["Your foods", searchFoods(foods.values(), query, 30, recentIds)],
      ["Reference foods", searchFoods(unsaved, query, 40)],
    ];
  }, [foods, recentIds, reference, query]);

  return (
    <Dialog label="Pick a food" onClose={onClose}>
      <header className="flex items-center gap-2 border-b border-line p-3">
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPicked(undefined);
          }}
          placeholder="Search foods"
          className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent"
        />
        <button onClick={() => transition(onClose)} className="px-2 py-2 text-muted">
          Cancel
        </button>
      </header>
      {picked ? (
        <Amount
          food={picked}
          containers={containers}
          addLabel={addLabel}
          onBack={() => setPicked(undefined)}
          onAdd={(amount, done, variant) => onAdd(picked, amount, done, variant)}
        />
      ) : (
        <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          {sections.map(
            ([title, list]) =>
              list.length > 0 && (
                <section key={title}>
                  <h3 className="sticky top-0 bg-bg/95 px-4 pt-4 pb-1 text-xs font-medium tracking-wide text-muted uppercase">{title}</h3>
                  <ul>
                    {list.map((food) => (
                      <li key={food.id}>
                        <FoodRow food={food} onPick={() => setPicked(food)} onToggleFav={foods.has(food.id) ? () => onToggleFav(food) : undefined} />
                      </li>
                    ))}
                  </ul>
                </section>
              ),
          )}
          {query.trim() && sections.every(([, list]) => !list.length) && (
            <p className="px-4 py-6 text-center text-sm text-muted">No foods match “{query.trim()}”</p>
          )}
        </div>
      )}
    </Dialog>
  );
}

/** Your own foods get a star to toggle; reference foods aren't yours to star yet. */
function FoodRow({ food, onPick, onToggleFav }: { food: Food; onPick: () => void; onToggleFav?: () => void }) {
  const source = sourceOf(food);
  return (
    <div className="flex items-baseline border-b border-line">
      {onToggleFav && <Star fav={food.fav} name={food.name} onToggle={onToggleFav} className="py-3 pr-2 pl-4" />}
      <button onClick={onPick} className={`flex min-w-0 flex-1 items-baseline gap-2 py-3 pr-4 text-left ${onToggleFav ? "" : "pl-4"}`}>
        <span className="flex-1">
          {food.name}
          {food.nameNeedsReview && <span className="block text-xs text-accent">Name needs review</span>}
        </span>
        <span className="shrink-0 text-right text-xs text-muted">
          {Math.round(food.kcal)} kcal / {food.basis === "item" ? "item" : "100 g"}
          {source && <span className="block">{source}</span>}
        </span>
      </button>
    </div>
  );
}

/** What the chosen amount contains; "?" where the food's source had no value. */
function Breakdown({ food, amount, factor }: { food: Food; amount: number; factor?: number }) {
  const scaled = scale(food, amount, factor);
  return (
    <dl className="grid grid-cols-3 gap-x-4 gap-y-1 text-sm">
      {NUTRIENTS.slice(1).map((key) => (
        <div key={key} className="flex justify-between">
          <dt className="text-muted">{LABELS[key]}</dt>
          <dd>{food[key] === undefined ? "?" : `${scaled[key].toFixed(key === "salt" ? 2 : 1)}g`}</dd>
        </div>
      ))}
    </dl>
  );
}

type AmountProps = {
  food: Food;
  containers: Container[];
  addLabel?: string;
  onBack: () => void;
  onAdd: (amount: number, done: boolean, variant?: Variant) => void;
};

function Amount({ food, containers, addLabel, onBack, onAdd }: AmountProps) {
  const item = food.basis === "item";
  const [text, setText] = useState(item ? "1" : "100");
  const [variant, setVariant] = useState<Variant>();
  const [containerId, setContainerId] = useState("");

  const container = containers.find((c) => c.id === containerId);
  const weighed = parseAmount(text);
  const amount = weighed === undefined ? 0 : Math.max(0, weighed - (container?.grams ?? 0));
  const kcal = scale(food, amount, variant?.factor).kcal;
  const submit = (done: boolean) => amount > 0 && onAdd(amount, done, variant);
  useBack(onBack);

  return (
    <div className="rise flex flex-col gap-4 p-4">
      <div>
        <button onClick={onBack} className="text-sm text-muted">
          ‹ back
        </button>
        <h2 className="mt-2 text-lg font-medium">{food.name}</h2>
        {food.note && <p className="mt-1 whitespace-pre-line text-sm text-muted">{food.note}</p>}
      </div>

      {food.variants && (
        <div className="flex flex-wrap gap-2 text-sm">
          {[undefined, ...food.variants].map((v) => (
            <button
              key={v?.name ?? ""}
              onClick={() => setVariant(v)}
              aria-pressed={variant === v}
              className={`rounded-full border px-3 py-1 ${variant === v ? "border-accent text-accent" : "border-line text-muted"}`}
            >
              {v ? `${v.name} ×${v.factor}` : "as listed"}
            </button>
          ))}
        </div>
      )}

      <label className="flex items-center gap-2">
        <input
          autoFocus
          inputMode="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => e.key === "Enter" && submit(!addLabel)}
          className="w-28 rounded-xl border border-line bg-surface px-3 py-2 text-right text-lg outline-none focus:border-accent"
        />
        <span className="text-muted">{item ? "×" : "g"}</span>
        <span className="ml-auto text-muted">{Math.round(kcal)} kcal</span>
      </label>
      <Breakdown food={food} amount={amount} factor={variant?.factor} />

      {!item && containers.length > 0 && (
        <label className="flex items-center gap-2 text-sm text-muted">
          weighed in
          <select
            value={containerId}
            onChange={(e) => setContainerId(e.target.value)}
            className="flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-fg"
          >
            <option value="">no container</option>
            {containers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.grams} g
              </option>
            ))}
          </select>
          {container && <span>= {Math.round(amount)} g</span>}
        </label>
      )}

      {addLabel ? (
        <button disabled={!amount} onClick={() => submit(false)} className="rounded-xl bg-accent py-3 font-medium text-bg disabled:opacity-40">
          {addLabel}
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button disabled={!amount} onClick={() => submit(false)} className="rounded-xl border border-line py-3 disabled:opacity-40">
            Plan
          </button>
          <button disabled={!amount} onClick={() => submit(true)} className="rounded-xl bg-accent py-3 font-medium text-bg disabled:opacity-40">
            Eaten
          </button>
        </div>
      )}
    </div>
  );
}
