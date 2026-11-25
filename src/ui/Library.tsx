import type { State } from "../domain/state";
import type { Commit } from "../store";
import { Exercises } from "./ExerciseList";
import { Foods } from "./Foods";
import { Segmented } from "./fields";
import { Header } from "./Header";
import { useRemembered } from "./look";
import { transition } from "./motion";

type Props = { state: State; commit: Commit };

const SHELVES = ["foods", "exercises"] as const;

/** What days are made of: foods and recipes, exercises and their catalogue. */
export function Library({ state, commit }: Props) {
  const [shelf, setShelf] = useRemembered<(typeof SHELVES)[number]>("library.shelf", "foods", SHELVES);
  const List = shelf === "foods" ? Foods : Exercises;
  return (
    <div className="flex flex-col gap-3">
      <Header title="Library" />
      <Segmented options={SHELVES} value={shelf} onChange={(next) => transition(() => setShelf(next))} label={(name) => name[0].toUpperCase() + name.slice(1)} className="min-h-11 text-sm" />
      <List state={state} commit={commit} />
    </div>
  );
}
