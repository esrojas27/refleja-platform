"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AGREEMENT_OPTIONS, createActivityEvaluation, EMOTION_OPTIONS, evaluationErrorMessage,
  EvaluationRequestError, LIKELIHOOD_OPTIONS, type ActivityEvaluation, type EvaluationQuestionType,
} from "@/lib/participation/evaluation-api";

type DraftQuestion = { key: number; prompt: string; type: EvaluationQuestionType };
const TYPE_LABELS: Record<EvaluationQuestionType, string> = {
  AGREEMENT_SCALE: "Escala · Nivel de acuerdo",
  LIKELIHOOD_SCALE: "Escala · Probabilidad",
  OPEN_TEXT: "Respuesta abierta",
  EMOTION_MULTI_SELECT: "Emociones · Máximo 2",
};

export function ActivityEvaluationForm({ organizationId, programId, activityId, activityTitle, onSaved }: {
  organizationId: string; programId: string; activityId: string; activityTitle: string;
  onSaved: (evaluation: ActivityEvaluation) => void;
}) {
  const nextKey = useRef(1);
  const request = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  const [title, setTitle] = useState(`Encuesta posterior · ${activityTitle}`);
  const [instructions, setInstructions] = useState("Responde estas preguntas desde tu experiencia con la actividad.");
  const [questions, setQuestions] = useState<DraftQuestion[]>([
    { key: 0, prompt: "", type: "AGREEMENT_SCALE" },
  ]);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => () => request.current?.abort(), []);

  function addQuestion() {
    if (questions.length >= 20) return;
    const key = nextKey.current++;
    setQuestions(current => [...current, { key, prompt: "", type: "OPEN_TEXT" }]);
    window.setTimeout(() => document.getElementById(`evaluation-question-${key}-prompt`)?.focus(), 0);
  }
  function updateQuestion(key: number, patch: Partial<DraftQuestion>) {
    setQuestions(current => current.map(question => question.key === key ? { ...question, ...patch } : question));
    setInvalid(current => current.filter(field => field !== `question-${key}` && field !== "questions"));
  }
  function removeQuestion(key: number) {
    setQuestions(current => current.filter(question => question.key !== key));
    setInvalid(current => current.filter(field => field !== `question-${key}`));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || blocked) return;
    const cleanTitle = title.trim();
    const cleanInstructions = instructions.trim();
    const missing = [
      ...(!cleanTitle || cleanTitle.length > 255 ? ["title"] : []),
      ...(cleanInstructions.length > 2000 ? ["instructions"] : []),
      ...(questions.length === 0 ? ["questions"] : []),
      ...questions.filter(question => !question.prompt.trim() || question.prompt.trim().length > 500)
        .map(question => `question-${question.key}`),
    ];
    if (missing.length) {
      setInvalid(missing); setMessage("Revisa los campos resaltados antes de crear la encuesta.");
      window.setTimeout(() => document.getElementById(missing[0] === "title" ? "evaluation-title"
        : missing[0] === "instructions" ? "evaluation-instructions"
          : missing[0] === "questions" ? "evaluation-add-question" : `evaluation-${missing[0]}-prompt`)?.focus(), 0);
      return;
    }
    submitting.current = true; setPending(true); setMessage("Creando encuesta…");
    const controller = new AbortController(); request.current = controller;
    try {
      const saved = await createActivityEvaluation(organizationId, programId, activityId, {
        title: cleanTitle, instructions: cleanInstructions || null,
        questions: questions.map((question, index) => ({
          prompt: question.prompt.trim(), type: question.type, position: index + 1,
        })),
      }, controller.signal);
      if (!controller.signal.aborted) { setBlocked(true); setMessage("Encuesta creada."); onSaved(saved); }
    } catch (error) {
      if (!controller.signal.aborted) {
        const failure = error instanceof EvaluationRequestError ? error : new EvaluationRequestError(0);
        setInvalid(failure.fields.includes("title") ? ["title"] : failure.fields.includes("instructions")
          ? ["instructions"] : failure.fields.length ? ["questions"] : []);
        setBlocked(failure.status === 0 || failure.status >= 500 || [401, 403, 404, 409].includes(failure.status));
        setMessage(evaluationErrorMessage(failure));
      }
    } finally { submitting.current = false; if (!controller.signal.aborted) setPending(false); }
  }

  return <form aria-label="Crear encuesta" onSubmit={submit} noValidate className="space-y-6">
    <div><p className="rti-kicker">Después de la actividad</p>
      <h2 id="create-evaluation-title" className="mt-2 text-2xl font-semibold">Crear encuesta</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">El colaborador responderá esta encuesta después de realizar la actividad.</p></div>
    {message && <p role="status" className="rounded-xl bg-muted/60 px-3 py-2 text-sm">{message}</p>}
    <div><label htmlFor="evaluation-title" className="block text-sm font-medium">Nombre de la encuesta</label>
      <input id="evaluation-title" className="rti-field" maxLength={255} value={title}
        aria-invalid={invalid.includes("title") || undefined}
        aria-describedby={invalid.includes("title") ? "evaluation-title-error" : undefined}
        onChange={event => { setTitle(event.target.value); setInvalid(current => current.filter(field => field !== "title")); }}
        disabled={pending || blocked} />
      {invalid.includes("title") && <p id="evaluation-title-error" className="mt-1 text-sm text-destructive">Escribe un nombre de hasta 255 caracteres.</p>}</div>
    <div><label htmlFor="evaluation-instructions" className="block text-sm font-medium">Indicaciones opcionales</label>
      <textarea id="evaluation-instructions" className="rti-field min-h-24 resize-y" maxLength={2000} value={instructions}
        aria-invalid={invalid.includes("instructions") || undefined}
        aria-describedby={invalid.includes("instructions") ? "evaluation-instructions-error" : undefined}
        onChange={event => { setInstructions(event.target.value); setInvalid(current => current.filter(field => field !== "instructions")); }}
        disabled={pending || blocked} />
      {invalid.includes("instructions") && <p id="evaluation-instructions-error" className="mt-1 text-sm text-destructive">Usa máximo 2.000 caracteres.</p>}</div>

    <section aria-labelledby="evaluation-questions-title" className="space-y-4">
      <div><h3 id="evaluation-questions-title" className="text-lg font-semibold">Preguntas</h3>
        <p className="mt-1 text-sm text-muted-foreground">Puedes agregar hasta 20 preguntas.</p></div>
      {invalid.includes("questions") && <p className="text-sm text-destructive">Agrega al menos una pregunta válida.</p>}
      <ol className="space-y-5">{questions.map((question, index) => {
        const fieldInvalid = invalid.includes(`question-${question.key}`);
        return <li key={question.key} className="rounded-2xl border border-border/70 bg-background/70 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3"><p className="rti-kicker">Pregunta {index + 1}</p>
            {questions.length > 1 && <button type="button" aria-label={`Eliminar pregunta ${index + 1}`}
              className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
              onClick={() => removeQuestion(question.key)} disabled={pending || blocked}>
              <Trash2 aria-hidden="true" className="size-4" />
            </button>}</div>
          <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(13rem,0.55fr)]">
            <div><label htmlFor={`evaluation-question-${question.key}-prompt`} className="block text-sm font-medium">Enunciado</label>
              <textarea id={`evaluation-question-${question.key}-prompt`} className="rti-field min-h-24 resize-y"
                maxLength={500} value={question.prompt} aria-invalid={fieldInvalid || undefined}
                aria-describedby={fieldInvalid ? `evaluation-question-${question.key}-error` : undefined}
                onChange={event => updateQuestion(question.key, { prompt: event.target.value })} disabled={pending || blocked} />
              {fieldInvalid && <p id={`evaluation-question-${question.key}-error`} className="mt-1 text-sm text-destructive">Escribe la pregunta.</p>}</div>
            <div><label htmlFor={`evaluation-question-${question.key}-type`} className="block text-sm font-medium">Tipo de respuesta</label>
              <select id={`evaluation-question-${question.key}-type`} className="rti-field" value={question.type}
                onChange={event => updateQuestion(question.key, { type: event.target.value as EvaluationQuestionType })}
                disabled={pending || blocked}>{Object.entries(TYPE_LABELS).map(([value, label]) =>
                  <option key={value} value={value}>{label}</option>)}</select></div>
          </div>
          <QuestionPreview type={question.type} />
        </li>;
      })}</ol>
      <button id="evaluation-add-question" type="button" className="rti-button-secondary w-full sm:w-auto"
        disabled={pending || blocked || questions.length >= 20} onClick={addQuestion}>
        <Plus aria-hidden="true" className="size-4" />Agregar pregunta
      </button>
    </section>
    <button className="rti-button-primary" disabled={pending || blocked}>{pending ? "Creando…" : "Crear encuesta"}</button>
  </form>;
}

export function QuestionPreview({ type }: { type: EvaluationQuestionType }) {
  if (type === "OPEN_TEXT") return <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/35 p-3">
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vista para el colaborador</p>
    <textarea className="rti-field mt-2 min-h-20" disabled placeholder="El colaborador escribirá aquí su respuesta" />
  </div>;
  if (type === "EMOTION_MULTI_SELECT") return <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/35 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vista para el colaborador</p>
      <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium">Máximo 2</span></div>
    <div className="mt-3 flex flex-wrap gap-2">{EMOTION_OPTIONS.map(option => <span key={option}
      className="rounded-full border border-border bg-card px-3 py-1.5 text-sm">{option}</span>)}</div>
  </div>;
  const options = type === "AGREEMENT_SCALE" ? AGREEMENT_OPTIONS : LIKELIHOOD_OPTIONS;
  return <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/35 p-3">
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vista para el colaborador</p>
    <div className="mt-3 grid gap-2 sm:grid-cols-5">{options.map((option, index) => <div key={option}
      className="rounded-xl border border-border bg-card p-2 text-center text-xs"><span className="block text-base font-semibold text-primary">{index + 1}</span>{option}</div>)}</div>
  </div>;
}
