/** Muscles an exercise can train, head to toe, each with extra words it can be searched by. */
const vocabulary: [name: string, aliases: string][] = [
  ["Chest", "pecs pectorals"],
  ["Front delts", "shoulders anterior deltoids"],
  ["Side delts", "shoulders lateral medial deltoids"],
  ["Rear delts", "shoulders posterior deltoids"],
  ["Traps", "trapezius upper back neck"],
  ["Upper back", "rhomboids mid back"],
  ["Lats", "latissimus back"],
  ["Lower back", "erectors spinal back"],
  ["Biceps", "arms"],
  ["Triceps", "arms"],
  ["Forearms", "arms grip"],
  ["Abs", "abdominals core rectus"],
  ["Obliques", "core waist"],
  ["Glutes", "butt hips"],
  ["Quads", "quadriceps thighs legs"],
  ["Hamstrings", "thighs legs"],
  ["Adductors", "inner thighs legs groin"],
  ["Calves", "legs"],
];

export const muscles = vocabulary.map(([name]) => name);

const terms = new Map(vocabulary.map(([name, aliases]) => [name, `${name} ${aliases}`.toLowerCase()]));

/** Every query word must start a word of the muscle's name or aliases, so "back" finds all three back muscles. */
export function searchMuscles(query: string): string[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return muscles.filter((name) => words.every((word) => terms.get(name)!.split(" ").some((term) => term.startsWith(word))));
}
