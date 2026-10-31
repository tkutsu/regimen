import { useRegimen } from "./store";

export default function App() {
  const { config, state, error } = useRegimen();

  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="text-lg font-semibold">regimen</h1>
      {error && <p className="text-danger">{error}</p>}
      {config && state && (
        <dl className="mt-4 grid grid-cols-2 gap-1 text-sm text-muted">
          <dt>device</dt>
          <dd>{config.device}</dd>
          <dt>folder</dt>
          <dd className="break-all">{config.dir}</dd>
          <dt>foods</dt>
          <dd>{state.foods.size}</dd>
          <dt>weigh-ins</dt>
          <dd>{state.weights.size}</dd>
        </dl>
      )}
    </main>
  );
}
