import { useState } from "react";

/**
 * Edits locally and commits on blur or Enter, so typing doesn't write an event per
 * keystroke. With `optional`, clearing the field commits undefined.
 */
function useDraft(value: number | undefined, onCommit: (value: number | undefined) => void, optional = false) {
  const [draft, setDraft] = useState<string>();
  const commit = () => {
    const text = (draft ?? "").trim();
    const parsed = Number(text.replace(",", "."));
    if (draft !== undefined && !text && optional && value !== undefined) onCommit(undefined);
    else if (text && Number.isFinite(parsed) && parsed !== value) onCommit(parsed);
    setDraft(undefined);
  };
  return {
    inputMode: "decimal" as const,
    value: draft ?? (value === undefined ? "" : String(value)),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value),
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => e.target.select(),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && e.currentTarget.blur(),
  };
}

type Props = {
  value: number | undefined;
  onCommit: (value: number) => void;
  placeholder?: string;
  className?: string;
};

export function NumberInput({ value, onCommit, placeholder, className = "" }: Props) {
  return <input {...useDraft(value, (v) => v !== undefined && onCommit(v))} placeholder={placeholder} className={`bg-transparent outline-none ${className}`} />;
}

/** A number that may be left blank. */
export function OptionalNumberInput({ value, onCommit, placeholder, className = "" }: Omit<Props, "onCommit"> & { onCommit: (value?: number) => void }) {
  return <input {...useDraft(value, onCommit, true)} placeholder={placeholder} className={`bg-transparent outline-none ${className}`} />;
}

export function NumberField({ label, ...props }: Props & { label: string }) {
  return (
    <label className="rounded-xl border border-line bg-surface px-3 py-2">
      <span className="block text-xs text-muted">{label}</span>
      <NumberInput {...props} className="w-full text-lg placeholder:text-muted/50" />
    </label>
  );
}
