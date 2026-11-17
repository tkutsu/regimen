import type { Exercise } from "./types";

export type LibraryExercise = {
  id: string;
  name: string;
  kind: NonNullable<Exercise["kind"]>;
  muscles: string;
  equipment: string;
  aliases?: string;
};

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
  ["deadlift", "Conventional deadlift", "Glutes, hamstrings, back", "Barbell"],
  ["sumo-deadlift", "Sumo deadlift", "Glutes, quads, back", "Barbell"],
  ["romanian-deadlift", "Romanian deadlift", "Hamstrings, glutes", "Barbell", "RDL legs"],
  ["dumbbell-romanian-deadlift", "Dumbbell Romanian deadlift", "Hamstrings, glutes", "Dumbbells", "RDL legs"],
  ["trap-bar-deadlift", "Trap bar deadlift", "Glutes, quads, back", "Trap bar", "hex bar"],
  ["good-morning", "Good morning", "Hamstrings, glutes, back", "Barbell"],
  ["barbell-bench-press", "Barbell bench press", "Chest, triceps", "Barbell", "flat bench"],
  ["dumbbell-bench-press", "Dumbbell bench press", "Chest, triceps", "Dumbbells", "flat bench"],
  ["incline-barbell-press", "Incline barbell bench press", "Chest, triceps", "Barbell"],
  ["incline-dumbbell-press", "Incline dumbbell bench press", "Chest, triceps", "Dumbbells"],
  ["machine-chest-press", "Machine chest press", "Chest, triceps", "Machine"],
  ["push-up", "Push-up", "Chest, triceps", "Bodyweight", "pushup push up press up"],
  ["dip", "Dip", "Chest, triceps", "Parallel bars", "dips bodyweight"],
  ["close-grip-bench-press", "Close-grip bench press", "Triceps, chest", "Barbell"],
  ["barbell-overhead-press", "Barbell overhead press", "Shoulders, triceps", "Barbell", "OHP military press delts"],
  ["dumbbell-shoulder-press", "Dumbbell shoulder press", "Shoulders, triceps", "Dumbbells", "overhead delts"],
  ["machine-shoulder-press", "Machine shoulder press", "Shoulders, triceps", "Machine", "overhead delts"],
  ["pull-up", "Pull-up", "Back, biceps", "Pull-up bar", "pullup pull up lats bodyweight"],
  ["chin-up", "Chin-up", "Back, biceps", "Pull-up bar", "chinup chin up lats bodyweight"],
  ["lat-pulldown", "Lat pulldown", "Back, biceps", "Cable machine", "pull down lats"],
  ["barbell-row", "Barbell row", "Back, biceps", "Barbell", "bent over lats"],
  ["dumbbell-row", "Single-arm dumbbell row", "Back, biceps", "Dumbbell", "one arm lats"],
  ["seated-cable-row", "Seated cable row", "Back, biceps", "Cable machine", "lats"],
  ["chest-supported-row", "Chest-supported row", "Back, biceps", "Dumbbells", "lats"],
  ["machine-row", "Machine row", "Back, biceps", "Machine", "lats"],
  ["inverted-row", "Inverted row", "Back, biceps", "Bar or rings", "bodyweight lats"],
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
  ["lateral-raise", "Dumbbell lateral raise", "Shoulders", "Dumbbells", "side delts"],
  ["cable-lateral-raise", "Cable lateral raise", "Shoulders", "Cable machine", "side delts"],
  ["front-raise", "Dumbbell front raise", "Shoulders", "Dumbbells", "delts"],
  ["reverse-fly", "Reverse dumbbell fly", "Rear shoulders", "Dumbbells", "rear delts"],
  ["reverse-pec-deck", "Reverse pec deck", "Rear shoulders", "Machine", "rear delts fly"],
  ["barbell-curl", "Barbell biceps curl", "Biceps", "Barbell", "arms"],
  ["dumbbell-curl", "Dumbbell biceps curl", "Biceps", "Dumbbells", "arms"],
  ["hammer-curl", "Hammer curl", "Biceps, forearms", "Dumbbells", "arms"],
  ["preacher-curl", "Preacher curl", "Biceps", "EZ bar", "arms"],
  ["cable-curl", "Cable biceps curl", "Biceps", "Cable machine", "arms"],
  ["triceps-pushdown", "Triceps pushdown", "Triceps", "Cable machine", "pressdown rope arms"],
  ["overhead-triceps-extension", "Overhead triceps extension", "Triceps", "Cable machine", "arms"],
  ["skull-crusher", "Skull crusher", "Triceps", "EZ bar", "lying extension arms"],
  ["triceps-kickback", "Dumbbell triceps kickback", "Triceps", "Dumbbell", "arms"],
  ["straight-arm-pulldown", "Straight-arm pulldown", "Back", "Cable machine", "lats"],
  ["dumbbell-pullover", "Dumbbell pullover", "Back, chest", "Dumbbell", "lats"],
  ["shrug", "Dumbbell shrug", "Traps", "Dumbbells", "back"],
  ["crunch", "Crunch", "Abs", "Bodyweight", "abdominals core"],
  ["cable-crunch", "Cable crunch", "Abs", "Cable machine", "abdominals core"],
];

export const exerciseLibrary: LibraryExercise[] = ([
  ...compound.map(([id, name, muscles, equipment, aliases]): LibraryExercise => ({ id, name, kind: "compound", muscles, equipment, aliases })),
  ...isolation.map(([id, name, muscles, equipment, aliases]): LibraryExercise => ({ id, name, kind: "isolation", muscles, equipment, aliases })),
]).sort((a, b) => a.name.localeCompare(b.name));

/** Case, accents and separators don't change an exercise's search terms. */
const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Every query word must match; the library can also be searched by muscle, equipment or alias. */
export function searchExercises<T extends { name: string; kind?: Exercise["kind"]; muscles?: string; equipment?: string; aliases?: string }>(exercises: Iterable<T>, query: string): T[] {
  const words = normalize(query).split(" ").filter(Boolean);
  return [...exercises].filter((exercise) => {
    const text = normalize([exercise.name, exercise.kind, exercise.muscles, exercise.equipment, exercise.aliases].filter(Boolean).join(" "));
    return words.every((word) => text.includes(word));
  }).sort((a, b) => a.name.localeCompare(b.name));
}

/** A renamed library copy still counts as saved; an existing name also avoids a duplicate. */
export function savedLibraryExercise(exercises: Iterable<Exercise>, reference: LibraryExercise): Exercise | undefined {
  const saved = [...exercises];
  return saved.find((exercise) => exercise.libraryId === reference.id)
    ?? saved.find((exercise) => normalize(exercise.name) === normalize(reference.name));
}
