import { useMemo, useState } from "react";
import type { Food } from "../domain/types";

type Props = {
  foods: Map<string, Food>;
  onAdd: (food: Food, amount: number, done: boolean) => void;
  onClose: () => void;
};

/** Search-as-you-type over all foods; favourites first. */
export function FoodPicker({ foods, onAdd, onClose }: Props) {
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
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search foods"
          className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent"
        />
        <button onClick={onClose} className="px-2 py-2 text-muted">
          Cancel
        </button>
      </header>
      {picked ? (
        <Amount food={picked} onBack={() => setPicked(undefined)} onAdd={(amount, done) => onAdd(picked, amount, done)} />
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

function Amount({ food, onBack, onAdd }: { food: Food; onBack: () => void; onAdd: (amount: number, done: boolean) => void }) {
  const item = food.basis === "item";
  const [text, setText] = useState(item ? "1" : "100");
  const amount = Number(text.replace(",", "."));
  const valid = amount > 0;
  const kcal = valid ? food.kcal * (item ? amount : amount / 100) : 0;

  return (
    <div className="p-4">
      <button onClick={onBack} className="text-sm text-muted">
        ‹ back
      </button>
      <h2 className="mt-2 text-lg font-medium">{food.name}</h2>
      {food.note && <p className="mt-1 whitespace-pre-line text-sm text-muted">{food.note}</p>}
      <label className="mt-4 flex items-center gap-2">
        <input
          autoFocus
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => e.key === "Enter" && valid && onAdd(amount, true)}
          className="w-28 rounded-xl border border-line bg-surface px-3 py-2 text-right text-lg outline-none focus:border-accent"
        />
        <span className="text-muted">{item ? "×" : "g"}</span>
        <span className="ml-auto text-muted">{Math.round(kcal)} kcal</span>
      </label>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button disabled={!valid} onClick={() => onAdd(amount, false)} className="rounded-xl border border-line py-3 disabled:opacity-40">
          Plan
        </button>
        <button disabled={!valid} onClick={() => onAdd(amount, true)} className="rounded-xl bg-accent py-3 font-medium text-bg disabled:opacity-40">
          Eaten
        </button>
      </div>
    </div>
  );
}
