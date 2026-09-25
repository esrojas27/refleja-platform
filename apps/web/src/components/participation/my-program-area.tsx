"use client";

import Link from "next/link";
import { ChevronDown, Flag } from "lucide-react";
import { useEffect, useState } from "react";

import {
  getMyProgram,
  listMyPrograms,
  myProgramErrorMessage,
  myProgramsPath,
  ParticipationRequestError,
  type MyProgram,
  type PageResult,
} from "@/lib/participation/participation-api";
import { activityErrorMessage, listMyProgramActivities, submitMyActivity,
  compareAssignedActivityOrder, pendingAssignedActivities, type AssignedActivity } from "@/lib/participation/activity-api";
import { useCollaboratorActivities } from "@/components/participation/collaborator-activities-state";
import { ActivityStatusBadges, CollaboratorProgressOverview } from "@/components/participation/progress-overview";
import { ActivitySurveyForm } from "@/components/participation/activity-survey-form";

const button = "rti-button-secondary";

export function MyProgramArea({ mode, programId }: { mode: "list" | "summary" | "activities"; programId?: string }) {
  const detail = mode !== "list";
  return <section className="rti-surface mx-auto w-full max-w-5xl p-6 sm:p-8 lg:p-10">
    <p className="rti-kicker">Área del colaborador</p>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{mode === "summary" ? "Resumen del programa" : mode === "activities" ? "Actividades" : "Mis programas"}</h1>
    <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
      {mode === "summary" ? "Consulta el contexto del programa y el avance de tu participación."
        : mode === "activities" ? "Realiza tus actividades y consulta el estado de cada entrega."
          : "Programas asociados a tus inscripciones activas o completadas."}
    </p>
    {detail && programId ? <MyProgramDetail programId={programId} section={mode} /> : <MyProgramList />}
  </section>;
}

function MyProgramList() {
  const [result, setResult] = useState<PageResult<MyProgram>>();
  const [page, setPage] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(true);
  const [message, setMessage] = useState("Cargando tus programas…");
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    listMyPrograms(page, controller.signal).then(data => {
      if (controller.signal.aborted) return;
      setResult(data);
      setMessage(data.items.length ? "" : "No tienes programas asignados disponibles.");
    }).catch(error => {
      if (controller.signal.aborted) return;
      setMessage(myProgramErrorMessage(error));
      setNeedsLogin(error instanceof ParticipationRequestError && error.status === 401);
    }).finally(() => { if (!controller.signal.aborted) setPending(false); });
    return () => controller.abort();
  }, [page, attempt]);

  function load(nextPage = page) {
    setResult(undefined); setPending(true); setNeedsLogin(false); setMessage("Cargando tus programas…");
    setPage(nextPage); setAttempt(value => value + 1);
  }

  return <div className="mt-7 space-y-5">
    {message && <p role="status" className="rounded-2xl bg-muted/60 px-4 py-3 text-sm">{message}</p>}
    {needsLogin && <Link href="/login" className="rti-link inline-block text-sm">Iniciar sesión</Link>}
    {result && <>
      <ul className="grid gap-4 sm:grid-cols-2">{result.items.map(program => <li key={program.id} className="rounded-2xl border border-border/70 bg-background/70 p-5 transition-colors hover:border-primary/30">
        <p className="rti-kicker">{program.status}</p>
        <Link href={myProgramsPath(program.id)} className="rti-link mt-3 inline-block break-words text-lg">{program.name}</Link>
        <p className="mt-1 break-words text-sm text-muted-foreground">{program.organizationName}</p>
        <p className="mt-1 text-sm">{program.startDate ?? "Sin fecha"} — {program.endDate ?? "Sin fecha"}</p>
      </li>)}</ul>
      <p className="text-sm text-muted-foreground">{result.totalElements} programas · Página {result.page + 1} de {Math.max(1, result.totalPages)}</p>
      <div className="flex flex-wrap gap-3">
        <button className={button} disabled={pending || page === 0} onClick={() => load(page - 1)}>Anterior</button>
        <button className={button} disabled={pending || page + 1 >= result.totalPages} onClick={() => load(page + 1)}>Siguiente</button>
      </div>
    </>}
    <button className={button} disabled={pending} onClick={() => load()}>Actualizar listado</button>
  </div>;
}

function MyProgramDetail({ programId, section }: { programId: string; section: "summary" | "activities" }) {
  const [program, setProgram] = useState<MyProgram>();
  const [message, setMessage] = useState("Cargando programa…");
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getMyProgram(programId, controller.signal).then(data => {
      if (!controller.signal.aborted) { setProgram(data); setMessage(""); }
    }).catch(error => {
      if (controller.signal.aborted) return;
      setMessage(myProgramErrorMessage(error));
      setNeedsLogin(error instanceof ParticipationRequestError && error.status === 401);
    });
    return () => controller.abort();
  }, [programId]);

  return <div className="mt-7">
    {message && <p role="status" className="rounded-2xl bg-muted/60 px-4 py-3 text-sm">{message}</p>}
    {needsLogin && <Link href="/login" className="rti-link mt-3 inline-block text-sm">Iniciar sesión</Link>}
    {program && <div className="space-y-7">
      {section === "summary" && <>
      <dl className="grid gap-x-8 gap-y-2 break-words rounded-2xl border border-border/70 bg-background/70 p-5 sm:grid-cols-[auto_1fr]">
        <dt className="font-medium">Nombre</dt><dd>{program.name}</dd>
        <dt className="font-medium">Organización</dt><dd>{program.organizationName}</dd>
        <dt className="font-medium">Descripción</dt><dd className="whitespace-pre-wrap">{program.description || "Sin descripción"}</dd>
        <dt className="font-medium">Estado</dt><dd>{program.status}</dd>
        <dt className="font-medium">Inicio</dt><dd>{program.startDate ?? "Sin fecha"}</dd>
        <dt className="font-medium">Fin</dt><dd>{program.endDate ?? "Sin fecha"}</dd>
      </dl>
      <AssignedActivityList programId={programId} section="summary" />
      </>}
      {section === "activities" && <AssignedActivityList programId={programId} section="activities" />}
    </div>}
  </div>;
}

type ActivitySessionGroup = { id: string; name: string; activities: AssignedActivity[] };
type ActivityDimensionGroup = { id: string; name: string; sessions: ActivitySessionGroup[] };

function groupAssignedActivities(activities: AssignedActivity[]): ActivityDimensionGroup[] {
  const dimensions = new Map<string, ActivityDimensionGroup & { sessionMap: Map<string, ActivitySessionGroup> }>();
  for (const activity of [...activities].sort(compareAssignedActivityOrder)) {
    let dimension = dimensions.get(activity.moduleId);
    if (!dimension) {
      dimension = { id: activity.moduleId, name: activity.dimensionName, sessions: [], sessionMap: new Map() };
      dimensions.set(activity.moduleId, dimension);
    }
    let session = dimension.sessionMap.get(activity.sessionId);
    if (!session) {
      session = { id: activity.sessionId, name: activity.sessionName, activities: [] };
      dimension.sessionMap.set(activity.sessionId, session);
      dimension.sessions.push(session);
    }
    session.activities.push(activity);
  }
  return [...dimensions.values()].map(dimension => ({
    id: dimension.id,
    name: dimension.name,
    sessions: dimension.sessions.map(session => ({
      ...session, activities: [...session.activities].sort((left, right) => left.position - right.position),
    })),
  }));
}

function AssignedActivityList({ programId, section }: { programId: string; section: "summary" | "activities" }) {
  const shared = useCollaboratorActivities();
  const [localActivities, setLocalActivities] = useState<AssignedActivity[]>();
  const [localMessage, setLocalMessage] = useState("Cargando actividades asignadas…");
  const activities = shared?.activities ?? localActivities;
  const message = shared?.message ?? localMessage;

  useEffect(() => {
    if (shared) return;
    const controller = new AbortController();
    listMyProgramActivities(programId, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setLocalActivities(result.items);
      setLocalMessage(result.items.length ? "" : "Todavía no tienes actividades asignadas en este programa.");
    }).catch(error => {
      if (!controller.signal.aborted) setLocalMessage(activityErrorMessage(error));
    });
    return () => controller.abort();
  }, [programId, shared]);

  function updateActivity(updated: AssignedActivity) {
    if (shared) shared.updateActivity(updated);
    else setLocalActivities(current => current?.map(activity => activity.id === updated.id ? updated : activity));
  }

  return <div className="space-y-8">
    {section === "summary" && activities && <CollaboratorProgressOverview activities={activities} />}
    {section === "activities" && <section aria-labelledby="assigned-activities-title">
    {activities && activities.length > 0 && <NextActivityNotice activities={activities} />}
    <h2 id="assigned-activities-title" className="text-xl font-semibold">Actividades asignadas</h2>
    {message && <p role="status" className="mt-3 rounded-2xl bg-muted/60 px-4 py-3 text-sm">{message}</p>}
    {activities && activities.length > 0 && <div className="mt-4 space-y-4">
      {groupAssignedActivities(activities).map(dimension => {
        const dimensionTotal = dimension.sessions.reduce((total, session) => total + session.activities.length, 0);
        return <details key={dimension.id} className="group/dimension overflow-hidden rounded-2xl border border-border/70 bg-background/65">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 marker:hidden sm:px-5 [&::-webkit-details-marker]:hidden">
            <span><span className="rti-kicker block">Dimensión</span>
              <span className="mt-1 block text-lg font-semibold">{dimension.name}</span></span>
            <span className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
              {dimensionTotal} {dimensionTotal === 1 ? "actividad" : "actividades"}
              <ChevronDown aria-hidden="true" className="size-5 transition-transform group-open/dimension:rotate-180" />
            </span>
          </summary>
          <div className="space-y-3 border-t border-border/70 bg-muted/20 p-3 sm:p-4">
            {dimension.sessions.map(session => <details key={session.id}
              className="group/session overflow-hidden rounded-xl border border-border/70 bg-card">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 marker:hidden [&::-webkit-details-marker]:hidden">
                <span><span className="rti-kicker block">Sesión</span>
                  <span className="mt-1 block font-semibold">{session.name}</span></span>
                <span className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                  {session.activities.length} {session.activities.length === 1 ? "actividad" : "actividades"}
                  <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open/session:rotate-180" />
                </span>
              </summary>
              <ol className="space-y-3 border-t border-border/70 p-3 sm:p-4">
                {session.activities.map(activity => <AssignedActivityAccordion key={activity.id} programId={programId}
                  activity={activity} onSubmitted={updateActivity} />)}
              </ol>
            </details>)}
          </div>
        </details>;
      })}
    </div>}
    </section>}
  </div>;
}

function NextActivityNotice({ activities }: { activities: AssignedActivity[] }) {
  const pending = pendingAssignedActivities(activities);
  const next = pending[0];
  if (!next) return <aside aria-label="Estado de tus actividades"
    className="mb-6 rounded-2xl border border-border bg-[var(--brand-mist)] px-5 py-4">
    <p className="rti-kicker">Estás al día</p>
    <p className="mt-2 font-semibold">No tienes actividades pendientes por completar.</p>
  </aside>;

  const nextStep = next.survey?.status === "PENDING" ? "Completa la encuesta pendiente"
    : next.assignmentStatus === "CHANGES_REQUESTED" ? "Realiza los cambios solicitados"
      : "Completa esta actividad";
  return <aside aria-label="Tu próxima actividad"
    className="mb-6 overflow-hidden rounded-2xl border border-[var(--brand-pink)] bg-[var(--brand-mist)]">
    <div className="flex gap-4 p-5 sm:p-6">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--brand-black)] text-white">
        <Flag aria-hidden="true" className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="rti-kicker">Tu próxima actividad</p>
        <h2 className="mt-2 break-words text-xl font-semibold">{next.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {next.dimensionName} · {next.sessionName} · Actividad {next.position}
        </p>
        <p className="mt-3 text-sm font-semibold">{nextStep}</p>
        <p className="mt-1 text-sm text-muted-foreground">Fecha límite: {next.dueDate}</p>
        {pending.length > 1 && <p className="mt-3 text-xs font-medium text-muted-foreground">
          Después de esta tienes {pending.length - 1} {pending.length === 2 ? "actividad pendiente" : "actividades pendientes"}.
        </p>}
      </div>
    </div>
  </aside>;
}

function AssignedActivityAccordion({ programId, activity, onSubmitted }: {
  programId: string; activity: AssignedActivity; onSubmitted: (activity: AssignedActivity) => void;
}) {
  return <li id={`activity-${activity.id}`}><details className="group/activity overflow-hidden rounded-xl border border-border/70 bg-background">
    <summary className="flex cursor-pointer list-none flex-col gap-3 px-4 py-3 marker:hidden sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden">
      <span><span className="rti-kicker block">Actividad {activity.position}</span>
        <span className="mt-1 block font-semibold">{activity.title}</span></span>
      <span className="flex items-center justify-between gap-3 sm:justify-end">
        <ActivityStatusBadges status={activity.assignmentStatus} dueDate={activity.dueDate}
          surveyStatus={activity.survey?.status} />
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform group-open/activity:rotate-180" />
      </span>
    </summary>
    <div className="border-t border-border/70 p-4">
      <AssignedActivityCard programId={programId} activity={activity} onSubmitted={onSubmitted} />
    </div>
  </details></li>;
}

function AssignedActivityCard({ programId, activity, onSubmitted }: {
  programId: string; activity: AssignedActivity; onSubmitted: (activity: AssignedActivity) => void;
}) {
  const [response, setResponse] = useState(activity.responseText ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const editable = activity.assignmentStatus === "ASSIGNED" || activity.assignmentStatus === "CHANGES_REQUESTED";

  async function submit() {
    const clean = response.trim();
    if (!clean) { setMessage("Escribe tu respuesta antes de completar la actividad."); return; }
    setPending(true); setMessage("Enviando actividad…");
    try {
      const saved = await submitMyActivity(programId, activity.id, clean);
      setMessage(saved.survey?.status === "PENDING"
        ? "Entrega enviada. Completa la encuesta para finalizar la actividad."
        : "Actividad enviada para revisión.");
      onSubmitted(saved);
    } catch (error) {
      setMessage(activityErrorMessage(error));
    } finally { setPending(false); }
  }

  return <div>
    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{activity.instructions}</p>
    {activity.youtubeUrl && <a href={activity.youtubeUrl} target="_blank" rel="noopener noreferrer"
      className="rti-link mt-3 inline-block text-sm">Ver video en YouTube</a>}
    <p className="mt-3 text-sm font-medium">Fecha límite: {activity.dueDate}</p>
    <div className="mt-4 rounded-xl border border-border/70 bg-muted/35 p-3">
      <div className="flex items-center justify-between gap-3 text-sm"><span className="font-medium">Avance de la actividad</span>
        <strong className="text-primary">{activity.completionPercentage}%</strong></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar"
        aria-label={`Avance de ${activity.title}: ${activity.completionPercentage}%`}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={activity.completionPercentage}>
        <div className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${activity.completionPercentage}%` }} />
      </div>
      {activity.survey && <p className="mt-2 text-xs text-muted-foreground">
        Entrega de la actividad: 50% · Encuesta: 50%
      </p>}
    </div>
    {activity.reviewComment && <p className="mt-4 rounded-xl border border-primary/20 bg-accent/40 px-3 py-2 text-sm">
      Comentario del consultor: {activity.reviewComment}</p>}
    {editable ? <div className="mt-4 space-y-3">
      <label htmlFor={`response-${activity.id}`} className="block text-sm font-medium">Tu respuesta</label>
      <textarea id={`response-${activity.id}`} className="rti-field min-h-32 resize-y" maxLength={10000}
        value={response} onChange={event => setResponse(event.target.value)} disabled={pending} />
      <button type="button" className="rti-button-primary" disabled={pending} onClick={() => void submit()}>
        {pending ? "Enviando…" : activity.assignmentStatus === "CHANGES_REQUESTED" ? "Enviar corrección"
          : activity.survey ? "Enviar actividad (50%)" : "Completar actividad"}
      </button>
    </div> : activity.responseText && <div className="mt-4 text-sm"><p className="font-medium">Tu respuesta</p>
      <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{activity.responseText}</p></div>}
    {message && <p role="status" className="mt-3 rounded-xl bg-muted/60 px-3 py-2 text-sm">{message}</p>}
    {activity.survey?.status === "LOCKED" && <p className="mt-4 rounded-xl border border-border/70 bg-muted/45 px-3 py-3 text-sm text-muted-foreground">
      La encuesta se habilitará después de enviar la actividad y completará el 50% restante.
    </p>}
    {activity.survey?.status === "PENDING" && <ActivitySurveyForm programId={programId} activityId={activity.id}
      survey={activity.survey} onCompleted={submission => onSubmitted({ ...activity,
        survey: { ...activity.survey!, status: "COMPLETED", completedAt: submission.completedAt },
        completionPercentage: 100 })} />}
    {activity.survey?.status === "COMPLETED" && <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-medium text-emerald-900">
      Encuesta completada. Cumpliste los dos pasos de la actividad.
    </p>}
  </div>;
}
