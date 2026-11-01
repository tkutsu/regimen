import type { Targets } from "../domain/day";
import { LABELS } from "../domain/nutrition";
import type { Limited, Nutrients, Range } from "../domain/types";

const LIMITED: Limited[] = ["prot", "fiber", "satFat", "unsatFat", "salt", "sugar"];
const DIGITS: Record<Limited, number> = { prot: 0, fiber: 0, satFat: 1, unsatFat: 0, salt: 1, sugar: 0 };

type Props = { target: Targets; eaten: Nutrients; planned: Nutrients };

/** What's left of the day. Numbers count planned food too; the bars show it paler, after what's eaten. */
export function Remaining({ target, eaten, planned }: Props) {
  const total = eaten.kcal + planned.kcal;
  const left = target.kcal - total;
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <span className={`text-4xl font-semibold ${left < 0 ? "text-bad" : ""}`}>{Math.round(left)}</span>
        <span className="text-sm text-muted">
          {Math.round(total)} / {Math.round(target.kcal)}
        </span>
      </div>
      <Bar eaten={eaten.kcal} planned={planned.kcal} range={{ max: target.kcal }} />
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
        {LIMITED.map((key) => (
          <Macro key={key} name={key} range={target[key]} eaten={eaten[key]} planned={planned[key]} />
        ))}
      </dl>
    </section>
  );
}

/** Over the max is bad; under the min still has some to go; past a min with no max is good. */
function status(total: number, { min, max }: Range, unit: (n: number) => string) {
  if (max !== undefined && total > max) return { text: `${unit(total - max)} over`, tone: "text-bad" };
  if (min !== undefined && total < min) return { text: `${unit(min - total)} to go`, tone: "" };
  if (max !== undefined) return { text: `${unit(max - total)} left`, tone: min !== undefined ? "text-good" : "" };
  if (min !== undefined) return { text: `${unit(total - min)} over`, tone: "text-good" };
  return { text: "no limit", tone: "text-muted" };
}

function Macro({ name, range, eaten, planned }: { name: Limited; range: Range; eaten: number; planned: number }) {
  const g = (n: number) => `${n.toFixed(DIGITS[name])}g`;
  const total = eaten + planned;
  const { min, max } = range;
  const bounds = [min, max].filter((n) => n !== undefined).map((n) => n.toFixed(DIGITS[name]));
  const { text, tone } = status(total, range, g);
  return (
    <div>
      <dt className="flex justify-between text-xs text-muted">
        <span>{LABELS[name]}</span>
        <span>
          {total.toFixed(DIGITS[name])}
          {bounds.length > 0 && ` / ${bounds.join("–")}`}g
        </span>
      </dt>
      <dd className={`text-sm font-medium ${tone}`}>{text}</dd>
      <Bar eaten={eaten} planned={planned} range={range} />
    </div>
  );
}

/** Eaten, then planned in a paler shade, against the max (or the min when there's no max). A tick marks a min below the max. */
function Bar({ eaten, planned, range: { min, max } }: { eaten: number; planned: number; range: Range }) {
  const scale = max ?? min ?? 0;
  const total = eaten + planned;
  const color = max !== undefined && total > max ? "bg-bad" : max === undefined && min !== undefined && total >= min ? "bg-good" : "bg-accent";
  const width = (n: number) => `${scale > 0 ? Math.min(n / scale, 1) * 100 : 0}%`;
  return (
    <div className="relative mt-1 h-1 overflow-hidden rounded-full bg-line">
      <div className="flex h-full" style={{ width: width(total) }}>
        <div className={`h-full ${color}`} style={{ width: total ? `${(eaten / total) * 100}%` : 0 }} />
        <div className={`h-full flex-1 ${color} opacity-40`} />
      </div>
      {min !== undefined && max !== undefined && max > 0 && (
        <div className="absolute inset-y-0 w-0.5 bg-fg/50" style={{ left: `${Math.min(min / max, 1) * 100}%` }} />
      )}
    </div>
  );
}
