import { useMemo, useState } from "react";
import { parseAmount, scale } from "../domain/nutrition";
import type { Container, Food, Variant } from "../domain/types";

type Props = {
  foods: Map<string, Food>;
  containers: Container[];
  onAdd: (food: Food, amount: number, done: boolean, variant?: Variant) => void;
  onClose: () => void;
};

/** Search-as-you-type over all foods; favourites first. */
export function FoodPicker({ foods, containers, onAdd, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Food>();

  const matches = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return [...foods.values()]
      .filter((food) => words.every((word) => food.name.toLowerCase().includes(word)))
      .sort((a, b) => Number(b.fav) - Number(a.fav) || a.name.localeCompare(b.name));
  }, [foods, query]);

  return (
    <div className="fixed inset-0 z-10 flex flex-col bg-bg">
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
        <button onClick={onClose} className="px-2 py-2 text-muted">
          Cancel
        </button>
      </header>
      {picked ? (
        <Amount
          food={picked}
          containers={containers}
          onBack={() => setPicked(undefined)}
          onAdd={(amount, done, variant) => onAdd(picked, amount, done, variant)}
        />
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {matches.map((food) => (
            <li key={food.id}>
              <button onClick={() => setPicked(food)} className="flex w-full items-baseline gap-2 border-b border-line px-4 py-3 text-left">
                {food.fav && <span className="text-accent">★</span>}
                <span className="flex-1">{food.name}</span>
                <span className="text-xs text-muted">
                  {Math.round(food.kcal)} kcal / {food.basis === "item" ? "item" : "100 g"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type AmountProps = {
  food: Food;
  containers: Container[];
  onBack: () => void;
  onAdd: (amount: number, done: boolean, variant?: Variant) => void;
};

function Amount({ food, containers, onBack, onAdd }: AmountProps) {
  const item = food.basis === "item";
  const [text, setText] = useState(item ? "1" : "100");
  const [variant, setVariant] = useState<Variant>();
  const [containerId, setContainerId] = useState("");

  const container = containers.find((c) => c.id === containerId);
  const weighed = parseAmount(text);
  const amount = weighed === undefined ? 0 : Math.max(0, weighed - (container?.grams ?? 0));
  const kcal = scale(food, amount, variant?.factor).kcal;
  const submit = (done: boolean) => amount > 0 && onAdd(amount, done, variant);

  return (
    <div className="flex flex-col gap-4 p-4">
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
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => e.key === "Enter" && submit(true)}
          className="w-28 rounded-xl border border-line bg-surface px-3 py-2 text-right text-lg outline-none focus:border-accent"
        />
        <span className="text-muted">{item ? "×" : "g"}</span>
        <span className="ml-auto text-muted">{Math.round(kcal)} kcal</span>
      </label>

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

      <div className="grid grid-cols-2 gap-2">
        <button disabled={!amount} onClick={() => submit(false)} className="rounded-xl border border-line py-3 disabled:opacity-40">
          Plan
        </button>
        <button disabled={!amount} onClick={() => submit(true)} className="rounded-xl bg-accent py-3 font-medium text-bg disabled:opacity-40">
          Eaten
        </button>
      </div>
    </div>
  );
}
