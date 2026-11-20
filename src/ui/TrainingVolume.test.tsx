import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fold } from "../domain/state";
import { TrainingVolume } from "./TrainingVolume";

afterEach(() => vi.useRealTimers());

describe("training volume average controls", () => {
  it("offers 1w, 2w and 4w averages", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T12:00:00Z"));
    const state = fold([]);
    state.sessions.set("s", {
      id: "s", date: "2026-11-20", name: "Bench", finished: true,
      sets: [{ exerciseId: "bench", reps: 10, kg: 70, done: true }],
    });
    const html = renderToStaticMarkup(<TrainingVolume state={state} />);
    const weeks = [...html.matchAll(/>(\d+w)<\/button>/g)].map((match) => match[1]);
    expect(weeks).toEqual(["1w", "2w", "4w"]);
  });
});
