import { useMemo, useState } from "react";
import { exerciseLibrary, savedLibraryExercise, searchExercises, targets, type LibraryExercise } from "../domain/exerciseLibrary";
import { newId, type State } from "../domain/state";
import { usedExercises } from "../domain/training";
import type { Exercise } from "../domain/types";
import type { Commit } from "../store";
import { ExerciseEditor } from "./ExerciseEditor";
import { SearchInput } from "./fields";
import { transition } from "./motion";

type Props = { state: State; commit: Commit };
type Kind = "" | NonNullable<Exercise["kind"]>;

const KINDS: [Kind, string][] = [["", "All"], ["compound", "Compound"], ["isolation", "Isolation"]];

/**
 * Your exercises, then the bundled catalogue while searching or browsing it. A catalogue
 * entry, once opened and saved, becomes one of yours to edit.
 */
export function Exercises({ state, commit }: Props) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("");
  const [browsing, setBrowsing] = useState(false);
  const [editing, setEditing] = useState<Exercise>();
  const used = useMemo(() => usedExercises(state), [state.workouts, state.sessions]);
  const mine = useMemo(() => [...state.exercises.values()], [state.exercises]);
  const ofKind = <T extends Exercise | LibraryExercise>(list: T[]) => (kind ? list.filter((exercise) => exercise.kind === kind) : list);
  const yours = ofKind(searchExercises(mine, query));
  const catalogue = ofKind(searchExercises(exerciseLibrary, query)).filter((reference) => !savedLibraryExercise(mine, reference));
  const searching = query.trim() !== "";
  const openLibrary = (reference: LibraryExercise) => setEditing({ id: newId(), name: reference.name, measure: "reps", kind: reference.kind, libraryId: reference.id });

  return (
    <div className="flex flex-col gap-3 pb-24">
      <SearchInput value={query} onChange={setQuery} label="Search exercises" placeholder="Search name, muscle or equipment" />
      <div className="flex gap-2" role="group" aria-label="Exercise type">
        {KINDS.map(([value, name]) => (
          <button
            key={name}
            onClick={() => setKind(value)}
            aria-pressed={kind === value}
            className={`min-h-9 rounded-full border px-3.5 text-sm transition-colors ${kind === value ? "border-accent bg-accent/15 text-accent" : "border-line text-muted"}`}
          >
            {name}
          </button>
        ))}
      </div>

      {yours.length > 0 && (
        <List title={searching || kind ? undefined : "Yours"}>
          {yours.map((exercise) => (
            <Row key={exercise.id} exercise={exercise} onOpen={() => setEditing(exercise)} />
          ))}
        </List>
      )}
      {yours.length === 0 && !searching && !kind && (
        <p className="px-4 py-3 text-center text-sm text-muted">Save exercises from the catalogue or create your own, then add them to a day or a template.</p>
      )}

      {searching || browsing ? (
        catalogue.length > 0 ? (
          <List title="From the catalogue">
            {catalogue.map((reference) => (
              <Row key={reference.id} exercise={reference} add onOpen={() => openLibrary(reference)} />
            ))}
          </List>
        ) : (
          yours.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted">No exercises match your search.</p>
        )
      ) : (
        <button onClick={() => transition(() => setBrowsing(true))} className="min-h-11 rounded-2xl border border-line bg-surface px-4 text-left text-accent">
          Browse the catalogue · {catalogue.length} to add
        </button>
      )}

      <div className="page-actions fixed right-4 bottom-[calc(var(--tabs)+0.75rem)] left-4 z-[2] mx-auto max-w-md">
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

function List({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section>
      {title && <h2 className="mb-2 px-1 text-xs font-medium tracking-wide text-muted uppercase">{title}</h2>}
      <ul className="flow divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">{children}</ul>
    </section>
  );
}

function Row({ exercise, add = false, onOpen }: { exercise: Exercise | LibraryExercise; add?: boolean; onOpen: () => void }) {
  return (
    <li>
      <button onClick={onOpen} aria-label={`${add ? "Add" : "Edit"} ${exercise.name}`} className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left">
        <span className="min-w-0 flex-1">
          <span className="block break-words">{exercise.name}</span>
          <Summary exercise={exercise} />
        </span>
        {add && <span className="shrink-0 text-sm text-accent">+ Add</span>}
      </button>
    </li>
  );
}

/** Type, primary muscles and lengthened bias; catalogue entries add their equipment. */
function Summary({ exercise }: { exercise: Exercise | LibraryExercise }) {
  const { muscles, lengthened } = "equipment" in exercise ? exercise : targets(exercise);
  const details = [
    exercise.kind && exercise.kind[0].toUpperCase() + exercise.kind.slice(1),
    muscles.join(", "),
    lengthened && "Lengthened",
    "equipment" in exercise && exercise.equipment,
  ].filter(Boolean);
  return details.length > 0 && <span className="block text-xs text-muted">{details.join(" · ")}</span>;
}
