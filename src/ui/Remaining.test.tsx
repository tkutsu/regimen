import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { type Intake, targets } from "../domain/day";
import { zero } from "../domain/nutrition";
import { fold } from "../domain/state";
import { Remaining } from "./Remaining";

describe("daily sugar display", () => {
  const complete: Intake = { ...zero(), sugar: 5, sugarIncomplete: false };
  const target = targets(fold([]), "2026-10-31");
  const render = (eaten: Intake, planned: Intake) => renderToStaticMarkup(<Remaining target={target} eaten={eaten} planned={planned} onShow={() => {}} />);

  it("labels the known subtotal when either eaten or planned sugar is incomplete", () => {
    const incomplete = { ...complete, sugarIncomplete: true };
    for (const html of [render(incomplete, complete), render(complete, incomplete)]) {
      expect(html).toContain("at least 10");
      expect(html).toContain("Sugar total is incomplete.");
    }
  });

  it("leaves complete totals unqualified", () => {
    const html = render(complete, complete);
    expect(html).not.toContain("at least");
    expect(html).not.toContain("Sugar total is incomplete.");
  });
});
