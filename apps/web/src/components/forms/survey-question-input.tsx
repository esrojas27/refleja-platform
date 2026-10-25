import { AGREEMENT_OPTIONS, EMOTION_OPTIONS, LIKELIHOOD_OPTIONS, NUMERIC_SCALE_OPTIONS,
  hasCustomOptions, type FormQuestion } from "@/lib/forms/question-catalog";
import { SingleChoiceOptions } from "./single-choice-options";

/** Shared answer controls; workflow/submission remains with the enclosing form. */
export function SurveyQuestionInput({ question, selected, disabled, onChange }: {
  question: FormQuestion; selected: string[]; disabled: boolean; onChange: (values: string[]) => void;
}) {
  const id = `survey-question-${question.id}`;
  if (question.type === "OPEN_TEXT") return <textarea id={id} aria-label={`Respuesta a ${question.prompt}`}
    className="rti-field mt-3 min-h-28 resize-y" maxLength={5000} value={selected[0] ?? ""}
    onChange={event => onChange([event.target.value])} disabled={disabled} />;
  if (hasCustomOptions(question.type)) return <div id={id} tabIndex={-1} className="mt-3">
    <SingleChoiceOptions id={question.id} options={question.options ?? []} words={question.type === "SINGLE_CHOICE_WORDS"}
      selected={selected[0]} disabled={disabled} onChange={value => onChange([value])} />
    <p className="mt-2 text-xs text-muted-foreground">Selecciona una sola opción.</p>
  </div>;
  if (question.type === "EMOTION_MULTI_SELECT") return <div id={id} tabIndex={-1} className="mt-3">
    <div className="flex flex-wrap gap-2">{EMOTION_OPTIONS.map(option => <label key={option}
      className={`cursor-pointer rounded-full border px-3 py-2 text-sm transition focus-within:ring-2 focus-within:ring-ring ${selected.includes(option)
        ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}>
      <input type="checkbox" className="sr-only" checked={selected.includes(option)}
        disabled={disabled || (!selected.includes(option) && selected.length >= 2)}
        onChange={() => onChange(selected.includes(option) ? selected.filter(value => value !== option) : [...selected, option])} />{option}
    </label>)}</div>
    <p className="mt-2 text-xs text-muted-foreground">Selecciona una o máximo dos emociones.</p>
  </div>;
  const options = question.type === "AGREEMENT_SCALE" ? AGREEMENT_OPTIONS : question.type === "LIKELIHOOD_SCALE" ? LIKELIHOOD_OPTIONS : NUMERIC_SCALE_OPTIONS;
  const numeric = question.type === "NUMERIC_SCALE";
  return <div id={id} tabIndex={-1} className="mt-3">
    {!numeric && <ol className="hidden space-y-1.5 rounded-xl bg-muted/55 px-4 py-3 text-sm sm:block">
      {options.map((option, index) => <li key={option} className="flex gap-2"><span className="font-semibold text-primary">{index + 1}.</span><span>{option}</span></li>)}
    </ol>}
    <div className={`grid gap-2 sm:grid-cols-5 sm:gap-3 ${numeric ? "grid-cols-5" : "sm:mt-3"}`}>{options.map((option, index) => {
      const value = String(index + 1);
      return <label key={option} className={`cursor-pointer rounded-xl border px-2 py-3 text-center text-xs transition focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${selected[0] === value
        ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/60 hover:bg-accent/40"}`}>
        <input type="radio" className="sr-only" name={`survey-${question.id}`} value={value} checked={selected[0] === value}
          disabled={disabled} onChange={() => onChange([value])} />
        <span className="block text-lg font-semibold">{value}</span>{!numeric && <span className="sm:hidden">{option}</span>}
      </label>;
    })}</div>
  </div>;
}
