import { useRegimen } from "./store";
import { Today } from "./ui/Today";

export default function App() {
  const { state, error, commit } = useRegimen();

  if (error) return <p className="p-4 text-bad">{error}</p>;
  if (!state) return null;
  return <Today state={state} commit={commit} />;
}
