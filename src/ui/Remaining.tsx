import type { Intake, Targets } from "../domain/day";
import { LABELS } from "../domain/nutrition";
import type { Limited, Nutrients, Range } from "../domain/types";

const LIMITED: Limited[] = ["prot", "fiber", "satFat", "unsatFat", "salt", "sugar"];
const DIGITS: Record<Limited, number> = { prot: 0, fiber: 0, satFat: 1, unsatFat: 0, salt: 1, sugar: 0 };

type Props = {
  target: Targets;
  eaten: Intake;
  planned: Intake;
  /** The total whose share each food shows, picked by tapping it. */
  shown?: keyof Nutrients;
  onShow: (key: keyof Nutrients) => void;
};

/** What's left of the day. Numbers count planned food too; the bars show it paler, after what's eaten. */
export function Remaining({ target, eaten, planned, shown, onShow }: Props) {
  const total = eaten.kcal + planned.kcal;
  const left = target.kcal - total;
  const sugarIncomplete = eaten.sugarIncomplete || planned.sugarIncomplete;
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <button onClick={() => onShow("kcal")} aria-pressed={shown === "kcal"} className="block w-full text-left">
        <span className="flex items-baseline justify-between">
          <span className={left < 0 ? "text-bad" : ""}>
            <span className="text-4xl font-semibold">{Math.round(Math.abs(left))}</span>
            <span className="text-sm">kcal {left < 0 ? "over" : "left"}</span>
          </span>
          <span className={`text-sm transition-colors ${shown === "kcal" ? "text-accent" : "text-muted"}`}>
            {Math.round(total)} / {Math.round(target.kcal)}kcal
          </span>
        </span>
        <Bar eaten={eaten.kcal} planned={planned.kcal} range={{ max: target.kcal }} />
      </button>
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
        {LIMITED.map((key) => (
          <Macro key={key} name={key} range={target[key]} eaten={eaten[key]} planned={planned[key]} incomplete={key === "sugar" && sugarIncomplete} shown={shown === key} onShow={() => onShow(key)} />
        ))}
      </div>
      {sugarIncomplete && <p className="mt-3 text-xs text-muted">Sugar total is incomplete. Some foods or recipe ingredients have unknown sugar.</p>}
    </section>
  );
}

/** A nutrient's name and amount over its bar; the bar's colour says over or enough. */
function Macro({ name, range, eaten, planned, incomplete, shown, onShow }: { name: Limited; range: Range; eaten: number; planned: number; incomplete: boolean; shown: boolean; onShow: () => void }) {
  const total = eaten + planned;
  const { min, max } = range;
  const bounds = [min, max].filter((n) => n !== undefined).map((n) => n.toFixed(DIGITS[name]));
  return (
    <button onClick={onShow} aria-pressed={shown} className="block text-left">
      <span className={`flex justify-between text-xs transition-colors ${shown ? "text-accent" : "text-muted"}`}>
        <span>{LABELS[name]}</span>
        <span>
          {incomplete && "at least "}
          {total.toFixed(DIGITS[name])}
          {bounds.length > 0 && ` / ${bounds.join("–")}`}g
        </span>
      </span>
      <Bar eaten={eaten} planned={planned} range={range} />
    </button>
  );
}

/** Eaten, then planned in a paler shade, against the max (or the min when there's no max). A tick marks a min below the max. */
function Bar({ eaten, planned, range: { min, max } }: { eaten: number; planned: number; range: Range }) {
  const scale = max ?? min ?? 0;
  const total = eaten + planned;
  const color = max !== undefined && total > max ? "bg-bad" : max === undefined && min !== undefined && total >= min ? "bg-good" : "bg-accent";
  const width = (n: number) => `${scale > 0 ? Math.min(n / scale, 1) * 100 : 0}%`;
  const grow = "motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out";
  return (
    <span className="relative mt-1 block h-1 overflow-hidden rounded-full bg-line">
      <span className={`flex h-full ${grow}`} style={{ width: width(total) }}>
        <span className={`h-full ${color} ${grow}`} style={{ width: total ? `${(eaten / total) * 100}%` : 0 }} />
        <span className={`h-full flex-1 ${color} opacity-40`} />
      </span>
      {min !== undefined && max !== undefined && max > 0 && (
        <span className="absolute inset-y-0 w-0.5 bg-fg/50" style={{ left: `${Math.min(min / max, 1) * 100}%` }} />
      )}
    </span>
  );
}
