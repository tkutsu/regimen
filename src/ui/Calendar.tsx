import { useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");
const monthOf = (year: number, month: number) => {
  const d = new Date(year, month, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
};
/** Monday to Sunday, in the reader's language. */
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: "narrow" }));

type Props = {
  today: string;
  /** The day shown elsewhere, marked here; the calendar opens on its month. */
  picked: string;
  /** What a day shows under its number; nothing leaves it plain. */
  cell: (date: string) => React.ReactNode;
  onPick: (date: string) => void;
  label: (date: string) => string;
};

/** One month at a time, Monday first, with each day up to today a button. */
export function Calendar({ today, picked, cell, onPick, label }: Props) {
  const [shown, setShown] = useState(() => monthOf(+picked.slice(0, 4), +picked.slice(5, 7) - 1));
  const { year, month } = shown;
  const isLatest = `${year}-${pad(month + 1)}` >= today.slice(0, 7);
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const title = new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => setShown(monthOf(year, month - 1))} aria-label="Previous month" className="w-9 py-1 text-lg text-muted">
          ‹
        </button>
        <span className="text-sm font-medium">{title}</span>
        <button onClick={() => setShown(monthOf(year, month + 1))} disabled={isLatest} aria-label="Next month" className="w-9 py-1 text-lg text-muted disabled:opacity-30">
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((day, i) => (
          <span key={i} aria-hidden className="text-xs text-muted">
            {day}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => <span key={`lead${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const date = `${year}-${pad(month + 1)}-${pad(i + 1)}`;
          const content = date <= today ? cell(date) : undefined;
          return (
            <button
              key={date}
              onClick={() => onPick(date)}
              disabled={date > today}
              aria-label={label(date)}
              aria-pressed={date === picked}
              aria-current={date === today ? "date" : undefined}
              className={`flex h-12 flex-col items-center justify-start rounded-lg pt-1 disabled:opacity-30 ${content ? "bg-accent/15" : ""} ${date === picked ? "ring-2 ring-accent" : ""}`}
            >
              <span className={`text-xs ${date === today ? "font-semibold" : content ? "" : "text-muted"}`}>{i + 1}</span>
              {content && <span className="text-xs font-medium text-accent">{content}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
