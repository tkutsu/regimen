import { useEffect, useState } from "react";
import { NUTRIENTS } from "./domain/nutrition";
import type { Food } from "./domain/types";

type Row = [source: string, id: string, name: string, group: string, kcal: number, ...values: (number | null)[]];
type Data = { sources: Record<string, string>; foods: Row[]; estimatedUnsatFat?: string[]; generics?: string[]; keywords?: Record<string, string[]> };

const LABELS: Record<string, string> = { usda: "USDA FDC", ciqual: "CIQUAL", off: "Open Food Facts" };

/** Rows standing for a whole type of food. Kept off Food, so copying a row doesn't save it. */
export const genericIds = new Set<string>();

let loading: Promise<Food[]> | undefined;

/** The bundled reference tables (public/reference.json), loaded once on first search. */
function loadReference(): Promise<Food[]> {
  loading ??= fetch(`${import.meta.env.BASE_URL}reference.json`)
    .then((response) => response.json() as Promise<Data>)
    .then((data) => {
      const estimates = new Set(data.estimatedUnsatFat);
      data.generics?.forEach((id) => genericIds.add(id));
      return data.foods.map(([source, id, name, group, kcal, ...values]): Food => {
        const note = `source: ${LABELS[source] ?? source} ${id}` +
          (estimates.has(`${source}-${id}`) ? "\nunsaturated fat estimate: total fat minus saturated fat" : "");
        const food: Food = { id: `${source}-${id}`, name, basis: "100g", group, fav: false, note, kcal };
        if (data.keywords?.[food.id]?.length) food.keywords = data.keywords[food.id];
        // null (no value in the source) stays unknown rather than becoming 0
        NUTRIENTS.slice(1).forEach((key, i) => values[i] != null && (food[key] = values[i]!));
        return food;
      });
    });
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

/**
 * The reference food a saved food copies, from the "source: USDA FDC 168153" line of its note.
 * A per-item food only starts from the row, so that row stays pickable per 100 g.
 */
export function copiedFrom(food: Food): string | undefined {
  if (food.basis !== "100g") return undefined;
  const line = food.note.match(/^source: (.+?) (\d+)\b/m);
  const source = line && Object.keys(LABELS).find((key) => LABELS[key] === line[1]);
  return source ? `${source}-${line[2]}` : undefined;
}
