"use client";

import { BarChart3, ChevronDown, Plus } from "lucide-react";
import Link from "next/link";
import { ActivityVideo } from "@/components/participation/activity-video";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { fetchCurrentIdentity, IdentityRequestError } from "@/lib/auth/authenticated-api";
import { ActivityRequestError, listProgramActivities, type ProgramActivity } from "@/lib/participation/activity-api";
import { EvaluationRequestError, listActivityEvaluations, listSessionEvaluations, type ActivityEvaluation } from "@/lib/participation/evaluation-api";
import {
  createProgramDimension, createProgramSession, listProgramDimensions, programContentErrorMessage,
  ProgramContentRequestError, type ProgramDimension, type ProgramDimensionInput, type ProgramSession,
  type ProgramSessionInput,
} from "@/lib/programs/program-content-api";
import { ActivityForm } from "@/components/programs/program-activity-area";
import { ActivityEvaluationForm } from "@/components/programs/activity-evaluation-form";
import { ProgramModal } from "@/components/programs/program-modal";
import { useProgramState } from "@/components/programs/program-state-context";
import { editDimension, editSession } from "@/lib/programs/content-administration-api";
import { ContentTools } from "./content-tools";
import { SaveQuestionnaireTemplate } from "@/components/forms/save-questionnaire-template";

type ContentDialog = { kind: "dimension"; initial?: ProgramDimension }
  | { kind: "session"; dimension: ProgramDimension; initial?: ProgramSession }
  | { kind: "activity"; dimensionName: string; session: ProgramSession; initial?: ProgramActivity }
  | { kind: "evaluation"; activity: ProgramActivity; initial?: ActivityEvaluation }
  | { kind: "session-evaluation"; session: ProgramSession; initial?: ActivityEvaluation };

export function ProgramContentArea({ organizationId, programId }: { organizationId: string; programId: string }) {
  return <ProgramContent key={`${organizationId}/${programId}`} organizationId={organizationId} programId={programId} />;
}

function ProgramContent({ organizationId, programId }: { organizationId: string; programId: string }) {
  const canEdit = useProgramState()?.canEdit ?? true;
  const [dimensions, setDimensions] = useState<ProgramDimension[]>();
  const [activities, setActivities] = useState<ProgramActivity[]>();
  const [evaluations, setEvaluations] = useState<ActivityEvaluation[]>();
  const [sessionEvaluations,setSessionEvaluations]=useState<ActivityEvaluation[]>([]);
  const [closedSessions,setClosedSessions]=useState<string[]>([]);
  const [startedSessions,setStartedSessions]=useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(true);
  const [message, setMessage] = useState("Comprobando acceso al contenido…");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<ContentDialog | null>(null);
  const [openDimensionId, setOpenDimensionId] = useState<string>();
  const [openSessionId, setOpenSessionId] = useState<string>();
  const [showArchived, setShowArchived] = useState(false);

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
        const [structure, activityList, evaluationList, sessionList] = await Promise.all([
          listProgramDimensions(organizationId, programId, controller.signal, true),
          listProgramActivities(organizationId, programId, controller.signal, true),
          listActivityEvaluations(organizationId, programId, controller.signal),
          listSessionEvaluations(organizationId, programId, controller.signal),
        ]);
        if (!controller.signal.aborted) {
          setDimensions(structure.items);
          setActivities(activityList.items);
          setEvaluations(evaluationList.items);setSessionEvaluations(sessionList.items);setClosedSessions(sessionList.closedSessionIds);setStartedSessions(sessionList.startedSessionIds);
          setMessage(structure.items.length ? "" : "Este programa todavía no tiene dimensiones.");
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          const status = error instanceof IdentityRequestError || error instanceof ActivityRequestError
            || error instanceof EvaluationRequestError ? error.status : undefined;
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
    setDimensions(undefined); setActivities(undefined); setEvaluations(undefined);
    setPending(true); setMessage("Actualizando contenido…"); setNotice(saved);
    setAttempt(value => value + 1);
  }

  const ready = dimensions !== undefined && activities !== undefined && evaluations !== undefined;
  const nextDimensionPosition = dimensions ? Math.max(0, ...dimensions.map(dimension => dimension.position)) + 1 : 1;
  const toolsContext = { organizationId, programId, onSaved: refresh };
  function usage(items: ProgramActivity[]) {
    return { hasAssignments: items.some(a => a.assignees.length > 0),
      hasSubmissions: items.some(a => a.assignees.some(person => person.submittedAt != null)) };
  }
  function bounds<T extends { id: string; archived?: boolean }>(item: T, siblings: T[]) {
    const current = siblings.filter(s => !s.archived);
    return { first: current[0]?.id === item.id, last: current.at(-1)?.id === item.id };
  }

  return <section className="rti-surface mx-auto w-full max-w-6xl p-6 sm:p-8 lg:p-10">
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="rti-kicker">Estructura del programa</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Contenido</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Construye dimensiones, sesiones y actividades antes de incorporar participantes. Despliega cada nivel para consultar y ampliar su contenido.
        </p>
      </div>
      {ready && canEdit && <button type="button" className="rti-button-primary shrink-0" onClick={() => setDialog({ kind: "dimension" })}>
        <Plus aria-hidden="true" className="size-4" />Crear dimensión
      </button>}
    </div>

    {notice && <p className="mt-5 rounded-2xl border border-accent bg-accent/60 px-4 py-3 text-sm" role="status">{notice}</p>}
    {message && <p className="mt-5 rounded-2xl bg-muted/60 px-4 py-3 text-sm" role="status">{message}</p>}

    {ready && <section aria-labelledby="dimensions-title" className="mt-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="dimensions-title" className="text-xl font-semibold">Dimensiones del programa</h2>
        <p className="text-sm text-muted-foreground">{dimensions.filter(d => showArchived || !d.archived).length} dimensiones {showArchived ? "(incluye archivadas)" : "vigentes"}</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showArchived} onChange={event => setShowArchived(event.target.checked)} />Mostrar archivados</label>
      </div>
      {!showArchived && dimensions.length > 0 && dimensions.every(d => d.archived) && <p className="mt-4 text-sm text-muted-foreground">Todo el contenido está archivado. Activa “Mostrar archivados” para consultarlo o restaurarlo.</p>}
      {dimensions.length === 0 ? <p className="mt-4 rounded-2xl border border-dashed border-border px-5 py-8 text-sm text-muted-foreground">
        Crea la primera dimensión para comenzar la estructura del programa.
      </p> : <ol className="mt-4 space-y-4">{dimensions.filter(d => showArchived || !d.archived).map(dimension => {
        const dimensionOpen = openDimensionId === dimension.id;
        const visibleSessions = dimension.sessions.filter(s => showArchived || (!dimension.archived && !s.archived));
        const activityCount = visibleSessions.reduce((total, session) => total + (activitiesBySession.get(session.id)?.filter(a => showArchived || !a.archived).length ?? 0), 0);
        return <li key={dimension.id} className="overflow-hidden rounded-2xl border border-border/70 bg-background/70">
          <button type="button" aria-expanded={dimensionOpen} aria-controls={`dimension-panel-${dimension.id}`}
            onClick={() => { setOpenDimensionId(dimensionOpen ? undefined : dimension.id); setOpenSessionId(undefined); }}
            className="flex w-full items-start justify-between gap-4 px-5 py-5 text-left hover:bg-secondary/45 sm:px-6">
            <span className="min-w-0"><span className="rti-kicker">Dimensión {dimension.position}</span>
              <span className="mt-2 block text-xl font-semibold">{dimension.name}</span>
              {dimension.archived && <span className="mt-2 inline-block rounded-full bg-muted px-3 py-1 text-xs font-medium">Archivada</span>}
              {dimension.description && <span className="mt-2 block whitespace-pre-wrap text-sm text-muted-foreground">{dimension.description}</span>}
              <span className="mt-3 block text-xs font-medium text-muted-foreground">
                {visibleSessions.length} {visibleSessions.length === 1 ? "sesión" : "sesiones"} · {activityCount} {activityCount === 1 ? "actividad" : "actividades"}
              </span>
            </span>
            <ChevronDown aria-hidden="true" className={`mt-1 size-5 shrink-0 transition-transform ${dimensionOpen ? "rotate-180" : ""}`} />
          </button>
          {canEdit && <ContentTools {...toolsContext} kind="dimensions" item={dimension}
            {...usage((activities ?? []).filter(a => a.moduleId === dimension.id))} {...bounds(dimension, dimensions)}
            onEdit={() => setDialog({ kind: "dimension", initial: dimension })} />}

          {dimensionOpen && <div id={`dimension-panel-${dimension.id}`} className="border-t border-border/70 px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">Sesiones</h3>
              <button type="button" disabled={!canEdit || dimension.archived} className="rti-button-secondary" onClick={() => setDialog({ kind: "session", dimension })}>
                <Plus aria-hidden="true" className="size-4" />Agregar sesión
              </button>
            </div>
            {dimension.sessions.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Esta dimensión todavía no tiene sesiones.</p>
              : <ol className="mt-4 space-y-3">{visibleSessions.map(session => {
                const sessionOpen = openSessionId === session.id;
                const closingSurvey=sessionEvaluations.find(s=>s.sessionId===session.id);
                const sessionClosed=closedSessions.includes(session.id);
                const closingStarted=startedSessions.includes(session.id);
                const allSessionActivities = activitiesBySession.get(session.id) ?? [];
                const sessionActivities = allSessionActivities.filter(a => showArchived || (!dimension.archived && !session.archived && !a.archived));
                return <li key={session.id} className="overflow-hidden rounded-xl border border-border/70 bg-card">
                  <button type="button" aria-expanded={sessionOpen} aria-controls={`session-panel-${session.id}`}
                    onClick={() => setOpenSessionId(sessionOpen ? undefined : session.id)}
                    className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left hover:bg-secondary/45">
                    <span className="min-w-0"><span className="text-xs font-semibold uppercase tracking-wide text-primary">Sesión {session.position}</span>
                      <span className="mt-1 block font-semibold">{session.name}</span>
                      {(dimension.archived || session.archived) && <span className="mt-1 block text-xs text-muted-foreground">Sesión archivada</span>}
                      <span className="mt-1 block text-sm text-muted-foreground">Agenda individual · {sessionActivities.length} {sessionActivities.length === 1 ? "actividad" : "actividades"}</span>
                    </span>
                    <ChevronDown aria-hidden="true" className={`size-5 shrink-0 transition-transform ${sessionOpen ? "rotate-180" : ""}`} />
                  </button>
                  {canEdit && <ContentTools {...toolsContext} kind="sessions" item={session} parentArchived={dimension.archived}
                    {...usage(allSessionActivities)} {...bounds(session, dimension.sessions)}
                    onEdit={() => setDialog({ kind: "session", dimension, initial: session })} />}

                  {sessionOpen && <div id={`session-panel-${session.id}`} className="border-t border-border/70 px-4 py-4">
                    <Link className="rti-button-secondary mb-4" href={`/organizations/${encodeURIComponent(organizationId)}/programs/${encodeURIComponent(programId)}/agenda?session=${encodeURIComponent(session.id)}`}>Agendar participantes</Link>
                    {session.closingComment && <p className="whitespace-pre-wrap text-sm text-muted-foreground"><span className="font-medium text-foreground">Comentario de cierre: </span>{session.closingComment}</p>}
                    <div className="mt-4 rounded-xl border border-border bg-accent/30 p-4">
                      <p className="font-semibold">Encuesta de cierre de sesión</p>
                      <p className="mt-2 text-sm text-muted-foreground">{closingSurvey ? `${closingSurvey.title} · ${closingSurvey.questions.length} preguntas` : "Configura la encuesta que completa el 20% final de esta sesión."}</p>
                      {canEdit && <button type="button" className="rti-button-secondary mt-3" disabled={dimension.archived || session.archived || closingStarted}
                        onClick={()=>setDialog({kind:"session-evaluation",session,initial:closingSurvey})}>{closingSurvey?"Editar encuesta de cierre":"Crear encuesta de cierre"}</button>}
                      {closingStarted && <p className="mt-2 text-xs text-muted-foreground">El cierre ya comenzó; el comentario y la encuesta están protegidos.</p>}
                      {closingSurvey&&<SaveQuestionnaireTemplate organizationId={organizationId} programId={programId} evaluation={closingSurvey}/>}
                      {sessionClosed && <p className="mt-2 text-sm font-semibold">Esta sesión ya tiene cierres completados. No admite nuevas actividades.</p>}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <h4 className="font-semibold">Actividades</h4>
                      <button type="button" disabled={!canEdit || dimension.archived || session.archived || sessionClosed} className="rti-button-secondary"
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
                        {(activity.archived || dimension.archived || session.archived) && <p className="mt-1 text-xs text-muted-foreground">Actividad archivada</p>}
                        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{activity.instructions}</p>
                        <p className="mt-3 text-xs font-medium text-muted-foreground">Vence 3 días calendario después de la sesión de cada persona.</p>
                        <p className="mt-1 text-xs font-medium text-muted-foreground">Asignaciones: {activity.assignees.length}</p>
                        {canEdit && <ContentTools {...toolsContext} kind="activities" item={activity} parentArchived={dimension.archived || session.archived} duplicateBlocked={sessionClosed}
                          {...usage([activity])} {...bounds(activity, allSessionActivities)}
                          onEdit={() => setDialog({ kind: "activity", dimensionName: dimension.name, session, initial: activity })} />}
                        {activity.youtubeUrl && <ActivityVideo url={activity.youtubeUrl} title={activity.title} />}
                        {evaluation ? <div className="mt-4 rounded-xl border border-primary/20 bg-accent/35 p-3">
                          <div className="flex items-center gap-2"><BarChart3 aria-hidden="true" className="size-4 text-primary" />
                            <p className="text-sm font-semibold">{evaluation.title}</p></div>
                          <p className="mt-1 text-xs text-muted-foreground">{evaluation.questions.length} {evaluation.questions.length === 1 ? "pregunta" : "preguntas"}</p>
                          <ol className="mt-2 space-y-1">{evaluation.questions.map(question => <li key={question.id}
                            className="text-xs text-muted-foreground">{question.position}. {question.prompt}</li>)}</ol>
                          {canEdit && <button type="button" className="rti-button-secondary mt-3" disabled={activity.archived || dimension.archived || session.archived || usage([activity]).hasSubmissions}
                            onClick={() => setDialog({ kind: "evaluation", activity, initial: evaluation })}>Editar formulario</button>}
                          <SaveQuestionnaireTemplate organizationId={organizationId} programId={programId} evaluation={evaluation}/>
                        </div> : <button type="button" disabled={!canEdit || activity.archived || dimension.archived || session.archived || usage([activity]).hasSubmissions} className="rti-button-secondary mt-4 w-full"
                          onClick={() => setDialog({ kind: "evaluation", activity })}>
                          <BarChart3 aria-hidden="true" className="size-4" />Crear formulario
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
        initial={dialog.initial} onSaved={() => { setDialog(null); refresh(dialog.initial ? "Dimensión actualizada." : "Dimensión creada."); }} />
    </ProgramModal>}
    {dialog?.kind === "session" && <ProgramModal titleId={`create-session-title-${dialog.dimension.id}`}
      closeLabel="Cerrar creación de sesión" onClose={() => setDialog(null)}>
      <SessionForm organizationId={organizationId} programId={programId} dimensionId={dialog.dimension.id}
        initial={dialog.initial}
        position={Math.max(0, ...dialog.dimension.sessions.map(session => session.position)) + 1}
        onSaved={() => { setDialog(null); refresh(dialog.initial ? "Sesión actualizada." : `Sesión creada en ${dialog.dimension.name}.`); }} />
    </ProgramModal>}
    {dialog?.kind === "activity" && <ProgramModal titleId="create-activity-title" closeLabel="Cerrar creación de actividad"
      onClose={() => setDialog(null)}>
      <ActivityForm organizationId={organizationId} programId={programId}
        initial={dialog.initial}
        sessions={[{ id: dialog.session.id, label: `${dialog.dimensionName} · ${dialog.session.name}` }]}
        activities={activities ?? []}
        onSaved={saved => { setDialog(null); refresh(dialog.initial ? "Actividad actualizada." : saved.assignees.length
          ? `Actividad creada y asignada a ${saved.assignees.length} colaborador${saved.assignees.length === 1 ? "" : "es"}.`
          : "Actividad creada. Se asignará al agendar participantes en su sesión."); }} />
    </ProgramModal>}
    {dialog?.kind === "evaluation" && <ProgramModal titleId="create-evaluation-title"
      closeLabel="Cerrar creación de encuesta" onClose={() => setDialog(null)}>
      <ActivityEvaluationForm organizationId={organizationId} programId={programId}
        initial={dialog.initial}
        activityId={dialog.activity.id} activityTitle={dialog.activity.title}
        onSaved={saved => { setDialog(null); refresh(`Encuesta “${saved.title}” ${dialog.initial ? "actualizada" : "creada"}.`); }} />
    </ProgramModal>}

    {dialog?.kind === "session-evaluation" && <ProgramModal titleId="create-evaluation-title" closeLabel="Cerrar encuesta de sesión" onClose={()=>setDialog(null)}>
      <ActivityEvaluationForm organizationId={organizationId} programId={programId} sessionId={dialog.session.id}
        activityTitle={dialog.session.name} initial={dialog.initial} onSaved={()=>{setDialog(null);refresh("Encuesta de cierre guardada.");}} />
    </ProgramModal>}
    <button className="rti-button-secondary mt-6" disabled={pending} onClick={() => refresh("")}>Actualizar contenido</button>
    {!ready && !pending && <p className="mt-6 text-sm text-muted-foreground">Vuelve al resumen del programa para comprobar el contexto.</p>}
    <nav aria-label="Navegación de contenido" className="mt-8 border-t border-border/70 pt-6 text-sm">
      <Link href="/account" className="rti-link">Volver a Cuenta</Link>
    </nav>
  </section>;
}

export function DimensionForm({ organizationId, programId, position, onSaved, initial }: {
  organizationId: string; programId: string; position: number; onSaved: () => void; initial?: ProgramDimension;
}) {
  const [input, setInput] = useState({ name: initial?.name ?? "", description: initial?.description ?? "" });
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
    submitting.current = true; setPending(true); setMessage(initial ? "Guardando dimensión…" : "Creando dimensión…");
    const controller = new AbortController(); request.current = controller;
    try {
      if (initial) await editDimension(organizationId, programId, initial.id, { ...clean, version: initial.version }, controller.signal);
      else await createProgramDimension(organizationId, programId, clean, controller.signal);
      if (!controller.signal.aborted) onSaved();
    } catch (error) {
      if (!controller.signal.aborted) {
        const status = error instanceof ProgramContentRequestError ? error.status : 0;
        setBlocked(status === 0 || status >= 500 || [401, 403, 404, 409].includes(status));
        setMessage(programContentErrorMessage(error));
      }
    } finally { submitting.current = false; if (!controller.signal.aborted) setPending(false); }
  }

  return <form onSubmit={submit} noValidate aria-label={initial ? "Editar dimensión" : "Crear dimensión"} className="space-y-4">
    <div><p className="rti-kicker">Dimensión</p><h2 id="create-dimension-title" className="mt-2 text-xl font-semibold">{initial ? "Editar dimensión" : "Crear dimensión"}</h2></div>
    {message && <p role="status" className="rounded-xl bg-muted/60 px-3 py-2 text-sm">{message}</p>}
    <div><label htmlFor="dimension-name" className="block text-sm font-medium">Nombre</label>
      <input id="dimension-name" className="rti-field" required maxLength={255} value={input.name}
        onChange={event => setInput({ ...input, name: event.target.value })} disabled={pending || blocked} /></div>
    <div><label htmlFor="dimension-description" className="block text-sm font-medium">Descripción opcional</label>
      <textarea id="dimension-description" className="rti-field min-h-24 resize-y" maxLength={10000} value={input.description}
        onChange={event => setInput({ ...input, description: event.target.value })} disabled={pending || blocked} /></div>
    <button className="rti-button-primary" disabled={pending || blocked}>{pending ? "Guardando…" : initial ? "Guardar cambios" : "Crear dimensión"}</button>
  </form>;
}

export function SessionForm({ organizationId, programId, dimensionId, position, onSaved, initial }: {
  organizationId: string; programId: string; dimensionId: string; position: number; onSaved: () => void; initial?: ProgramSession;
}) {
  const [input, setInput] = useState({ name: initial?.name ?? "", closingComment: initial?.closingComment ?? "" });
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || blocked) return;
    const clean: ProgramSessionInput = { name: input.name.trim(), closingComment: input.closingComment.trim(), position };
    if (!clean.name || clean.name.length > 255 || clean.closingComment.length > 10000) {
      setMessage("Revisa el nombre y el comentario de cierre."); return;
    }
    submitting.current = true; setPending(true); setMessage(initial ? "Guardando sesión…" : "Creando sesión…");
    const controller = new AbortController(); request.current = controller;
    try {
      if (initial) await editSession(organizationId, programId, initial.id, { ...clean, version: initial.version }, controller.signal);
      else await createProgramSession(organizationId, programId, dimensionId, clean, controller.signal);
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
  return <form onSubmit={submit} noValidate aria-label={initial ? "Editar sesión" : "Crear sesión"} className="space-y-4">
    <div><p className="rti-kicker">Sesión</p><h2 id={`create-session-title-${dimensionId}`} className="mt-2 text-xl font-semibold">{initial ? "Editar sesión" : "Agregar sesión"}</h2></div>
    {message && <p role="status" className="text-sm">{message}</p>}
    <div><label htmlFor={`${prefix}-name`} className="block text-sm font-medium">Nombre</label>
      <input id={`${prefix}-name`} className="rti-field" required maxLength={255} value={input.name}
        onChange={event => setInput({ ...input, name: event.target.value })} disabled={pending || blocked} /></div>
    <p className="text-sm text-muted-foreground">Este comentario aparecerá al enviar todas las actividades. Después de crear la sesión, configura sus actividades y su encuesta de cierre antes de agendar participantes.</p>
    <div><label htmlFor={`${prefix}-closingComment`} className="block text-sm font-medium">Comentario de cierre</label>
      <textarea id={`${prefix}-closingComment`} className="rti-field min-h-20 resize-y" maxLength={10000} value={input.closingComment}
        onChange={event => setInput({ ...input, closingComment: event.target.value })} disabled={pending || blocked} /></div>
    <button className="rti-button-primary" disabled={pending || blocked}>{pending ? "Guardando…" : initial ? "Guardar cambios" : "Agregar sesión"}</button>
  </form>;
}
