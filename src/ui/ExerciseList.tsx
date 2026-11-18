import { useMemo, useState } from "react";
import { exerciseLibrary, libraryMuscles, savedLibraryExercise, searchExercises, type LibraryExercise } from "../domain/exerciseLibrary";
import { newId, type State } from "../domain/state";
import { usedExercises } from "../domain/training";
import type { Exercise } from "../domain/types";
import type { Commit } from "../store";
import { Dialog } from "./Dialog";
import { BodyweightField, ExerciseKindField, MuscleField } from "./exercises";
import { blurOnEnter, Info, SearchInput } from "./fields";
import { box } from "./FoodEditor";

type Props = { state: State; commit: Commit };

/** Saved exercises and a bundled library; library entries become editable personal copies. */
export function Exercises({ state, commit }: Props) {
  const [source, setSource] = useState<"mine" | "library">("mine");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"" | NonNullable<Exercise["kind"]>>("");
  const [editing, setEditing] = useState<Exercise>();
  const used = useMemo(() => usedExercises(state), [state.workouts, state.sessions]);
  const mine = useMemo(() => [...state.exercises.values()], [state.exercises]);
  const list = source === "mine" ? searchExercises(mine, query) : searchExercises(exerciseLibrary, query);
  const shown = kind ? list.filter((exercise) => exercise.kind === kind) : list;
  const openLibrary = (reference: LibraryExercise) => setEditing(savedLibraryExercise(mine, reference) ?? {
    id: newId(), name: reference.name, measure: "reps", kind: reference.kind, libraryId: reference.id,
  });

  return (
    <div className="flex flex-col gap-3 pb-24">
      <div className="flex rounded-xl bg-line/50 p-1 text-sm" role="group" aria-label="Exercise lists">
        {(["mine", "library"] as const).map((value) => (
          <button key={value} onClick={() => setSource(value)} aria-pressed={source === value}
            className={`min-h-10 flex-1 rounded-lg capitalize ${source === value ? "bg-surface font-medium shadow-sm" : "text-muted"}`}>
            {value} ({value === "mine" ? mine.length : exerciseLibrary.length})
          </button>
        ))}
      </div>
      <SearchInput value={query} onChange={setQuery} label="Search exercises"
        placeholder={source === "mine" ? "Search name or muscle" : "Search name, muscle or equipment"} />
      <label className="flex items-center gap-2 text-sm text-muted">
        Type
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label="Filter exercise type" className={`${box} min-h-11 border-line text-fg`}>
          <option value="">All types</option>
          <option value="compound">Compound</option>
          <option value="isolation">Isolation</option>
        </select>
        <Info label="Exercise types" hint="Compound exercises move several joints; isolation exercises focus on one. You can change the type on your saved exercises." />
      </label>
      {source === "library" && <p className="px-1 text-xs text-muted">An offline starter library. Open an exercise to save your own copy and set how its load counts toward volume.</p>}
      {shown.length > 0 && (
        <ul className="flow divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {shown.map((exercise) => {
            const reference = "equipment" in exercise ? exercise : undefined;
            const saved = reference && savedLibraryExercise(mine, reference);
            return (
              <li key={exercise.id}>
                <button onClick={() => "equipment" in exercise ? openLibrary(exercise) : setEditing(exercise)}
                  aria-label={`${reference ? saved ? "Edit" : "Add" : "Edit"} ${exercise.name}`}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block break-words">{exercise.name}</span>
                    <span className="block text-xs text-muted capitalize">{exercise.kind ?? "Unclassified"}</span>
                    {"equipment" in exercise ? <span className="block text-xs text-muted">{exercise.muscles.join(", ")} · {exercise.equipment}</span>
                      : <Muscles exercise={exercise} />}
                  </span>
                  {reference && <span className={`shrink-0 text-xs ${saved ? "text-muted" : "text-accent"}`}>{saved ? "In Mine" : "+ Add"}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {shown.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted">
        {source === "mine" && mine.length === 0 ? "Save exercises from the library or create your own, then select them in workouts and sessions." : "No exercises match your search and type filter."}
      </p>}
      <div className="page-actions fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-[2] mx-auto max-w-md">
        <button data-enter onClick={() => setEditing({ id: newId(), name: "", measure: "reps" })}
          className="w-full rounded-2xl bg-accent py-3.5 font-medium text-bg shadow-lg">New exercise</button>
      </div>
      {editing && <ExerciseEditor key={editing.id} exercise={editing} saved={state.exercises.has(editing.id)} used={used.has(editing.id)}
        onSave={async (exercise) => {
          if (await commit({ type: "exercise.upsert", exercise })) setEditing(undefined);
        }}
        onDelete={async () => {
          if (!used.has(editing.id) && await commit({ type: "exercise.delete", exerciseId: editing.id })) setEditing(undefined);
        }} onClose={() => setEditing(undefined)} />}
    </div>
  );
}

/** A saved exercise's muscles, or its library suggestion until picked. */
function Muscles({ exercise }: { exercise: Exercise }) {
  const details = [libraryMuscles(exercise)?.join(", "), exercise.lengthened && "Lengthened bias"].filter(Boolean);
  return details.length > 0 && <span className="block text-xs text-muted">{details.join(" · ")}</span>;
}

/** Draft edits stay in the dialog until saved; referenced exercises cannot be deleted. */
function ExerciseEditor({ exercise, saved, used, onSave, onDelete, onClose }: {
  exercise: Exercise; saved: boolean; used: boolean;
  onSave: (exercise: Exercise) => Promise<void>; onDelete: () => Promise<void>; onClose: () => void;
}) {
  const [draft, setDraft] = useState<Exercise>(() => ({ ...exercise, muscles: libraryMuscles(exercise) }));
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await onSave({ ...draft, name: draft.name.trim() }); }
    finally { setSaving(false); }
  };
  return (
    <Dialog label={saved ? "Edit exercise" : "New exercise"} onClose={onClose}>
      <header className="flex items-center justify-between border-b border-line p-3">
        <button onClick={onClose} className="px-2 py-2 text-muted">Cancel</button>
        <h2 className="font-medium">{saved ? "Edit exercise" : "New exercise"}</h2>
        <button disabled={!draft.name.trim() || saving} onClick={save} className="px-2 py-2 font-medium text-accent disabled:opacity-40">{!saved && draft.libraryId ? "Save to Mine" : "Save"}</button>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-md flex-col gap-5 p-4">
          <input autoFocus={!draft.name} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            onKeyDown={blurOnEnter} aria-label="Exercise name" placeholder="Name" className={`${box} w-full border-line text-lg`} />
          <ExerciseKindField exercise={draft} onChange={setDraft} />
          <MuscleField exercise={draft} onChange={setDraft} />
          <BodyweightField exercise={draft} onChange={setDraft} />
          {saved && <p className="text-xs text-muted">Changes apply to this exercise in all workouts and past sessions.</p>}
          {saved && (used ? <p className="text-sm text-muted">Used in a workout or session. Keep this exercise so your training history stays intact.</p> :
            <button onClick={() => confirming ? onDelete() : setConfirming(true)} className="rounded-xl border border-line py-3 text-bad">
              {confirming ? "Tap again to delete" : "Delete exercise"}
            </button>)}
        </div>
      </div>
    </Dialog>
  );
}
