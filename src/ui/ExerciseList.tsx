import { useMemo, useState } from "react";
import { exerciseLibrary, savedLibraryExercise, searchExercises, targets, type LibraryExercise } from "../domain/exerciseLibrary";
import { newId, type State } from "../domain/state";
import { usedExercises } from "../domain/training";
import type { Exercise } from "../domain/types";
import type { Commit } from "../store";
import { ExerciseEditor } from "./ExerciseEditor";
import { SearchInput } from "./fields";
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
                    <Summary exercise={exercise} />
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

/** Type, then primary muscles and lengthened bias; library entries add their equipment. */
function Summary({ exercise }: { exercise: Exercise | LibraryExercise }) {
  const { muscles, lengthened } = "equipment" in exercise ? exercise : targets(exercise);
  const details = [muscles.join(", "), lengthened && "Lengthened", "equipment" in exercise && exercise.equipment].filter(Boolean);
  return (
    <>
      <span className="block text-xs text-muted capitalize">{exercise.kind ?? "Unclassified"}</span>
      {details.length > 0 && <span className="block text-xs text-muted">{details.join(" · ")}</span>}
    </>
  );
}
