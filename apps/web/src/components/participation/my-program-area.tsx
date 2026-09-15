"use client";

import Link from "next/link";
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
  type AssignedActivity } from "@/lib/participation/activity-api";

const button = "rti-button-secondary";

export function MyProgramArea({ mode, programId }: { mode: "list" | "detail"; programId?: string }) {
  return <section className="rti-surface mx-auto w-full max-w-5xl p-6 sm:p-8 lg:p-10">
    <p className="rti-kicker">Área del colaborador</p>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{mode === "detail" ? "Detalle del programa" : "Mis programas"}</h1>
    <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
      {mode === "detail" ? "Información básica de uno de tus programas asignados." : "Programas asociados a tus inscripciones activas o completadas."}
    </p>
    {mode === "detail" && programId ? <MyProgramDetail programId={programId} /> : <MyProgramList />}
    <nav aria-label="Navegación de mis programas" className="mt-8 flex flex-wrap gap-4 border-t border-border/70 pt-6 text-sm">
      {mode === "detail" && <Link href={myProgramsPath()} className="rti-link">Volver a Mis programas</Link>}
      <Link href="/account" className="rti-link">Volver a Cuenta</Link>
    </nav>
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

function MyProgramDetail({ programId }: { programId: string }) {
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
      <dl className="grid gap-x-8 gap-y-2 break-words rounded-2xl border border-border/70 bg-background/70 p-5 sm:grid-cols-[auto_1fr]">
        <dt className="font-medium">Nombre</dt><dd>{program.name}</dd>
        <dt className="font-medium">Organización</dt><dd>{program.organizationName}</dd>
        <dt className="font-medium">Descripción</dt><dd className="whitespace-pre-wrap">{program.description || "Sin descripción"}</dd>
        <dt className="font-medium">Estado</dt><dd>{program.status}</dd>
        <dt className="font-medium">Inicio</dt><dd>{program.startDate ?? "Sin fecha"}</dd>
        <dt className="font-medium">Fin</dt><dd>{program.endDate ?? "Sin fecha"}</dd>
      </dl>
      <AssignedActivityList programId={programId} />
    </div>}
  </div>;
}

function AssignedActivityList({ programId }: { programId: string }) {
  const [activities, setActivities] = useState<AssignedActivity[]>();
  const [message, setMessage] = useState("Cargando actividades asignadas…");

  useEffect(() => {
    const controller = new AbortController();
    listMyProgramActivities(programId, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setActivities(result.items);
      setMessage(result.items.length ? "" : "Todavía no tienes actividades asignadas en este programa.");
    }).catch(error => {
      if (!controller.signal.aborted) setMessage(activityErrorMessage(error));
    });
    return () => controller.abort();
  }, [programId]);

  return <section aria-labelledby="assigned-activities-title">
    <h2 id="assigned-activities-title" className="text-xl font-semibold">Actividades asignadas</h2>
    {message && <p role="status" className="mt-3 rounded-2xl bg-muted/60 px-4 py-3 text-sm">{message}</p>}
    {activities && activities.length > 0 && <ol className="mt-4 grid gap-4 sm:grid-cols-2">
      {activities.map(activity => <AssignedActivityCard key={activity.id} programId={programId} activity={activity}
        onSubmitted={updated => setActivities(current => current?.map(item => item.id === updated.id ? updated : item))} />)}
    </ol>}
  </section>;
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
      setMessage("Actividad enviada para revisión.");
      onSubmitted(saved);
    } catch (error) {
      setMessage(activityErrorMessage(error));
    } finally { setPending(false); }
  }

  return <li className="rounded-2xl border border-border/70 bg-background/70 p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="rti-kicker">Actividad {activity.position}</p>
      <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{collaboratorStatusLabel(activity.assignmentStatus)}</span>
    </div>
    <h3 className="mt-2 text-lg font-semibold">{activity.title}</h3>
    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{activity.instructions}</p>
    {activity.youtubeUrl && <a href={activity.youtubeUrl} target="_blank" rel="noopener noreferrer"
      className="rti-link mt-3 inline-block text-sm">Ver video en YouTube</a>}
    <p className="mt-3 text-sm font-medium">Fecha límite: {activity.dueDate}</p>
    {activity.reviewComment && <p className="mt-4 rounded-xl border border-primary/20 bg-accent/40 px-3 py-2 text-sm">
      Comentario del consultor: {activity.reviewComment}</p>}
    {editable ? <div className="mt-4 space-y-3">
      <label htmlFor={`response-${activity.id}`} className="block text-sm font-medium">Tu respuesta</label>
      <textarea id={`response-${activity.id}`} className="rti-field min-h-32 resize-y" maxLength={10000}
        value={response} onChange={event => setResponse(event.target.value)} disabled={pending} />
      <button type="button" className="rti-button-primary" disabled={pending} onClick={() => void submit()}>
        {pending ? "Enviando…" : activity.assignmentStatus === "CHANGES_REQUESTED" ? "Enviar corrección" : "Completar actividad"}
      </button>
    </div> : activity.responseText && <div className="mt-4 text-sm"><p className="font-medium">Tu respuesta</p>
      <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{activity.responseText}</p></div>}
    {message && <p role="status" className="mt-3 rounded-xl bg-muted/60 px-3 py-2 text-sm">{message}</p>}
  </li>;
}

function collaboratorStatusLabel(status: AssignedActivity["assignmentStatus"]) {
  return { ASSIGNED: "Pendiente", SUBMITTED: "En revisión", CHANGES_REQUESTED: "Requiere cambios",
    COMPLETED: "Completada" }[status];
}
