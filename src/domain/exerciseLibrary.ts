import type { Exercise } from "./types";

export type LibraryExercise = {
  id: string;
  name: string;
  kind: NonNullable<Exercise["kind"]>;
  /** Names from `muscles`, main movers first. */
  muscles: string[];
  equipment: string;
  aliases?: string;
};

/** Muscles are written as a sentence ("Chest, triceps") and stored as names ("Chest", "Triceps"). */
type Row = [id: string, name: string, muscles: string, equipment: string, aliases?: string];

// An authored starter library of common names, without copied descriptions or prescribed loads.
const compound: Row[] = [
  ["barbell-squat", "Barbell back squat", "Quads, glutes", "Barbell", "squats legs"],
  ["front-squat", "Front squat", "Quads, glutes", "Barbell", "legs"],
  ["goblet-squat", "Goblet squat", "Quads, glutes", "Dumbbell or kettlebell", "legs"],
  ["bodyweight-squat", "Bodyweight squat", "Quads, glutes", "Bodyweight", "air squat legs"],
  ["leg-press", "Leg press", "Quads, glutes", "Machine", "legs"],
  ["hack-squat", "Hack squat", "Quads, glutes", "Machine", "legs"],
  ["bulgarian-split-squat", "Bulgarian split squat", "Quads, glutes", "Dumbbells", "rear foot elevated legs"],
  ["split-squat", "Split squat", "Quads, glutes", "Dumbbells", "legs"],
  ["walking-lunge", "Walking lunge", "Quads, glutes", "Dumbbells", "legs lunges"],
  ["reverse-lunge", "Reverse lunge", "Quads, glutes", "Dumbbells", "legs lunges"],
  ["step-up", "Step-up", "Quads, glutes", "Dumbbells", "legs step up"],
  ["deadlift", "Conventional deadlift", "Glutes, hamstrings, lower back", "Barbell"],
  ["sumo-deadlift", "Sumo deadlift", "Glutes, quads, lower back", "Barbell"],
  ["romanian-deadlift", "Romanian deadlift", "Hamstrings, glutes", "Barbell", "RDL legs"],
  ["dumbbell-romanian-deadlift", "Dumbbell Romanian deadlift", "Hamstrings, glutes", "Dumbbells", "RDL legs"],
  ["trap-bar-deadlift", "Trap bar deadlift", "Glutes, quads, lower back", "Trap bar", "hex bar"],
  ["good-morning", "Good morning", "Hamstrings, glutes, lower back", "Barbell"],
  ["barbell-bench-press", "Barbell bench press", "Chest, triceps, front delts", "Barbell", "flat bench"],
  ["dumbbell-bench-press", "Dumbbell bench press", "Chest, triceps, front delts", "Dumbbells", "flat bench"],
  ["incline-barbell-press", "Incline barbell bench press", "Chest, front delts, triceps", "Barbell"],
  ["incline-dumbbell-press", "Incline dumbbell bench press", "Chest, front delts, triceps", "Dumbbells"],
  ["machine-chest-press", "Machine chest press", "Chest, triceps, front delts", "Machine"],
  ["push-up", "Push-up", "Chest, triceps, front delts", "Bodyweight", "pushup push up press up"],
  ["dip", "Dip", "Chest, triceps, front delts", "Parallel bars", "dips bodyweight"],
  ["close-grip-bench-press", "Close-grip bench press", "Triceps, chest", "Barbell"],
  ["barbell-overhead-press", "Barbell overhead press", "Front delts, triceps", "Barbell", "OHP military press delts"],
  ["dumbbell-shoulder-press", "Dumbbell shoulder press", "Front delts, triceps", "Dumbbells", "overhead delts"],
  ["machine-shoulder-press", "Machine shoulder press", "Front delts, triceps", "Machine", "overhead delts"],
  ["pull-up", "Pull-up", "Lats, biceps", "Pull-up bar", "pullup pull up lats bodyweight"],
  ["chin-up", "Chin-up", "Lats, biceps", "Pull-up bar", "chinup chin up lats bodyweight"],
  ["lat-pulldown", "Lat pulldown", "Lats, biceps", "Cable machine", "pull down lats"],
  ["barbell-row", "Barbell row", "Upper back, lats, biceps", "Barbell", "bent over lats"],
  ["dumbbell-row", "Single-arm dumbbell row", "Upper back, lats, biceps", "Dumbbell", "one arm lats"],
  ["seated-cable-row", "Seated cable row", "Upper back, lats, biceps", "Cable machine", "lats"],
  ["chest-supported-row", "Chest-supported row", "Upper back, lats, biceps", "Dumbbells", "lats"],
  ["machine-row", "Machine row", "Upper back, lats, biceps", "Machine", "lats"],
  ["inverted-row", "Inverted row", "Upper back, lats, biceps", "Bar or rings", "bodyweight lats"],
];

const isolation: Row[] = [
  ["leg-extension", "Leg extension", "Quads", "Machine", "legs"],
  ["seated-leg-curl", "Seated leg curl", "Hamstrings", "Machine", "legs"],
  ["lying-leg-curl", "Lying leg curl", "Hamstrings", "Machine", "legs"],
  ["standing-calf-raise", "Standing calf raise", "Calves", "Machine", "legs calf"],
  ["seated-calf-raise", "Seated calf raise", "Calves", "Machine", "legs calf"],
  ["hip-abduction", "Hip abduction", "Glutes", "Machine", "abductor legs"],
  ["hip-adduction", "Hip adduction", "Adductors", "Machine", "adductor legs inner thigh"],
  ["cable-glute-kickback", "Cable glute kickback", "Glutes", "Cable machine"],
  ["hip-thrust", "Barbell hip thrust", "Glutes", "Barbell"],
  ["glute-bridge", "Glute bridge", "Glutes", "Bodyweight"],
  ["dumbbell-fly", "Dumbbell chest fly", "Chest", "Dumbbells", "flyes pecs"],
  ["cable-fly", "Cable chest fly", "Chest", "Cable machine", "crossover flyes pecs"],
  ["pec-deck", "Pec deck", "Chest", "Machine", "butterfly fly pecs"],
  ["lateral-raise", "Dumbbell lateral raise", "Side delts", "Dumbbells", "side delts"],
  ["cable-lateral-raise", "Cable lateral raise", "Side delts", "Cable machine", "side delts"],
  ["front-raise", "Dumbbell front raise", "Front delts", "Dumbbells", "delts"],
  ["reverse-fly", "Reverse dumbbell fly", "Rear delts", "Dumbbells", "rear delts"],
  ["reverse-pec-deck", "Reverse pec deck", "Rear delts", "Machine", "rear delts fly"],
  ["barbell-curl", "Barbell biceps curl", "Biceps", "Barbell", "arms"],
  ["dumbbell-curl", "Dumbbell biceps curl", "Biceps", "Dumbbells", "arms"],
  ["hammer-curl", "Hammer curl", "Biceps, forearms", "Dumbbells", "arms"],
  ["preacher-curl", "Preacher curl", "Biceps", "EZ bar", "arms"],
  ["cable-curl", "Cable biceps curl", "Biceps", "Cable machine", "arms"],
  ["triceps-pushdown", "Triceps pushdown", "Triceps", "Cable machine", "pressdown rope arms"],
  ["overhead-triceps-extension", "Overhead triceps extension", "Triceps", "Cable machine", "arms"],
  ["skull-crusher", "Skull crusher", "Triceps", "EZ bar", "lying extension arms"],
  ["triceps-kickback", "Dumbbell triceps kickback", "Triceps", "Dumbbell", "arms"],
  ["straight-arm-pulldown", "Straight-arm pulldown", "Lats", "Cable machine", "lats"],
  ["dumbbell-pullover", "Dumbbell pullover", "Lats, chest", "Dumbbell", "lats"],
  ["shrug", "Dumbbell shrug", "Traps", "Dumbbells", "back"],
  ["crunch", "Crunch", "Abs", "Bodyweight", "abdominals core"],
  ["cable-crunch", "Cable crunch", "Abs", "Cable machine", "abdominals core"],
];

const entry = (kind: LibraryExercise["kind"]) => ([id, name, muscles, equipment, aliases]: Row): LibraryExercise => ({
  id, name, kind, equipment, aliases,
  muscles: muscles.split(", ").map((muscle) => muscle[0].toUpperCase() + muscle.slice(1)),
});

export const exerciseLibrary: LibraryExercise[] = [...compound.map(entry("compound")), ...isolation.map(entry("isolation"))]
  .sort((a, b) => a.name.localeCompare(b.name));

/** The muscles a saved copy starts with until its own are picked. */
export const libraryMuscles = (exercise: Exercise) =>
  exercise.muscles ?? exerciseLibrary.find((reference) => reference.id === exercise.libraryId)?.muscles;

/** Case, accents and separators don't change an exercise's search terms. */
const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

type Searchable = { name: string; kind?: Exercise["kind"]; muscles?: string[]; lengthened?: boolean; equipment?: string; aliases?: string };

/** Every query word must match; exercises can also be searched by muscle, "lengthened", equipment or alias. */
export function searchExercises<T extends Searchable>(exercises: Iterable<T>, query: string): T[] {
  const words = normalize(query).split(" ").filter(Boolean);
  return [...exercises].filter((exercise) => {
    const fields = [exercise.name, exercise.kind, ...exercise.muscles ?? [], exercise.lengthened && "lengthened stretch", exercise.equipment, exercise.aliases];
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
