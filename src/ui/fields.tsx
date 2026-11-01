import { useState } from "react";

/**
 * Edits locally and commits on blur or Enter, so typing doesn't write an event per
 * keystroke. With `optional`, clearing the field commits undefined. `format` only
 * changes how the value reads while it isn't being edited.
 */
function useDraft(
  value: number | undefined,
  onCommit: (value: number | undefined) => void,
  optional = false,
  format: (value: number) => string = String,
  parse: (text: string, current?: number) => number | undefined = readNumber,
) {
  const [draft, setDraft] = useState<string>();
  const commit = () => {
    const text = (draft ?? "").trim();
    const parsed = text ? parse(text, value) : undefined;
    if (draft !== undefined && !text && optional && value !== undefined) onCommit(undefined);
    else if (parsed !== undefined && parsed !== value) onCommit(parsed);
    setDraft(undefined);
  };
  return {
    inputMode: "decimal" as const,
    value: draft ?? (value === undefined ? "" : format(value)),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value),
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => e.target.select(),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && e.currentTarget.blur(),
  };
}

function readNumber(text: string) {
  const parsed = Number(text.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

type Props = {
  value: number | undefined;
  onCommit: (value: number) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
};

export function NumberInput({ value, onCommit, format, placeholder, className = "", "aria-label": label }: Props & { format?: (value: number) => string }) {
  return (
    <input
      {...useDraft(value, (v) => v !== undefined && onCommit(v), false, format)}
      placeholder={placeholder}
      aria-label={label}
      className={`bg-transparent outline-none ${className}`}
    />
  );
}

type Optional = Omit<Props, "onCommit"> & {
  onCommit: (value?: number) => void;
  format?: (value: number) => string;
  /** Reads what was typed, given the value before; undefined leaves the value as it was. */
  parse?: (text: string, current?: number) => number | undefined;
};

/** A number that may be left blank. */
export function OptionalNumberInput({ value, onCommit, format, parse, placeholder, className = "", "aria-label": label }: Optional) {
  return <input {...useDraft(value, onCommit, true, format, parse)} placeholder={placeholder} aria-label={label} className={`bg-transparent outline-none ${className}`} />;
}

export function NumberField({ label, ...props }: Props & { label: string }) {
  return (
    <label className="rounded-xl border border-line bg-surface px-3 py-2">
      <span className="block text-xs text-muted">{label}</span>
      <NumberInput {...props} className="w-full text-lg placeholder:text-muted/50" />
    </label>
  );
}

/** Text that commits on blur or Enter, like NumberInput. Blank leaves it as it was. */
export function TextInput({ value, onCommit, placeholder, className = "", "aria-label": label }: { value: string; onCommit: (value: string) => void; placeholder?: string; className?: string; "aria-label"?: string }) {
  const [draft, setDraft] = useState<string>();
  const commit = () => {
    const text = draft?.trim();
    if (text && text !== value) onCommit(text);
    setDraft(undefined);
  };
  return (
    <input
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      placeholder={placeholder}
      aria-label={label}
      className={`bg-transparent outline-none ${className}`}
    />
  );
}

export function Remove({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={`Remove ${label}`} className="-mr-1 w-6 text-center text-lg leading-none text-muted">
      ×
    </button>
  );
}

/** A titled card of rows. */
export function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 flex items-baseline justify-between px-1 text-xs font-medium tracking-wide text-muted uppercase">
        {title}
        {aside}
      </h2>
      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">{children}</div>
    </section>
  );
}
