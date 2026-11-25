import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { type Intake, targets } from "../domain/day";
import { zero } from "../domain/nutrition";
import { fold } from "../domain/state";
import { Remaining } from "./Remaining";

describe("incomplete totals", () => {
  const complete: Intake = { ...zero(), sugar: 5, incomplete: [] };
  const target = targets(fold([]), "2026-10-31");
  const render = (eaten: Intake, planned: Intake) => renderToStaticMarkup(<Remaining target={target} eaten={eaten} planned={planned} onShow={() => {}} />);

  it("labels the known subtotal when either eaten or planned food lacks a value", () => {
    const incomplete: Intake = { ...complete, incomplete: ["sugar"] };
    for (const html of [render(incomplete, complete), render(complete, incomplete)]) {
      expect(html).toContain("≥ 10 /");
      expect(html).toContain("no sugar value, so that total may");
    }
  });

  it("names every incomplete nutrient", () => {
    const html = render({ ...complete, incomplete: ["prot"] }, { ...complete, incomplete: ["sugar"] });
    expect(html.match(/≥ \d/g)).toHaveLength(2);
    expect(html).toContain("no protein or sugar value, so those totals may");
  });

  it("leaves complete totals unqualified", () => {
    const html = render(complete, complete);
    expect(html).not.toContain("≥");
  });
});
