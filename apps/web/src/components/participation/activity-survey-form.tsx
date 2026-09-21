"use client";

import { CheckCircle2 } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { AGREEMENT_OPTIONS, EMOTION_OPTIONS, LIKELIHOOD_OPTIONS } from "@/lib/participation/evaluation-api";
import { activityErrorMessage, submitMyActivitySurvey, type ActivitySurvey,
  type ActivitySurveySubmission } from "@/lib/participation/activity-api";

export function ActivitySurveyForm({ programId, activityId, survey, onCompleted }: {
  programId: string; activityId: string; survey: ActivitySurvey;
  onCompleted: (submission: ActivitySurveySubmission) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [invalid, setInvalid] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const submitting = useRef(false);

  function setAnswer(questionId: string, values: string[]) {
    setAnswers(current => ({ ...current, [questionId]: values }));
    setInvalid(current => current.filter(id => id !== questionId));
  }

  function toggleEmotion(questionId: string, value: string) {
    const selected = answers[questionId] ?? [];
    setAnswer(questionId, selected.includes(value)
      ? selected.filter(item => item !== value)
      : selected.length < 2 ? [...selected, value] : selected);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const missing = survey.questions.filter(question => {
      const values = answers[question.id] ?? [];
      return values.length === 0 || values.some(value => !value.trim());
    }).map(question => question.id);
    if (missing.length) {
      setInvalid(missing); setMessage("Responde todas las preguntas antes de enviar la encuesta.");
      window.setTimeout(() => document.getElementById(`survey-question-${missing[0]}`)?.focus(), 0);
      return;
    }
    submitting.current = true; setPending(true); setMessage("Enviando encuesta…");
    try {
      const submission = await submitMyActivitySurvey(programId, activityId,
        survey.questions.map(question => ({ questionId: question.id,
          values: (answers[question.id] ?? []).map(value => value.trim()) })));
      setMessage("Encuesta completada. Tu actividad ahora está al 100%.");
      onCompleted(submission);
    } catch (error) {
      setMessage(activityErrorMessage(error));
    } finally { submitting.current = false; setPending(false); }
  }

  return <form aria-label={`Completar encuesta de ${survey.title}`} onSubmit={submit} noValidate
    className="mt-5 rounded-2xl border border-primary/20 bg-accent/25 p-4 sm:p-5">
    <div className="flex items-start gap-3">
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <CheckCircle2 aria-hidden="true" className="size-5" />
      </span>
      <div><p className="rti-kicker">Segundo paso · 50%</p>
        <h4 className="mt-1 text-lg font-semibold">{survey.title}</h4>
        {survey.instructions && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{survey.instructions}</p>}
      </div>
    </div>
    <ol className="mt-5 space-y-5">{survey.questions.map((question, index) => {
      const selected = answers[question.id] ?? [];
      const fieldInvalid = invalid.includes(question.id);
      const options = question.type === "AGREEMENT_SCALE" ? AGREEMENT_OPTIONS
        : question.type === "LIKELIHOOD_SCALE" ? LIKELIHOOD_OPTIONS : [];
      return <li key={question.id} className="rounded-xl border border-border/70 bg-card p-4">
        <fieldset aria-invalid={fieldInvalid || undefined}>
          <legend className="font-medium"><span className="mr-2 text-primary">{index + 1}.</span>{question.prompt}</legend>
          {question.type === "OPEN_TEXT" ? <textarea id={`survey-question-${question.id}`}
            aria-label={`Respuesta a ${question.prompt}`} className="rti-field mt-3 min-h-28 resize-y" maxLength={5000}
            value={selected[0] ?? ""} onChange={event => setAnswer(question.id, [event.target.value])}
            disabled={pending} /> : question.type === "EMOTION_MULTI_SELECT" ? <div id={`survey-question-${question.id}`}
              tabIndex={-1} className="mt-3 flex flex-wrap gap-2">
              {EMOTION_OPTIONS.map(option => <label key={option}
                className={`cursor-pointer rounded-full border px-3 py-2 text-sm transition ${selected.includes(option)
                  ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}>
                <input type="checkbox" className="sr-only" checked={selected.includes(option)}
                  disabled={pending || (!selected.includes(option) && selected.length >= 2)}
                  onChange={() => toggleEmotion(question.id, option)} />{option}
              </label>)}</div> : <div id={`survey-question-${question.id}`} tabIndex={-1} className="mt-3">
                <ol className="hidden space-y-1.5 rounded-xl bg-muted/55 px-4 py-3 text-sm sm:block">
                  {options.map((option, optionIndex) => <li key={option} className="flex gap-2">
                    <span className="font-semibold text-primary">{optionIndex + 1}.</span>
                    <span>{option}</span>
                  </li>)}
                </ol>
                <div className="grid gap-2 sm:mt-3 sm:grid-cols-5 sm:gap-3">{options.map((option, optionIndex) => {
                  const value = String(optionIndex + 1);
                  const active = selected[0] === value;
                  return <label key={option} className={`cursor-pointer rounded-xl border p-3 text-center text-xs transition ${active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:border-primary/60 hover:bg-accent/40"}`}>
                    <input type="radio" className="sr-only" name={`survey-${question.id}`} value={value}
                      checked={active} disabled={pending}
                      onChange={() => setAnswer(question.id, [value])} />
                    <span className="block text-lg font-semibold">{value}</span>
                    <span className="sm:hidden">{option}</span>
                  </label>;
                })}</div>
              </div>}
          {question.type === "EMOTION_MULTI_SELECT" && <p className="mt-2 text-xs text-muted-foreground">Selecciona una o máximo dos emociones.</p>}
          {fieldInvalid && <p className="mt-2 text-sm text-destructive">Esta pregunta es obligatoria.</p>}
        </fieldset>
      </li>;
    })}</ol>
    {message && <p role="status" className="mt-4 rounded-xl bg-muted/70 px-3 py-2 text-sm">{message}</p>}
    <button className="rti-button-primary mt-5" disabled={pending}>{pending ? "Enviando…" : "Enviar encuesta"}</button>
  </form>;
}
