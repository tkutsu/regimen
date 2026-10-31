import { useEffect, useState } from "react";
import { NUTRIENTS } from "./domain/nutrition";
import type { Food } from "./domain/types";

type Row = [source: string, id: string, name: string, group: string, kcal: number, ...values: (number | null)[]];
type Data = { sources: Record<string, string>; foods: Row[] };

const LABELS: Record<string, string> = { usda: "USDA FDC", ciqual: "CIQUAL", off: "Open Food Facts" };

let loading: Promise<Food[]> | undefined;

/** The bundled reference tables (public/reference.json), loaded once on first search. */
function loadReference(): Promise<Food[]> {
  loading ??= fetch("/reference.json")
    .then((response) => response.json() as Promise<Data>)
    .then((data) =>
      data.foods.map(([source, id, name, group, kcal, ...values]): Food => {
        const note = `source: ${LABELS[source] ?? source} ${id}`;
        const food: Food = { id: `${source}-${id}`, name, basis: "100g", group, fav: false, note, kcal };
        // null (no value in the source) stays unknown rather than becoming 0
        NUTRIENTS.slice(1).forEach((key, i) => values[i] != null && (food[key] = values[i]!));
        return food;
      }),
    );
  return loading;
}

export function useReference(enabled: boolean): Food[] {
  const [foods, setFoods] = useState<Food[]>([]);
  useEffect(() => {
    if (enabled) loadReference().then(setFoods, () => setFoods([]));
  }, [enabled]);
  return foods;
}

export const sourceOf = (food: Food) => LABELS[food.id.split("-")[0]];
