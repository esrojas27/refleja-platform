"use client";

import { CheckCircle2 } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { SurveyQuestionInput } from "@/components/forms/survey-question-input";
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
      return <li key={question.id} className="rounded-xl border border-border/70 bg-card p-4">
        <fieldset aria-invalid={fieldInvalid || undefined} aria-describedby={fieldInvalid ? `survey-error-${question.id}` : undefined}>
          <legend className="font-medium"><span className="mr-2 text-primary">{index + 1}.</span>{question.prompt}</legend>
          <SurveyQuestionInput question={question} selected={selected} disabled={pending} onChange={values => setAnswer(question.id, values)} />
          {fieldInvalid && <p id={`survey-error-${question.id}`} className="mt-2 text-sm text-destructive">Esta pregunta es obligatoria.</p>}
        </fieldset>
      </li>;
    })}</ol>
    {message && <p role="status" className="mt-4 rounded-xl bg-muted/70 px-3 py-2 text-sm">{message}</p>}
    <button className="rti-button-primary mt-5" disabled={pending}>{pending ? "Enviando…" : "Enviar encuesta"}</button>
  </form>;
}
