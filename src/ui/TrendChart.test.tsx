import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TrendChart } from "./TrendChart";

// Supply a measured width so server rendering includes the real SVG.
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return { ...react, useState: (initial: unknown) => initial === 0 ? [400, vi.fn()] : react.useState(initial) };
});

const render = (points: ComponentProps<typeof TrendChart>["points"], volume = true) => renderToStaticMarkup(
  <TrendChart points={points} bands={[]} averageLabel="average" valueLabel="volume" format={(kg) => `${kg} kg`} volume={volume} />,
);

describe("trend chart averages", () => {
  it("keeps daily points visible without drawing an unavailable average", () => {
    const html = render([{ date: "2026-11-01", kg: 1400 }, { date: "2026-11-02", kg: 0 }]);
    expect(html.match(/ r="2"/g)).toHaveLength(2);
    expect(html).not.toContain("<path");
    expect(html).not.toContain('r="4"');
    expect(html).not.toMatch(/NaN|undefined|Infinity/);
    expect(html).toMatch(/aria-valuetext="[^"]+: 0 kg"/);
  });

  it("starts the line at the first available average and includes zero averages", () => {
    const html = render([
      { date: "2026-11-01", kg: 1400 },
      { date: "2026-11-02", kg: 0, avg: 200 },
      { date: "2026-11-03", kg: 0, avg: 0 },
    ]);
    const path = html.match(/<path d="([^"]+)"/)?.[1];
    expect(path).toMatch(/^M218\.0,[\d.]+L392\.0,[\d.]+$/);
    expect(html).toContain('r="4"');
    expect(html).toContain("avg 0 kg");
    expect(html).not.toMatch(/NaN|undefined|Infinity/);
  });

  it("retains the complete average line for weight points", () => {
    const html = render([{ date: "2026-11-01", kg: 80, avg: 80 }, { date: "2026-11-02", kg: 81, avg: 80.5 }], false);
    expect(html.match(/<path d="([^"]+)"/)?.[1]).toMatch(/^M34\.0,[\d.]+L392\.0,[\d.]+$/);
    expect(html).toContain("avg 80.5 kg");
    expect(html).not.toMatch(/NaN|undefined|Infinity/);
  });
});
