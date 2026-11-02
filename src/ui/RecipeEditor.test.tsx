import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Food, Recipe } from "../domain/types";
import { RecipeEditor } from "./RecipeEditor";

vi.mock("./Dialog", () => ({ Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

const egg: Food = { id: "egg", name: "Egg", basis: "item", group: "", fav: false, note: "", kcal: 70 };
const recipe: Recipe = { id: "r", name: "Egg bites", ingredients: [{ foodId: "egg", amount: 4 }], totalG: 200, containerG: 0 };
const render = (recipe: Recipe, saved = true) => renderToStaticMarkup(
  <RecipeEditor recipe={recipe} saved={saved} foods={new Map([[egg.id, egg]])} recentIds={[]} containers={[]} uses={0}
    onSave={() => {}} onNewBatch={() => {}} onDelete={() => {}} onToggleFav={() => {}} onClose={() => {}} />,
);

describe("recipe basis controls", () => {
  it("defaults existing recipes to grams and offers both units", () => {
    const html = render(recipe);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("per 100 g</button>");
    expect(html).toContain("per item</button>");
    expect(html).toContain("Cooked");
    expect(html).not.toContain('aria-label="Items made"');
  });

  it.each([false, true])("shows item yield and calculated per-item values (saved: %s)", (saved) => {
    const html = render({ ...recipe, basis: "item", items: 2, totalG: 0 }, saved);
    expect(html).toContain('aria-label="Items made"');
    expect(html).toContain('value="2"');
    expect(html).toContain("140<span");
    expect(html).toContain("kcal / item");
    expect(html).not.toContain("total (g)");
    expect(html).not.toContain("weigh it to get values");
    expect(html).not.toContain("disabled=");
  });

  it("labels handwritten values per item without asking for a yield", () => {
    const html = render({ ...recipe, basis: "item", ingredients: [], values: { kcal: 180 } });
    expect(html).toContain("Per item");
    expect(html).not.toContain('aria-label="Items made"');
    expect(html).not.toContain("total (g)");
  });
});
