import type { State } from "../domain/state";
import type { Commit } from "../store";
import { Header } from "./Header";
import { TrainingVolume } from "./TrainingVolume";
import { Weight } from "./Weight";

type Props = { state: State; commit: Commit };

/** Every trend in one place: weight and maintenance, then training volume. */
export function Progress({ state, commit }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <Header title="Progress" />
      <Weight state={state} commit={commit}>
        <TrainingVolume state={state} />
      </Weight>
    </div>
  );
}
