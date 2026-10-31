import { useState } from "react";
import { newId, type State } from "../domain/state";
import type { Change, Phase, Settings as SettingsT } from "../domain/types";
import { NumberInput } from "./fields";

type Props = { state: State; commit: (...changes: Change[]) => void };

export function Settings({ state, commit }: Props) {
  const settings = state.settings;
  const set = (patch: Partial<SettingsT>) => commit({ type: "settings", settings: patch });
  const setOffset = (phase: Phase, offset: number) => set({ phaseOffsets: { ...settings.phaseOffsets, [phase]: offset } });

  return (
    <div className="flex flex-col gap-6">
      <Section title="Targets">
        <Row label="Maintenance" unit="kcal">
          <NumberInput value={settings.tdee} onCommit={(tdee) => set({ tdee })} className="w-20 text-right" />
        </Row>
        {(["cut", "maintain", "bulk"] as Phase[]).map((phase) => (
          <Row key={phase} label={phase} unit="kcal" hint={`= ${settings.tdee + settings.phaseOffsets[phase]}`}>
            <NumberInput value={settings.phaseOffsets[phase]} onCommit={(offset) => setOffset(phase, offset)} className="w-20 text-right" />
          </Row>
        ))}
        <Row label="Protein" unit="g/kg">
          <NumberInput value={settings.proteinPerKg} onCommit={(proteinPerKg) => set({ proteinPerKg })} className="w-20 text-right" />
        </Row>
        <Row label="Sugar limit" unit="% kcal">
          <NumberInput value={settings.sugarPct} onCommit={(sugarPct) => set({ sugarPct })} className="w-20 text-right" />
        </Row>
        <Row label="Steps" unit="kcal/1k">
          <NumberInput value={settings.kcalPer1kSteps} onCommit={(kcalPer1kSteps) => set({ kcalPer1kSteps })} className="w-20 text-right" />
        </Row>
      </Section>

      <Containers state={state} set={set} />
    </div>
  );
}

function Containers({ state, set }: { state: State; set: (patch: Partial<SettingsT>) => void }) {
  const { containers } = state.settings;
  const [name, setName] = useState("");
  const [grams, setGrams] = useState("");
  const weight = Number(grams.replace(",", "."));
  const valid = name.trim() !== "" && weight > 0;

  const add = () => {
    if (!valid) return;
    set({ containers: [...containers, { id: newId(), name: name.trim(), grams: weight }] });
    setName("");
    setGrams("");
  };

  return (
    <Section title="Containers">
      {containers.map((c) => (
        <Row key={c.id} label={c.name} unit="g">
          <span className="w-20 text-right">{c.grams}</span>
          <button
            onClick={() => set({ containers: containers.filter((other) => other.id !== c.id) })}
            aria-label={`Remove ${c.name}`}
            className="-mr-1 px-1 text-muted"
          >
            ×
          </button>
        </Row>
      ))}
      <div className="flex items-center gap-2 px-4 py-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="name" className="min-w-0 flex-1 bg-transparent outline-none" />
        <input
          value={grams}
          inputMode="decimal"
          onChange={(e) => setGrams(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="grams"
          className="w-20 bg-transparent text-right outline-none"
        />
        <button disabled={!valid} onClick={add} className="text-accent disabled:opacity-40">
          Add
        </button>
      </div>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-medium tracking-wide text-muted uppercase">{title}</h2>
      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">{children}</div>
    </section>
  );
}

function Row({ label, unit, hint, children }: { label: string; unit: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 px-4 py-2.5">
      <span className="flex-1 capitalize">{label}</span>
      {hint && <span className="text-sm text-muted">{hint}</span>}
      {children}
      <span className="w-14 text-sm text-muted">{unit}</span>
    </label>
  );
}
