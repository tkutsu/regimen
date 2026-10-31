import { useEffect, useState } from "react";
import type { Food } from "./domain/types";

type Row = [source: string, id: string, name: string, group: string, ...values: number[]];
type Data = { sources: Record<string, string>; foods: Row[] };

const LABELS: Record<string, string> = { usda: "USDA FDC", ciqual: "CIQUAL" };

let loading: Promise<Food[]> | undefined;

/** The bundled reference tables (public/reference.json), loaded once on first search. */
function loadReference(): Promise<Food[]> {
  loading ??= fetch("/reference.json")
    .then((response) => response.json() as Promise<Data>)
    .then((data) =>
      data.foods.map(([source, id, name, group, kcal, prot, fiber, satFat, unsatFat, salt]) => ({
        id: `${source}-${id}`,
        name,
        basis: "100g" as const,
        group,
        fav: false,
        note: `source: ${LABELS[source] ?? source} ${id}`,
        kcal,
        prot,
        fiber,
        satFat,
        unsatFat,
        salt,
      })),
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
