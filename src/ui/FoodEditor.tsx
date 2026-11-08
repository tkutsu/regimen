import { useId, useRef, useState } from "react";
import { fromForm, readValue, toForm, type FoodForm, type ValueTexts } from "../domain/foodForm";
import { LABELS, NUTRIENTS } from "../domain/nutrition";
import { newId } from "../domain/state";
import type { Food } from "../domain/types";
import { Dialog } from "./Dialog";
import { blurOnEnter } from "./fields";
import { transition } from "./motion";

type Props = {
  food?: Food;
  groups: string[];
  /** Entries, recipe ingredients and staples that use the food. */
  uses: number;
  onSave: (food: Food) => void;
  onDelete?: () => void;
  onClose: () => void;
};

export const box = "rounded-xl border bg-surface px-3 py-2 outline-none focus:border-accent";
const border = (text: string) => (Number.isNaN(readValue(text)) ? "border-bad" : "border-line");

/** Edits a food, or creates one when none is given. Nothing is written until Save. */
export function FoodEditor({ food, groups, uses, onSave, onDelete, onClose }: Props) {
  const [id] = useState(() => food?.id ?? newId());
  const [form, setForm] = useState(() => toForm(food));
  const [confirming, setConfirming] = useState(false);
  const saved = fromForm(form, id);
  const patch = (changes: Partial<FoodForm>) => setForm({ ...form, ...changes });
  const setVariant = (i: number, changes: Partial<FoodForm["variants"][number]>) =>
    patch({ variants: form.variants.map((v, j) => (i === j ? { ...v, ...changes } : v)) });

  return (
    <Dialog label={food ? "Edit food" : "New food"} onClose={onClose}>
      <header className="flex items-center justify-between border-b border-line p-3">
        <button onClick={() => transition(onClose)} className="px-2 py-2 text-muted">
          Cancel
        </button>
        <h2 className="font-medium">{food ? "Edit food" : "New food"}</h2>
        <button disabled={!saved} onClick={() => saved && onSave(saved)} className="px-2 py-2 font-medium text-accent disabled:opacity-40">
          Save
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-md flex-col gap-5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2">
            <input
              autoFocus={!food}
              value={form.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Name"
              aria-label="Name"
              className={`${box} min-w-0 flex-1 border-line text-lg`}
            />
            <button
              onClick={() => patch({ fav: !form.fav })}
              aria-label="Favourite"
              aria-pressed={form.fav}
              className={`px-1 text-2xl ${form.fav ? "text-accent" : "text-line"}`}
            >
              ★
            </button>
          </div>

          <KeywordsField value={form.keywords} onChange={(keywords) => patch({ keywords })} />

          <div className="flex gap-2">
            <GroupInput
              value={form.group}
              onChange={(group) => patch({ group })}
              groups={groups}
            />
            <div className="flex gap-1 rounded-xl bg-line/50 p-1 text-sm">
              {(["100g", "item"] as const).map((basis) => (
                <button
                  key={basis}
                  onClick={() => patch({ basis })}
                  className={`rounded-lg px-3 ${form.basis === basis ? "bg-surface font-medium shadow-sm" : "text-muted"}`}
                >
                  {basis === "item" ? "per item" : "per 100 g"}
                </button>
              ))}
            </div>
          </div>

          <section>
            <Heading hint="blank = unknown">{form.basis === "item" ? "Per item" : "Per 100 g"}</Heading>
            <ValueFields values={form.values} onChange={(values) => patch({ values })} />
            {food && uses > 0 && <p className="mt-2 text-xs text-muted">Changes apply from today on; earlier days keep these values.</p>}
          </section>

          <section>
            <Heading hint="base values × factor = new values">Variants</Heading>
            <p className="mb-3 text-xs text-muted">
              A variant multiplies every nutrient value by its factor. For example, 100 kcal with a factor of 2.4 becomes 240 kcal per {form.basis === "item" ? "item" : "100 g"}.
              {" "}Choose the variant when adding this food.
            </p>
            <div className="flow flex flex-col gap-2">
              {form.variants.map((variant, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={variant.name}
                    onChange={(e) => setVariant(i, { name: e.target.value })}
                    placeholder="raw"
                    aria-label="Variant name"
                    className={`${box} min-w-0 flex-1 border-line`}
                  />
                  <span className="text-muted">×</span>
                  <input
                    inputMode="decimal"
                    value={variant.factor}
                    onChange={(e) => setVariant(i, { factor: e.target.value })}
                    onKeyDown={blurOnEnter}
                    placeholder="2.4"
                    aria-label="Variant factor"
                    className={`${box} w-20 text-right ${border(variant.factor)}`}
                  />
                  <button
                    onClick={() => patch({ variants: form.variants.filter((_, j) => j !== i) })}
                    aria-label="Remove variant"
                    className="shrink-0 p-2 text-muted"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" />
                    </svg>
                  </button>
                </div>
              ))}
              <button onClick={() => patch({ variants: [...form.variants, { name: "", factor: "" }] })} className="self-start text-sm text-accent">
                + Add variant
              </button>
            </div>
          </section>

          <section>
            <Heading>Note</Heading>
            <textarea
              value={form.note}
              onChange={(e) => patch({ note: e.target.value })}
              rows={3}
              className={`${box} w-full resize-y border-line text-sm`}
            />
          </section>

          {food && onDelete && (
            <div className="flex flex-col gap-2">
              {uses > 0 && (
                <p className="text-center text-sm text-muted">
                  Used {uses} {uses === 1 ? "time" : "times"} in your log, recipes or staples.
                </p>
              )}
              <p className="text-center text-sm text-muted">Deleting it keeps existing logs, recipes and staples.</p>
              <button onClick={() => (confirming ? onDelete() : setConfirming(true))} className="rounded-xl border border-line py-3 text-bad">
                {confirming ? "Tap again to delete" : "Delete food"}
              </button>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}

/** Other names a food or recipe can be searched by. */
export function KeywordsField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      Search keywords
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="κοτόπουλο, στήθος, poultry"
        rows={2}
        className={`${box} w-full resize-y border-line`}
      />
      <span className="text-xs text-muted">Separate names and terms with commas. Include the Greek name here.</span>
    </label>
  );
}

/** Suggestions stay in the page: Android's native datalist can lose its background while editing. */
export function GroupInput({ value, onChange, groups }: { value: string; onChange: (value: string) => void; groups: string[] }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const matches = groups.filter((group) => group.toLowerCase().includes(value.trim().toLowerCase()));
  const shown = open && matches.length > 0;
  const choose = (group: string) => {
    onChange(group);
    input.current?.focus();
    setOpen(false);
    setActive(-1);
  };
  return (
    <div className="relative min-w-0 flex-1" onBlur={(e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
    }}>
      <input
        ref={input}
        role="combobox"
        aria-label="Group"
        aria-expanded={shown}
        aria-controls={id}
        aria-autocomplete="list"
        aria-activedescendant={shown && active >= 0 ? `${id}-${active}` : undefined}
        autoComplete="off"
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
        onKeyDown={(e) => {
          if ((e.key === "ArrowDown" || e.key === "ArrowUp") && matches.length) {
            e.preventDefault();
            setOpen(true);
            const next = active < 0 ? (e.key === "ArrowDown" ? 0 : matches.length - 1) : (active + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length;
            setActive(next);
            document.getElementById(`${id}-${next}`)?.scrollIntoView({ block: "nearest" });
          } else if (e.key === "Enter" && shown && active >= 0) {
            e.preventDefault();
            choose(matches[active]);
          } else if (e.key === "Escape" && shown) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }
        }}
        placeholder="Group"
        className={`${box} w-full border-line`}
      />
      {shown && (
        <div id={id} role="listbox" aria-label="Groups" className="absolute inset-x-0 top-full z-20 mt-1 max-h-40 overflow-y-auto rounded-xl border border-line bg-surface py-1 text-fg shadow-lg">
          {matches.map((group, index) => (
            <button key={group} id={`${id}-${index}`} role="option" aria-selected={active === index} tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()} onClick={() => choose(group)}
              className={`block w-full px-3 py-2 text-left ${active === index ? "bg-line" : "hover:bg-line"}`}>
              {group}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Nutrients typed one by one; blank is unknown, kcal is required. */
export function ValueFields({ values, onChange }: { values: ValueTexts; onChange: (values: ValueTexts) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {NUTRIENTS.map((key) => (
        <label key={key} className={`${box} ${border(values[key])}`}>
          <span className="block text-xs text-muted">
            {LABELS[key]}
            {key !== "kcal" && " (g)"}
          </span>
          <input
            inputMode="decimal"
            value={values[key]}
            onChange={(e) => onChange({ ...values, [key]: e.target.value })}
            onKeyDown={blurOnEnter}
            placeholder={key === "kcal" ? "required" : "?"}
            className="w-full bg-transparent text-lg outline-none placeholder:text-muted/50"
          />
        </label>
      ))}
    </div>
  );
}

export function Heading({ hint, children }: { hint?: string; children: React.ReactNode }) {
  return (
    <h3 className="mb-2 flex justify-between px-1 text-xs text-muted">
      <span className="font-medium tracking-wide uppercase">{children}</span>
      {hint}
    </h3>
  );
}
