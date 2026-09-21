"use client";

import { BarChart3, ChevronDown, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { fetchCurrentIdentity, IdentityRequestError } from "@/lib/auth/authenticated-api";
import { listEnrollments, ParticipationRequestError, type Enrollment } from "@/lib/participation/participation-api";
import { ActivityRequestError, listProgramActivities, type ProgramActivity } from "@/lib/participation/activity-api";
import { EvaluationRequestError, listActivityEvaluations, type ActivityEvaluation } from "@/lib/participation/evaluation-api";
import {
  createProgramDimension, createProgramSession, listProgramDimensions, programContentErrorMessage,
  ProgramContentRequestError, type ProgramDimension, type ProgramDimensionInput, type ProgramSession,
  type ProgramSessionInput,
} from "@/lib/programs/program-content-api";
import { ActivityForm } from "@/components/programs/program-activity-area";
import { ActivityEvaluationForm } from "@/components/programs/activity-evaluation-form";
import { ProgramModal } from "@/components/programs/program-modal";

type ContentDialog = { kind: "dimension" }
  | { kind: "session"; dimension: ProgramDimension }
  | { kind: "activity"; dimensionName: string; session: ProgramSession }
  | { kind: "evaluation"; activity: ProgramActivity };

export function ProgramContentArea({ organizationId, programId }: { organizationId: string; programId: string }) {
  return <ProgramContent key={`${organizationId}/${programId}`} organizationId={organizationId} programId={programId} />;
}

function ProgramContent({ organizationId, programId }: { organizationId: string; programId: string }) {
  const [dimensions, setDimensions] = useState<ProgramDimension[]>();
  const [activities, setActivities] = useState<ProgramActivity[]>();
  const [evaluations, setEvaluations] = useState<ActivityEvaluation[]>();
  const [enrollments, setEnrollments] = useState<Enrollment[]>();
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(true);
  const [message, setMessage] = useState("Comprobando acceso al contenido…");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<ContentDialog | null>(null);
  const [openDimensionId, setOpenDimensionId] = useState<string>();
  const [openSessionId, setOpenSessionId] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const identity = await fetchCurrentIdentity(organizationId, controller.signal);
        if (controller.signal.aborted) return;
        if (identity.activeOrganizationId !== organizationId || !identity.roles.includes("CONSULTANT")) {
          setMessage("Sólo un consultor autorizado puede gestionar el contenido.");
          return;
        }
        const [structure, activityList, evaluationList, enrollmentPage] = await Promise.all([
          listProgramDimensions(organizationId, programId, controller.signal),
          listProgramActivities(organizationId, programId, controller.signal),
          listActivityEvaluations(organizationId, programId, controller.signal),
          listEnrollments(organizationId, programId, 0, controller.signal, 100),
        ]);
        if (!controller.signal.aborted) {
          setDimensions(structure.items);
          setActivities(activityList.items);
          setEvaluations(evaluationList.items);
          setEnrollments(enrollmentPage.items.filter(enrollment => enrollment.status === "ACTIVE"));
          setMessage(structure.items.length ? "" : "Este programa todavía no tiene dimensiones.");
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          const status = error instanceof IdentityRequestError || error instanceof ActivityRequestError
            || error instanceof EvaluationRequestError
            || error instanceof ParticipationRequestError ? error.status : undefined;
          setMessage(programContentErrorMessage(status === undefined ? error : new ProgramContentRequestError(status)));
        }
      } finally {
        if (!controller.signal.aborted) setPending(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [organizationId, programId, attempt]);

  const activitiesBySession = useMemo(() => {
    const grouped = new Map<string, ProgramActivity[]>();
    for (const activity of activities ?? []) {
      grouped.set(activity.sessionId, [...(grouped.get(activity.sessionId) ?? []), activity]);
    }
    return grouped;
  }, [activities]);

  function refresh(saved: string) {
    setDimensions(undefined); setActivities(undefined); setEvaluations(undefined); setEnrollments(undefined);
    setPending(true); setMessage("Actualizando contenido…"); setNotice(saved);
    setAttempt(value => value + 1);
  }

  const ready = dimensions !== undefined && activities !== undefined && evaluations !== undefined
    && enrollments !== undefined;
  const nextDimensionPosition = dimensions ? Math.max(0, ...dimensions.map(dimension => dimension.position)) + 1 : 1;

  return <section className="rti-surface mx-auto w-full max-w-6xl p-6 sm:p-8 lg:p-10">
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="rti-kicker">Estructura del programa</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Contenido</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Construye dimensiones, sesiones y actividades antes de incorporar participantes. Despliega cada nivel para consultar y ampliar su contenido.
        </p>
      </div>
      {ready && <button type="button" className="rti-button-primary shrink-0" onClick={() => setDialog({ kind: "dimension" })}>
        <Plus aria-hidden="true" className="size-4" />Crear dimensión
      </button>}
    </div>

    {notice && <p className="mt-5 rounded-2xl border border-accent bg-accent/60 px-4 py-3 text-sm" role="status">{notice}</p>}
    {message && <p className="mt-5 rounded-2xl bg-muted/60 px-4 py-3 text-sm" role="status">{message}</p>}

    {ready && <section aria-labelledby="dimensions-title" className="mt-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="dimensions-title" className="text-xl font-semibold">Dimensiones del programa</h2>
        <p className="text-sm text-muted-foreground">{dimensions.length} {dimensions.length === 1 ? "dimensión" : "dimensiones"}</p>
      </div>
      {dimensions.length === 0 ? <p className="mt-4 rounded-2xl border border-dashed border-border px-5 py-8 text-sm text-muted-foreground">
        Crea la primera dimensión para comenzar la estructura del programa.
      </p> : <ol className="mt-4 space-y-4">{dimensions.map(dimension => {
        const dimensionOpen = openDimensionId === dimension.id;
        const activityCount = dimension.sessions.reduce((total, session) => total + (activitiesBySession.get(session.id)?.length ?? 0), 0);
        return <li key={dimension.id} className="overflow-hidden rounded-2xl border border-border/70 bg-background/70">
          <button type="button" aria-expanded={dimensionOpen} aria-controls={`dimension-panel-${dimension.id}`}
            onClick={() => { setOpenDimensionId(dimensionOpen ? undefined : dimension.id); setOpenSessionId(undefined); }}
            className="flex w-full items-start justify-between gap-4 px-5 py-5 text-left hover:bg-secondary/45 sm:px-6">
            <span className="min-w-0"><span className="rti-kicker">Dimensión {dimension.position}</span>
              <span className="mt-2 block text-xl font-semibold">{dimension.name}</span>
              {dimension.description && <span className="mt-2 block whitespace-pre-wrap text-sm text-muted-foreground">{dimension.description}</span>}
              <span className="mt-3 block text-xs font-medium text-muted-foreground">
                {dimension.sessions.length} {dimension.sessions.length === 1 ? "sesión" : "sesiones"} · {activityCount} {activityCount === 1 ? "actividad" : "actividades"}
              </span>
            </span>
            <ChevronDown aria-hidden="true" className={`mt-1 size-5 shrink-0 transition-transform ${dimensionOpen ? "rotate-180" : ""}`} />
          </button>

          {dimensionOpen && <div id={`dimension-panel-${dimension.id}`} className="border-t border-border/70 px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">Sesiones</h3>
              <button type="button" className="rti-button-secondary" onClick={() => setDialog({ kind: "session", dimension })}>
                <Plus aria-hidden="true" className="size-4" />Agregar sesión
              </button>
            </div>
            {dimension.sessions.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Esta dimensión todavía no tiene sesiones.</p>
              : <ol className="mt-4 space-y-3">{dimension.sessions.map(session => {
                const sessionOpen = openSessionId === session.id;
                const sessionActivities = activitiesBySession.get(session.id) ?? [];
                return <li key={session.id} className="overflow-hidden rounded-xl border border-border/70 bg-card">
                  <button type="button" aria-expanded={sessionOpen} aria-controls={`session-panel-${session.id}`}
                    onClick={() => setOpenSessionId(sessionOpen ? undefined : session.id)}
                    className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left hover:bg-secondary/45">
                    <span className="min-w-0"><span className="text-xs font-semibold uppercase tracking-wide text-primary">Sesión {session.position}</span>
                      <span className="mt-1 block font-semibold">{session.name}</span>
                      <span className="mt-1 block text-sm text-muted-foreground">{session.scheduledDate} · {sessionActivities.length} {sessionActivities.length === 1 ? "actividad" : "actividades"}</span>
                    </span>
                    <ChevronDown aria-hidden="true" className={`size-5 shrink-0 transition-transform ${sessionOpen ? "rotate-180" : ""}`} />
                  </button>

                  {sessionOpen && <div id={`session-panel-${session.id}`} className="border-t border-border/70 px-4 py-4">
                    {session.objective && <p className="whitespace-pre-wrap text-sm text-muted-foreground"><span className="font-medium text-foreground">Objetivo: </span>{session.objective}</p>}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <h4 className="font-semibold">Actividades</h4>
                      <button type="button" className="rti-button-secondary"
                        onClick={() => setDialog({ kind: "activity", dimensionName: dimension.name, session })}>
                        <Plus aria-hidden="true" className="size-4" />Crear actividad
                      </button>
                    </div>
                    {sessionActivities.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Esta sesión todavía no tiene actividades.</p>
                      : <ol className="mt-3 grid gap-3 lg:grid-cols-2">{sessionActivities.map(activity => {
                        const evaluation = evaluations?.find(item => item.activityId === activity.id);
                        return <li key={activity.id} className="rounded-xl border border-border/70 bg-background/70 p-4">
                        <p className="rti-kicker">Actividad {activity.position}</p>
                        <p className="mt-2 font-semibold">{activity.title}</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{activity.instructions}</p>
                        <p className="mt-3 text-xs font-medium text-muted-foreground">Fecha límite: {activity.dueDate}</p>
                        <p className="mt-1 text-xs font-medium text-muted-foreground">Asignaciones: {activity.assignees.length}</p>
                        {activity.youtubeUrl && <a href={activity.youtubeUrl} target="_blank" rel="noopener noreferrer"
                          className="rti-link mt-3 inline-block text-sm">Ver video en YouTube</a>}
                        {evaluation ? <div className="mt-4 rounded-xl border border-primary/20 bg-accent/35 p-3">
                          <div className="flex items-center gap-2"><BarChart3 aria-hidden="true" className="size-4 text-primary" />
                            <p className="text-sm font-semibold">{evaluation.title}</p></div>
                          <p className="mt-1 text-xs text-muted-foreground">{evaluation.questions.length} {evaluation.questions.length === 1 ? "pregunta" : "preguntas"}</p>
                          <ol className="mt-2 space-y-1">{evaluation.questions.map(question => <li key={question.id}
                            className="text-xs text-muted-foreground">{question.position}. {question.prompt}</li>)}</ol>
                        </div> : <button type="button" className="rti-button-secondary mt-4 w-full"
                          onClick={() => setDialog({ kind: "evaluation", activity })}>
                          <BarChart3 aria-hidden="true" className="size-4" />Crear encuesta
                        </button>}
                      </li>;
                      })}</ol>}
                  </div>}
                </li>;
              })}</ol>}
          </div>}
        </li>;
      })}</ol>}
    </section>}

    {dialog?.kind === "dimension" && <ProgramModal titleId="create-dimension-title" closeLabel="Cerrar creación de dimensión"
      onClose={() => setDialog(null)}>
      <DimensionForm organizationId={organizationId} programId={programId} position={nextDimensionPosition}
        onSaved={() => { setDialog(null); refresh("Dimensión creada."); }} />
    </ProgramModal>}
    {dialog?.kind === "session" && <ProgramModal titleId={`create-session-title-${dialog.dimension.id}`}
      closeLabel="Cerrar creación de sesión" onClose={() => setDialog(null)}>
      <SessionForm organizationId={organizationId} programId={programId} dimensionId={dialog.dimension.id}
        position={Math.max(0, ...dialog.dimension.sessions.map(session => session.position)) + 1}
        onSaved={() => { setDialog(null); refresh(`Sesión creada en ${dialog.dimension.name}.`); }} />
    </ProgramModal>}
    {dialog?.kind === "activity" && <ProgramModal titleId="create-activity-title" closeLabel="Cerrar creación de actividad"
      onClose={() => setDialog(null)}>
      <ActivityForm organizationId={organizationId} programId={programId}
        sessions={[{ id: dialog.session.id, label: `${dialog.dimensionName} · ${dialog.session.name}` }]}
        enrollments={enrollments ?? []} activities={activities ?? []}
        onSaved={saved => { setDialog(null); refresh(saved.assignees.length
          ? `Actividad creada y asignada a ${saved.assignees.length} colaborador${saved.assignees.length === 1 ? "" : "es"}.`
          : "Actividad creada sin asignaciones."); }} />
    </ProgramModal>}
    {dialog?.kind === "evaluation" && <ProgramModal titleId="create-evaluation-title"
      closeLabel="Cerrar creación de encuesta" onClose={() => setDialog(null)}>
      <ActivityEvaluationForm organizationId={organizationId} programId={programId}
        activityId={dialog.activity.id} activityTitle={dialog.activity.title}
        onSaved={saved => { setDialog(null); refresh(`Encuesta “${saved.title}” creada.`); }} />
    </ProgramModal>}

    <button className="rti-button-secondary mt-6" disabled={pending} onClick={() => refresh("")}>Actualizar contenido</button>
    {!ready && !pending && <p className="mt-6 text-sm text-muted-foreground">Vuelve al resumen del programa para comprobar el contexto.</p>}
    <nav aria-label="Navegación de contenido" className="mt-8 border-t border-border/70 pt-6 text-sm">
      <Link href="/account" className="rti-link">Volver a Cuenta</Link>
    </nav>
  </section>;
}

export function DimensionForm({ organizationId, programId, position, onSaved }: {
  organizationId: string; programId: string; position: number; onSaved: () => void;
}) {
  const [input, setInput] = useState({ name: "", description: "" });
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || blocked) return;
    const clean: ProgramDimensionInput = { name: input.name.trim(), description: input.description.trim(), position };
    if (!clean.name || clean.name.length > 255 || clean.description.length > 10000) {
      setMessage("Revisa el nombre y la descripción."); return;
    }
    submitting.current = true; setPending(true); setMessage("Creando dimensión…");
    const controller = new AbortController(); request.current = controller;
    try {
      await createProgramDimension(organizationId, programId, clean, controller.signal);
      if (!controller.signal.aborted) onSaved();
    } catch (error) {
      if (!controller.signal.aborted) {
        const status = error instanceof ProgramContentRequestError ? error.status : 0;
        setBlocked(status === 0 || status >= 500 || [401, 403, 404, 409].includes(status));
        setMessage(programContentErrorMessage(error));
      }
    } finally { submitting.current = false; if (!controller.signal.aborted) setPending(false); }
  }

  return <form onSubmit={submit} noValidate aria-label="Crear dimensión" className="space-y-4">
    <div><p className="rti-kicker">Nueva dimensión</p><h2 id="create-dimension-title" className="mt-2 text-xl font-semibold">Crear dimensión</h2></div>
    {message && <p role="status" className="rounded-xl bg-muted/60 px-3 py-2 text-sm">{message}</p>}
    <div><label htmlFor="dimension-name" className="block text-sm font-medium">Nombre</label>
      <input id="dimension-name" className="rti-field" required maxLength={255} value={input.name}
        onChange={event => setInput({ ...input, name: event.target.value })} disabled={pending || blocked} /></div>
    <div><label htmlFor="dimension-description" className="block text-sm font-medium">Descripción opcional</label>
      <textarea id="dimension-description" className="rti-field min-h-24 resize-y" maxLength={10000} value={input.description}
        onChange={event => setInput({ ...input, description: event.target.value })} disabled={pending || blocked} /></div>
    <button className="rti-button-primary" disabled={pending || blocked}>{pending ? "Creando…" : "Crear dimensión"}</button>
  </form>;
}

export function SessionForm({ organizationId, programId, dimensionId, position, onSaved }: {
  organizationId: string; programId: string; dimensionId: string; position: number; onSaved: () => void;
}) {
  const [input, setInput] = useState({ name: "", objective: "", scheduledDate: "" });
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || blocked) return;
    const clean: ProgramSessionInput = { name: input.name.trim(), objective: input.objective.trim(),
      scheduledDate: input.scheduledDate, position };
    if (!clean.name || clean.name.length > 255 || clean.objective.length > 10000 || !/^\d{4}-\d{2}-\d{2}$/.test(clean.scheduledDate)) {
      setMessage("Revisa el nombre, el objetivo y la fecha."); return;
    }
    submitting.current = true; setPending(true); setMessage("Creando sesión…");
    const controller = new AbortController(); request.current = controller;
    try {
      await createProgramSession(organizationId, programId, dimensionId, clean, controller.signal);
      if (!controller.signal.aborted) onSaved();
    } catch (error) {
      if (!controller.signal.aborted) {
        const status = error instanceof ProgramContentRequestError ? error.status : 0;
        setBlocked(status === 0 || status >= 500 || [401, 403, 404, 409].includes(status));
        setMessage(programContentErrorMessage(error));
      }
    } finally { submitting.current = false; if (!controller.signal.aborted) setPending(false); }
  }

  const prefix = `session-${dimensionId}`;
  return <form onSubmit={submit} noValidate aria-label="Crear sesión" className="space-y-4">
    <div><p className="rti-kicker">Nueva sesión</p><h2 id={`create-session-title-${dimensionId}`} className="mt-2 text-xl font-semibold">Agregar sesión</h2></div>
    {message && <p role="status" className="text-sm">{message}</p>}
    <div><label htmlFor={`${prefix}-name`} className="block text-sm font-medium">Nombre</label>
      <input id={`${prefix}-name`} className="rti-field" required maxLength={255} value={input.name}
        onChange={event => setInput({ ...input, name: event.target.value })} disabled={pending || blocked} /></div>
    <div><label htmlFor={`${prefix}-date`} className="block text-sm font-medium">Fecha</label>
      <input id={`${prefix}-date`} type="date" className="rti-field" required value={input.scheduledDate}
        onChange={event => setInput({ ...input, scheduledDate: event.target.value })} disabled={pending || blocked} /></div>
    <div><label htmlFor={`${prefix}-objective`} className="block text-sm font-medium">Objetivo opcional</label>
      <textarea id={`${prefix}-objective`} className="rti-field min-h-20 resize-y" maxLength={10000} value={input.objective}
        onChange={event => setInput({ ...input, objective: event.target.value })} disabled={pending || blocked} /></div>
    <button className="rti-button-primary" disabled={pending || blocked}>{pending ? "Creando…" : "Agregar sesión"}</button>
  </form>;
}
