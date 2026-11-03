import { useEffect, useId, useRef, useState } from "react";

/** Enter finishes a field through its normal blur path. */
export function blurOnEnter(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
  e.preventDefault();
  e.currentTarget.blur();
}

/**
 * Edits locally and commits on blur or Enter, so typing doesn't write an event per
 * keystroke. Clearing commits 0, or undefined with `optional`. `format` only
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
    if (draft === undefined) return;
    const text = draft.trim();
    const parsed = text ? parse(text, value) : optional ? undefined : 0;
    if (!text && optional && value !== undefined) onCommit(undefined);
    else if (parsed !== undefined && parsed !== value) onCommit(parsed);
    setDraft(undefined);
  };
  return {
    inputMode: "decimal" as const,
    value: draft ?? (value === undefined ? "" : format(value)),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value),
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => e.target.select(),
    onBlur: commit,
    onKeyDown: blurOnEnter,
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

/**
 * A labelled number with its unit right after it. The input is as wide as what it shows,
 * measured by an invisible copy of the text, so the unit follows the number.
 */
export function NumberField({ label, unit, value, onCommit, placeholder, hint }: Omit<Props, "className" | "aria-label"> & { label: string; unit: string; hint?: string }) {
  const draft = useDraft(value, (v) => v !== undefined && onCommit(v));
  const id = useId();
  return (
    <div className="relative rounded-xl border border-line bg-surface px-3 py-2">
      {hint ? (
        <Info id={id} label={label} hint={hint} className="relative -mx-3 -mt-2">
          <span className="text-xs">{label}</span>
        </Info>
      ) : <label htmlFor={`${id}-input`} className="block text-xs text-muted">{label}</label>}
      <span className="flex items-baseline text-lg">
        <span className="inline-grid min-w-0">
          <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-pre">
            {draft.value || placeholder || ""}
          </span>
          <input {...draft} id={`${id}-input`} aria-label={label} placeholder={placeholder} aria-describedby={hint ? id : undefined} className="col-start-1 row-start-1 w-0 min-w-full bg-transparent outline-none placeholder:text-muted/50" />
        </span>
        <span className="text-sm text-muted">{unit}</span>
      </span>
    </div>
  );
}

/** Opens help on hover, focus or tap; Escape, blur and an outside tap dismiss it. */
export function Info({ id, label, hint, className = "relative", wide = false, children }: { id?: string; label: string; hint: string; className?: string; wide?: boolean; children?: React.ReactNode }) {
  const generatedId = useId();
  const helpId = id ?? generatedId;
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const pinned = useRef(false);
  const close = () => { pinned.current = false; setOpen(false); };

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) close(); };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); close(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <span
      ref={root}
      className={`${children ? "flex" : "inline-flex"} shrink-0 font-normal tracking-normal normal-case ${className}`}
      onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
      onPointerLeave={() => { if (!pinned.current && !root.current?.contains(document.activeElement)) setOpen(false); }}
    >
      <button
        type="button"
        aria-label={`About ${label}`}
        aria-expanded={open}
        aria-controls={helpId}
        aria-describedby={helpId}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onClick={() => { pinned.current = !pinned.current; setOpen(pinned.current); }}
        className={`flex min-h-11 items-center gap-2 rounded-lg text-muted outline-none hover:text-accent focus-visible:ring-2 focus-visible:ring-accent ${children ? "w-full justify-between px-3 text-left" : "min-w-11 justify-center"}`}
      >
        {children}
        <svg aria-hidden viewBox="0 0 20 20" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="10" cy="10" r="7.5" />
          <path d="M10 9v5M10 6v.1" />
        </svg>
      </button>
      <span id={helpId} role="tooltip" hidden={!open} className={`absolute top-full right-0 z-[3] max-w-[calc(100vw-2rem)] pt-1 ${wide ? "w-64" : "w-36"}`}>
        <span className="block rounded-xl border border-line bg-surface p-3 text-left text-xs text-muted shadow-lg">{hint}</span>
      </span>
    </span>
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
      onKeyDown={blurOnEnter}
      placeholder={placeholder}
      aria-label={label}
      className={`bg-transparent outline-none ${className}`}
    />
  );
}

/** A circle that fills with the accent and a black tick when done. */
export function Tick({ done, label, onClick, className = "size-5" }: { done: boolean; label: string; onClick: () => void; className?: string }) {
  return (
    <button onClick={onClick} aria-label={label} className={`${className} shrink-0 rounded-full border-2 transition-colors ${done ? "border-accent bg-accent" : "border-line"}`}>
      {done && (
        <svg viewBox="0 0 16 16" aria-hidden className="block size-full" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.5l3 3 6-6.5" />
        </svg>
      )}
    </button>
  );
}

/** A favourite toggle at the start of a food's row; className gives it the row's padding. */
export function Star({ fav, name, onToggle, className }: { fav: boolean; name: string; onToggle: () => void; className: string }) {
  return (
    <button onClick={onToggle} aria-label={`Favourite ${name}`} aria-pressed={fav} className={`shrink-0 transition-colors ${className} ${fav ? "text-accent" : "text-line"}`}>
      ★
    </button>
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
      <div className="flow divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">{children}</div>
    </section>
  );
}
