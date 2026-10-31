import { NUTRIENTS } from "../domain/nutrition";
import type { Nutrients } from "../domain/types";

type Key = keyof Nutrients;

/** Limits should stay under target; goals should reach it. */
const META: Record<Key, { label: string; unit: string; digits: number; kind: "limit" | "goal" }> = {
  kcal: { label: "kcal", unit: "", digits: 0, kind: "limit" },
  prot: { label: "protein", unit: "g", digits: 0, kind: "goal" },
  fiber: { label: "fiber", unit: "g", digits: 0, kind: "goal" },
  satFat: { label: "sat. fat", unit: "g", digits: 1, kind: "limit" },
  unsatFat: { label: "unsat. fat", unit: "g", digits: 0, kind: "goal" },
  salt: { label: "salt", unit: "g", digits: 1, kind: "limit" },
};

export function Remaining({ target, eaten }: { target: Nutrients; eaten: Nutrients }) {
  const left = target.kcal - eaten.kcal;
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <span className={`text-4xl font-semibold ${left < 0 ? "text-bad" : ""}`}>{Math.round(left)}</span>
        <span className="text-sm text-muted">
          kcal left · {Math.round(eaten.kcal)} / {Math.round(target.kcal)}
        </span>
      </div>
      <Bar value={eaten.kcal} target={target.kcal} kind="limit" />
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
        {NUTRIENTS.filter((key) => key !== "kcal").map((key) => (
          <Macro key={key} name={key} target={target[key]} eaten={eaten[key]} />
        ))}
      </dl>
    </section>
  );
}

function Macro({ name, target, eaten }: { name: Key; target: number; eaten: number }) {
  const { label, unit, digits, kind } = META[name];
  const left = target - eaten;
  const tone = left >= 0 ? "" : kind === "limit" ? "text-bad" : "text-good";
  return (
    <div>
      <dt className="flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span>
          {eaten.toFixed(digits)}/{target.toFixed(digits)}
          {unit}
        </span>
      </dt>
      <dd className={`text-sm font-medium ${tone}`}>
        {left >= 0 ? `${left.toFixed(digits)}${unit} left` : `${(-left).toFixed(digits)}${unit} over`}
      </dd>
      <Bar value={eaten} target={target} kind={kind} />
    </div>
  );
}

function Bar({ value, target, kind }: { value: number; target: number; kind: "limit" | "goal" }) {
  const ratio = target > 0 ? value / target : 0;
  const color = ratio <= 1 ? "bg-accent" : kind === "limit" ? "bg-bad" : "bg-good";
  return (
    <div className="mt-1 h-1 overflow-hidden rounded-full bg-line">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
    </div>
  );
}
