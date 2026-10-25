import { optionLetter } from "@/lib/forms/question-catalog";

export function SingleChoiceOptions({ id, options, words, selected, disabled, onChange }: {
  id: string; options: string[]; words: boolean; selected?: string; disabled: boolean; onChange: (value: string) => void;
}) {
  return <div className={words ? "flex flex-wrap gap-2" : "grid gap-2"}>
    {options.map((option, index) => <label key={index}
      className={`relative flex min-w-0 cursor-pointer items-center gap-3 border px-4 py-3 text-sm transition focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${words ? "max-w-full rounded-full" : "rounded-xl"} ${selected === option
        ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-accent/40"} ${disabled ? "cursor-not-allowed opacity-70" : ""}`}>
      <input type="radio" className={words ? "absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed" : "size-4 shrink-0 accent-primary"}
        name={`survey-${id}`} value={option} checked={selected === option} disabled={disabled} onChange={() => onChange(option)} />
      {!words && <span aria-hidden="true" className="font-semibold">{optionLetter(index)}.</span>}
      <span className="min-w-0 break-words [overflow-wrap:anywhere]">{option}</span>
    </label>)}
  </div>;
}

export function SingleChoicePreview({ options, words }: { options: string[]; words: boolean }) {
  return <ol className={`mt-3 max-h-64 overflow-y-auto ${words ? "flex flex-wrap gap-2" : "space-y-2"}`}>
    {options.map((option, index) => <li key={index} className={`min-w-0 max-w-full border border-border bg-card px-3 py-2 text-sm ${words ? "rounded-full" : "flex gap-3 rounded-xl"}`}>
      {!words && <span className="shrink-0 font-semibold">{optionLetter(index)}.</span>}
      <span className="break-words [overflow-wrap:anywhere]">{option}</span>
    </li>)}
  </ol>;
}
