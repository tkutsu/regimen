import { useState } from "react";
import { targets } from "../domain/exerciseLibrary";
import { searchMuscles } from "../domain/muscles";
import type { Exercise } from "../domain/types";
import { Dialog, useBack } from "./Dialog";
import { blurOnEnter, NumberInput, OptionalNumberInput, Remove, SearchInput, Section, Switch } from "./fields";
import { box } from "./FoodEditor";
import { Segmented } from "./TrendChart";

type Props = {
  exercise: Exercise;
  saved: boolean;
  used: boolean;
  onSave: (exercise: Exercise) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
};

const KINDS = {
  compound: "Several joints move, like squats, presses and rows.",
  isolation: "One joint moves, like curls, raises and extensions.",
};

/** Draft edits stay in the dialog until saved; a library copy opens with its entry's muscles. */
export function ExerciseEditor({ exercise, saved, used, onSave, onDelete, onClose }: Props) {
  const [draft, setDraft] = useState<Exercise>(() => ({ ...exercise, ...targets(exercise) }));
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<Exercise>) => setDraft({ ...draft, ...patch });
  const primary = draft.muscles ?? [];
  const secondary = draft.secondary ?? {};
  const taken = [...primary, ...Object.keys(secondary)];
  const title = saved ? "Edit exercise" : "New exercise";

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        ...draft,
        name: draft.name.trim(),
        muscles: primary.length || draft.libraryId ? primary : undefined,
        secondary: Object.keys(secondary).length ? secondary : undefined,
        lengthened: draft.lengthened || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog label={title} onClose={onClose}>
      <header className="flex items-center justify-between border-b border-line p-3">
        <button onClick={onClose} className="px-2 py-2 text-muted">Cancel</button>
        <h2 className="font-medium">{title}</h2>
        <button disabled={!draft.name.trim() || saving} onClick={save} className="px-2 py-2 font-medium text-accent disabled:opacity-40">
          {!saved && draft.libraryId ? "Save to Mine" : "Save"}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-md flex-col gap-6 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-col gap-3">
            <input autoFocus={!draft.name} value={draft.name} onChange={(e) => set({ name: e.target.value })} onKeyDown={blurOnEnter}
              aria-label="Exercise name" placeholder="Name" className={`${box} w-full border-line text-lg`} />
            <Segmented<string> options={Object.keys(KINDS)} value={draft.kind ?? ""} className="text-sm"
              onChange={(kind) => set({ kind: kind === draft.kind ? undefined : kind as Exercise["kind"] })}
              label={(kind) => kind[0].toUpperCase() + kind.slice(1)} />
            <p className="px-1 text-xs text-muted">{draft.kind ? KINDS[draft.kind] : "Unclassified. Pick a type to filter exercises by it."}</p>
          </div>

          <Section title="Primary muscles" aside={<span className="text-xs text-muted normal-case">count every set</span>}>
            {primary.map((muscle) => (
              <div key={muscle} className="flex items-center gap-2 px-4 py-2.5">
                <span className="flex-1">{muscle}</span>
                <Remove label={muscle} onClick={() => set({ muscles: primary.filter((other) => other !== muscle) })} />
              </div>
            ))}
            <AddMuscle role="primary" taken={taken} onAdd={(muscle) => set({ muscles: [...primary, muscle] })} />
          </Section>

          <Section title="Secondary muscles" aside={<span className="text-xs text-muted normal-case">share of each set</span>}>
            {Object.entries(secondary).map(([muscle, pct]) => (
              <div key={muscle} className="flex items-center gap-2 px-4 py-2.5">
                <span className="flex-1">{muscle}</span>
                <span className="inline-flex items-baseline">
                  <NumberInput value={pct} aria-label={`${muscle} share of each set`} className="w-12 text-right"
                    onCommit={(next) => next > 0 && next <= 100 && set({ secondary: { ...secondary, [muscle]: Math.round(next) } })} />
                  <span className="ml-0.5 text-sm text-muted">%</span>
                </span>
                <Remove label={muscle} onClick={() => set({ secondary: Object.fromEntries(Object.entries(secondary).filter(([other]) => other !== muscle)) })} />
              </div>
            ))}
            <AddMuscle role="secondary" taken={taken} onAdd={(muscle) => set({ secondary: { ...secondary, [muscle]: 50 } })} />
          </Section>

          <Section title="Loading">
            <Toggle label="Lengthened bias" hint="Hardest where the muscle is most stretched, like Romanian deadlifts or overhead extensions."
              checked={!!draft.lengthened} onChange={(lengthened) => set({ lengthened })} />
            <Toggle label="Unilateral" hint="One side at a time, kg logged per side. Volume counts the kg twice."
              checked={!!draft.unilateral} onChange={(unilateral) => set({ unilateral: unilateral || undefined })} />
            <label className="flex items-center gap-3 px-4 py-2.5">
              <Text label="Bodyweight" hint="Share of your weight (+3 kg) the exercise moves, added to its kg for volume." />
              <span className="inline-flex items-baseline">
                <OptionalNumberInput value={draft.bodyweightPct} placeholder="0" aria-label="Bodyweight percentage" className="w-12 text-right placeholder:text-muted/50"
                  onCommit={(pct) => (pct === undefined || (pct >= 0 && pct <= 100)) && set({ bodyweightPct: pct || undefined })} />
                <span className="ml-0.5 text-sm text-muted">%</span>
              </span>
            </label>
          </Section>

          {saved && (
            <div className="flex flex-col gap-2">
              <p className="text-center text-sm text-muted">Changes apply in every workout and past session, volume included.</p>
              {used
                ? <p className="text-center text-sm text-muted">Used in a workout or session, so it stays to keep your history intact.</p>
                : <button onClick={() => confirming ? onDelete() : setConfirming(true)} className="rounded-xl border border-line py-3 text-bad">
                  {confirming ? "Tap again to delete" : "Delete exercise"}
                </button>}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}

function Text({ label, hint }: { label: string; hint: string }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block">{label}</span>
      <span className="block text-xs text-muted">{hint}</span>
    </span>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 px-4 py-2.5">
      <Text label={label} hint={hint} />
      <Switch checked={checked} label={label} onChange={onChange} />
    </label>
  );
}

/** The last row of a muscle card; it opens into a search. */
function AddMuscle({ role, taken, onAdd }: { role: string; taken: string[]; onAdd: (muscle: string) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button onClick={() => setOpen(true)} className="w-full px-4 py-2.5 text-left text-accent">+ Add {role} muscle</button>;
  return <MuscleSearch role={role} taken={taken} onClose={() => setOpen(false)} onPick={(muscle) => { onAdd(muscle); setOpen(false); }} />;
}

/** Enter picks the first match; Back and Escape close the search, not the editor. */
function MuscleSearch({ role, taken, onPick, onClose }: { role: string; taken: string[]; onPick: (muscle: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  useBack(onClose);
  const options = searchMuscles(query).filter((muscle) => !taken.includes(muscle));
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <SearchInput autoFocus value={query} onChange={setQuery} label={`Search ${role} muscles`} placeholder="Search muscles" className="flex-1"
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            else if (e.key === "Enter" && !e.nativeEvent.isComposing && query.trim() && options[0]) onPick(options[0]);
          }} />
        <button onClick={onClose} className="px-1 text-sm text-muted">Cancel</button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((muscle) => (
          <button key={muscle} onClick={() => onPick(muscle)} className="min-h-9 rounded-full border border-line px-3 text-sm">{muscle}</button>
        ))}
        {options.length === 0 && <p className="px-1 text-sm text-muted">No muscles match.</p>}
      </div>
    </div>
  );
}
