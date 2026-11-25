import type { Exercise } from "./types";

export type LibraryExercise = {
  id: string;
  name: string;
  kind: NonNullable<Exercise["kind"]>;
  equipment: string;
  aliases?: string;
} & Targets;

/** What an exercise trains: names from `muscles`, secondary ones with the percentage of each set they count. */
export type Targets = { muscles: string[]; secondary: Record<string, number>; lengthened: boolean };

/**
 * Muscles are written as sentences ("Chest", "triceps, front delts") and stored as names.
 * A secondary muscle counts 50% of each set unless a percentage follows it.
 * Bundled credits use primary = 100%, secondary = 50% as tracking estimates, not measured activation.
 * Evidence, technique assumptions and unresolved cases: docs/exercise-muscle-credits.md.
 */
type Row = [id: string, name: string, primary: string, secondary: string, equipment: string, aliases?: string];

// An authored starter library of common names, without copied descriptions or prescribed loads.
const compound: Row[] = [
  ["barbell-squat", "Barbell back squat", "Quads, glutes", "adductors", "Barbell", "squats legs"],
  ["front-squat", "Front squat", "Quads", "glutes, adductors", "Barbell", "legs"],
  ["goblet-squat", "Goblet squat", "Quads", "glutes, adductors", "Dumbbell or kettlebell", "legs"],
  ["bodyweight-squat", "Bodyweight squat", "Quads", "glutes, adductors", "Bodyweight", "air squat legs"],
  ["leg-press", "Leg press", "Quads", "glutes, adductors", "Machine", "legs"],
  ["hack-squat", "Hack squat", "Quads", "glutes, adductors", "Machine", "legs"],
  ["bulgarian-split-squat", "Bulgarian split squat", "Quads, glutes", "adductors", "Dumbbells", "rear foot elevated legs"],
  ["split-squat", "Split squat", "Quads, glutes", "adductors", "Dumbbells", "legs"],
  ["walking-lunge", "Walking lunge", "Quads, glutes", "adductors", "Dumbbells", "legs lunges"],
  ["reverse-lunge", "Reverse lunge", "Glutes, quads", "adductors", "Dumbbells", "legs lunges"],
  ["step-up", "Step-up", "Quads, glutes", "", "Dumbbells", "legs step up"],
  ["deadlift", "Conventional deadlift", "Glutes, hamstrings, lower back", "quads, traps", "Barbell"],
  ["sumo-deadlift", "Sumo deadlift", "Glutes, quads, adductors", "hamstrings, lower back", "Barbell"],
  ["romanian-deadlift", "Romanian deadlift", "Hamstrings, glutes", "lower back, adductors", "Barbell", "RDL legs"],
  ["dumbbell-romanian-deadlift", "Dumbbell Romanian deadlift", "Hamstrings, glutes", "lower back, adductors", "Dumbbells", "RDL legs"],
  ["trap-bar-deadlift", "Trap bar deadlift", "Quads, glutes", "hamstrings, lower back, traps", "Trap bar", "hex bar"],
  ["good-morning", "Good morning", "Hamstrings, glutes", "lower back", "Barbell"],
  ["barbell-bench-press", "Barbell bench press", "Chest", "triceps, front delts", "Barbell", "flat bench"],
  ["dumbbell-bench-press", "Dumbbell bench press", "Chest", "triceps, front delts", "Dumbbells", "flat bench"],
  ["incline-barbell-press", "Incline barbell bench press", "Chest", "front delts, triceps", "Barbell"],
  ["incline-dumbbell-press", "Incline dumbbell bench press", "Chest", "front delts, triceps", "Dumbbells"],
  ["machine-chest-press", "Machine chest press", "Chest", "triceps, front delts", "Machine"],
  ["push-up", "Push-up", "Chest", "triceps, front delts", "Bodyweight", "pushup push up press up"],
  ["dip", "Dip", "Chest, triceps", "front delts", "Parallel bars", "dips bodyweight"],
  ["close-grip-bench-press", "Close-grip bench press", "Triceps", "chest, front delts", "Barbell"],
  ["barbell-overhead-press", "Barbell overhead press", "Front delts", "triceps, side delts", "Barbell", "OHP military press delts"],
  ["dumbbell-shoulder-press", "Dumbbell shoulder press", "Front delts", "triceps, side delts", "Dumbbells", "overhead delts"],
  ["machine-shoulder-press", "Machine shoulder press", "Front delts", "triceps, side delts", "Machine", "overhead delts"],
  ["upright-row", "Barbell upright row", "Side delts, traps", "biceps", "Barbell", "upright row shoulders delts"],
  ["pull-up", "Pull-up", "Lats", "biceps, upper back", "Pull-up bar", "pullup pull up lats bodyweight"],
  ["chin-up", "Chin-up", "Lats", "biceps, upper back", "Pull-up bar", "chinup chin up lats bodyweight"],
  ["lat-pulldown", "Lat pulldown", "Lats", "biceps, upper back", "Cable machine", "pull down lats"],
  ["barbell-row", "Barbell row", "Upper back, lats", "biceps, rear delts, lower back", "Barbell", "bent over lats"],
  ["dumbbell-row", "Single-arm dumbbell row", "Lats, upper back", "biceps, rear delts", "Dumbbell", "one arm lats"],
  ["seated-cable-row", "Seated cable row", "Upper back, lats", "biceps, rear delts", "Cable machine", "lats"],
  ["chest-supported-row", "Chest-supported row", "Upper back", "lats, rear delts, biceps", "Dumbbells", "lats"],
  ["machine-row", "Machine row", "Upper back, lats", "biceps, rear delts", "Machine", "lats"],
  ["inverted-row", "Inverted row", "Upper back", "lats, biceps, rear delts", "Bar or rings", "bodyweight lats"],
];

const isolation: Row[] = [
  ["leg-extension", "Leg extension", "Quads", "", "Machine", "legs"],
  ["seated-leg-curl", "Seated leg curl", "Hamstrings", "", "Machine", "legs"],
  ["lying-leg-curl", "Lying leg curl", "Hamstrings", "", "Machine", "legs"],
  ["standing-calf-raise", "Standing calf raise", "Calves", "", "Machine", "legs calf"],
  ["seated-calf-raise", "Seated calf raise", "Calves", "", "Machine", "legs calf"],
  ["hip-abduction", "Hip abduction", "Glutes", "", "Machine", "abductor legs"],
  ["hip-adduction", "Hip adduction", "Adductors", "", "Machine", "adductor legs inner thigh"],
  ["cable-glute-kickback", "Cable glute kickback", "Glutes", "hamstrings", "Cable machine"],
  ["hip-thrust", "Barbell hip thrust", "Glutes", "", "Barbell"],
  ["glute-bridge", "Glute bridge", "Glutes", "", "Bodyweight"],
  ["dumbbell-fly", "Dumbbell chest fly", "Chest", "front delts", "Dumbbells", "flyes pecs"],
  ["cable-fly", "Cable chest fly", "Chest", "front delts", "Cable machine", "crossover flyes pecs"],
  ["pec-deck", "Pec deck", "Chest", "front delts", "Machine", "butterfly fly pecs"],
  ["lateral-raise", "Dumbbell lateral raise", "Side delts", "traps", "Dumbbells", "side delts"],
  ["cable-lateral-raise", "Cable lateral raise", "Side delts", "traps", "Cable machine", "side delts"],
  ["front-raise", "Dumbbell front raise", "Front delts", "", "Dumbbells", "delts"],
  ["reverse-fly", "Reverse dumbbell fly", "Rear delts", "upper back", "Dumbbells", "rear delts"],
  ["reverse-pec-deck", "Reverse pec deck", "Rear delts", "upper back", "Machine", "rear delts fly"],
  ["barbell-curl", "Barbell biceps curl", "Biceps", "forearms", "Barbell", "arms"],
  ["dumbbell-curl", "Dumbbell biceps curl", "Biceps", "forearms", "Dumbbells", "arms"],
  ["hammer-curl", "Hammer curl", "Biceps", "forearms", "Dumbbells", "arms"],
  ["preacher-curl", "Preacher curl", "Biceps", "forearms", "EZ bar", "arms"],
  ["cable-curl", "Cable biceps curl", "Biceps", "forearms", "Cable machine", "arms"],
  ["triceps-pushdown", "Triceps pushdown", "Triceps", "", "Cable machine", "pressdown rope arms"],
  ["overhead-triceps-extension", "Overhead triceps extension", "Triceps", "", "Cable machine", "arms"],
  ["skull-crusher", "Skull crusher", "Triceps", "", "EZ bar", "lying extension arms"],
  ["triceps-kickback", "Dumbbell triceps kickback", "Triceps", "", "Dumbbell", "arms"],
  ["straight-arm-pulldown", "Straight-arm pulldown", "Lats", "", "Cable machine", "lats"],
  ["dumbbell-pullover", "Dumbbell pullover", "Lats", "chest", "Dumbbell", "lats"],
  ["shrug", "Dumbbell shrug", "Traps", "", "Dumbbells", "back"],
  ["crunch", "Crunch", "Abs", "", "Bodyweight", "abdominals core"],
  ["cable-crunch", "Cable crunch", "Abs", "", "Cable machine", "abdominals core"],
];

/** Hardest where the target muscle is most stretched; only the clear-cut cases. */
const lengthened = new Set([
  "romanian-deadlift", "dumbbell-romanian-deadlift", "good-morning", "bulgarian-split-squat", "dip",
  "seated-leg-curl", "standing-calf-raise", "dumbbell-fly", "cable-lateral-raise", "preacher-curl",
  "overhead-triceps-extension", "dumbbell-pullover",
]);

const name = (muscle: string) => muscle[0].toUpperCase() + muscle.slice(1);
const list = (text: string) => text ? text.split(", ") : [];

const entry = (kind: LibraryExercise["kind"]) => ([id, title, primary, secondary, equipment, aliases]: Row): LibraryExercise => ({
  id, name: title, kind, equipment, aliases,
  muscles: list(primary).map(name),
  secondary: Object.fromEntries(list(secondary).map((part) => {
    const [, muscle, pct] = part.match(/^(.+?)(?: (\d+))?$/)!;
    return [name(muscle), pct ? Number(pct) : 50];
  })),
  lengthened: lengthened.has(id),
});

export const exerciseLibrary: LibraryExercise[] = [...compound.map(entry("compound")), ...isolation.map(entry("isolation"))]
  .sort((a, b) => a.name.localeCompare(b.name));

/** An exercise's own targets once its muscles are picked; until then a library copy follows its entry. */
export function targets(exercise: Exercise): Targets {
  const reference = !exercise.muscles && exerciseLibrary.find((entry) => entry.id === exercise.libraryId);
  if (reference) return { muscles: reference.muscles, secondary: reference.secondary, lengthened: reference.lengthened };
  return { muscles: exercise.muscles ?? [], secondary: exercise.secondary ?? {}, lengthened: !!exercise.lengthened };
}

/** Case, accents and separators don't change an exercise's search terms. */
const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Every query word must match; exercises can also be searched by muscle, "lengthened", equipment or alias. */
export function searchExercises<T extends Exercise | LibraryExercise>(exercises: Iterable<T>, query: string): T[] {
  const words = normalize(query).split(" ").filter(Boolean);
  return [...exercises].filter((exercise) => {
    const item: Exercise | LibraryExercise = exercise;
    const { muscles, secondary, lengthened } = "equipment" in item ? item : targets(item);
    const extra = "equipment" in item ? [item.equipment, item.aliases] : [];
    const fields = [item.name, item.kind, ...muscles, ...Object.keys(secondary), lengthened && "lengthened stretch", ...extra];
    const text = normalize(fields.filter(Boolean).join(" "));
    return words.every((word) => text.includes(word));
  }).sort((a, b) => a.name.localeCompare(b.name));
}

/** A renamed library copy still counts as saved; an existing name also avoids a duplicate. */
export function savedLibraryExercise(exercises: Iterable<Exercise>, reference: LibraryExercise): Exercise | undefined {
  const saved = [...exercises];
  return saved.find((exercise) => exercise.libraryId === reference.id)
    ?? saved.find((exercise) => normalize(exercise.name) === normalize(reference.name));
}
