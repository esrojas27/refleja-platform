"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { fetchCurrentIdentity, IdentityRequestError } from "@/lib/auth/authenticated-api";
import { listEnrollments, ParticipationRequestError, type Enrollment } from "@/lib/participation/participation-api";
import { ActivityRequestError, activityErrorMessage, createProgramActivity, listProgramActivities,
  reviewActivityAssignment, type ActivityAssignee, type ActivityInput, type ProgramActivity }
  from "@/lib/participation/activity-api";
import { listProgramModules, ProgramContentRequestError, type ProgramModule } from "@/lib/programs/program-content-api";

type SessionOption = { id: string; label: string };

export function ProgramActivityArea({ organizationId, programId }: { organizationId: string; programId: string }) {
  return <ActivityContent key={`${organizationId}/${programId}`} organizationId={organizationId} programId={programId} />;
}

function ActivityContent({ organizationId, programId }: { organizationId: string; programId: string }) {
  const [modules, setModules] = useState<ProgramModule[]>();
  const [enrollments, setEnrollments] = useState<Enrollment[]>();
  const [activities, setActivities] = useState<ProgramActivity[]>();
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(true);
  const [message, setMessage] = useState("Comprobando acceso y cargando actividades…");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const identity = await fetchCurrentIdentity(organizationId, controller.signal);
        if (identity.activeOrganizationId !== organizationId || !identity.roles.includes("CONSULTANT")) {
          setMessage("Sólo un consultor autorizado puede gestionar actividades."); return;
        }
        const [structure, enrollmentPage, activityList] = await Promise.all([
          listProgramModules(organizationId, programId, controller.signal),
          listEnrollments(organizationId, programId, 0, controller.signal, 100),
          listProgramActivities(organizationId, programId, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setModules(structure.items);
        setEnrollments(enrollmentPage.items.filter(enrollment => enrollment.status === "ACTIVE"));
        setActivities(activityList.items);
        setMessage("");
      } catch (error) {
        if (controller.signal.aborted) return;
        const normalized = error instanceof IdentityRequestError || error instanceof ProgramContentRequestError
          || error instanceof ParticipationRequestError ? new ActivityRequestError(error.status) : error;
        setMessage(activityErrorMessage(normalized));
      } finally { if (!controller.signal.aborted) setPending(false); }
    }
    void load();
    return () => controller.abort();
  }, [organizationId, programId, attempt]);

  const sessions = useMemo(() => (modules ?? []).flatMap(module => module.sessions.map(session => ({
    id: session.id, label: `${module.name} · ${session.name}`,
  }))), [modules]);
  const sessionNames = useMemo(() => new Map(sessions.map(session => [session.id, session.label])), [sessions]);

  function refresh(saved?: ProgramActivity) {
    setModules(undefined); setEnrollments(undefined); setActivities(undefined);
    setPending(true); setMessage("Actualizando actividades…");
    if (saved) setNotice(`Actividad creada y asignada a ${saved.assignees.length} colaborador${saved.assignees.length === 1 ? "" : "es"}.`);
    setAttempt(value => value + 1);
  }

  return <section className="rti-surface w-full p-6 sm:p-8 lg:p-10">
    <p className="rti-kicker">Ejecución del programa</p>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Actividades</h1>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
      Crea una actividad dentro de una sesión y asígnala a colaboradores con inscripción activa.
    </p>
    {notice && <p role="status" className="mt-5 rounded-2xl border border-accent bg-accent/60 px-4 py-3 text-sm">{notice}</p>}
    {message && <p role="status" className="mt-5 rounded-2xl bg-muted/60 px-4 py-3 text-sm">{message}</p>}
    {modules && enrollments && activities && <div className="mt-7 grid gap-8 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <div className="rounded-2xl border border-border/70 bg-background/70 p-5 sm:p-6">
        <ActivityForm organizationId={organizationId} programId={programId} sessions={sessions}
          enrollments={enrollments} activities={activities} onSaved={refresh} />
      </div>
      <section aria-labelledby="activity-list-title">
        <h2 id="activity-list-title" className="text-xl font-semibold">Actividades creadas</h2>
        {activities.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Aún no hay actividades en este programa.</p>
          : <ol className="mt-4 space-y-4">{activities.map(activity => <li key={activity.id}
            className="rounded-2xl border border-border/70 bg-background/70 p-5">
            <p className="rti-kicker">{sessionNames.get(activity.sessionId) ?? "Sesión"} · Actividad {activity.position}</p>
            <h3 className="mt-2 text-lg font-semibold">{activity.title}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{activity.instructions}</p>
            <p className="mt-3 text-sm font-medium">Fecha límite: {activity.dueDate}</p>
            <div className="mt-4 space-y-3"><p className="text-sm font-medium">Seguimiento por colaborador</p>
              {activity.assignees.map(assignee => <ReviewPanel key={assignee.assignmentId}
                organizationId={organizationId} programId={programId} activityId={activity.id}
                assignee={assignee} onReviewed={() => refresh()} />)}
            </div>
          </li>)}</ol>}
      </section>
    </div>}
    <button className="rti-button-secondary mt-6" disabled={pending} onClick={() => refresh()}>Actualizar actividades</button>
    <nav aria-label="Navegación de actividades" className="mt-8 flex flex-wrap gap-4 border-t border-border/70 pt-6 text-sm">
      <Link href={`/organizations/${encodeURIComponent(organizationId)}/programs/${encodeURIComponent(programId)}`} className="rti-link">Volver al programa</Link>
      <Link href="/account" className="rti-link">Volver a Cuenta</Link>
    </nav>
  </section>;
}

export function ActivityForm({ organizationId, programId, sessions, enrollments, activities, onSaved }: {
  organizationId: string; programId: string; sessions: SessionOption[]; enrollments: Enrollment[];
  activities: ProgramActivity[]; onSaved: (saved: ProgramActivity) => void;
}) {
  const [input, setInput] = useState({ sessionId: sessions[0]?.id ?? "", title: "", instructions: "", dueDate: "" });
  const [selected, setSelected] = useState<string[]>([]);
  const [assignToAll, setAssignToAll] = useState(true);
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  function toggle(enrollmentId: string) {
    setSelected(current => current.includes(enrollmentId)
      ? current.filter(id => id !== enrollmentId) : [...current, enrollmentId]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || blocked) return;
    const position = Math.max(0, ...activities.filter(activity => activity.sessionId === input.sessionId)
      .map(activity => activity.position)) + 1;
    const clean: ActivityInput = { sessionId: input.sessionId, title: input.title.trim(),
      instructions: input.instructions.trim(), dueDate: input.dueDate, position, assignToAll,
      enrollmentIds: assignToAll ? [] : selected };
    if (!clean.sessionId || !clean.title || clean.title.length > 255 || !clean.instructions
        || clean.instructions.length > 10000 || !/^\d{4}-\d{2}-\d{2}$/.test(clean.dueDate)
        || (!assignToAll && !selected.length)) {
      setMessage("Completa la sesión, el título, las instrucciones, la fecha límite y los destinatarios."); return;
    }
    submitting.current = true; setPending(true); setMessage("Creando y asignando actividad…");
    const controller = new AbortController(); request.current = controller;
    try {
      const saved = await createProgramActivity(organizationId, programId, clean, controller.signal);
      if (!controller.signal.aborted) { setBlocked(true); setMessage("Actividad creada y asignada."); onSaved(saved); }
    } catch (error) {
      if (!controller.signal.aborted) {
        const failure = error instanceof ActivityRequestError ? error : new ActivityRequestError(0);
        setBlocked(failure.status === 0 || failure.status >= 500 || [401, 403, 404, 409].includes(failure.status));
        setMessage(activityErrorMessage(failure));
      }
    } finally { submitting.current = false; if (!controller.signal.aborted) setPending(false); }
  }

  const unavailable = sessions.length === 0 || enrollments.length === 0;
  return <form aria-label="Crear actividad" onSubmit={submit} noValidate className="space-y-5">
    <div><p className="rti-kicker">Nueva actividad</p><h2 className="mt-2 text-xl font-semibold">Crear y asignar</h2></div>
    {message && <p role="status" className="rounded-xl bg-muted/60 px-3 py-2 text-sm">{message}</p>}
    {sessions.length === 0 && <p className="text-sm text-muted-foreground">Crea primero una sesión en Contenido.</p>}
    {enrollments.length === 0 && <p className="text-sm text-muted-foreground">Necesitas al menos un colaborador con inscripción activa.</p>}
    <div><label htmlFor="activity-session" className="block text-sm font-medium">Sesión</label>
      <select id="activity-session" className="rti-field" value={input.sessionId}
        onChange={event => setInput({ ...input, sessionId: event.target.value })} disabled={pending || blocked || unavailable}>
        {sessions.map(session => <option key={session.id} value={session.id}>{session.label}</option>)}
      </select></div>
    <div><label htmlFor="activity-title" className="block text-sm font-medium">Título</label>
      <input id="activity-title" className="rti-field" required maxLength={255} value={input.title}
        onChange={event => setInput({ ...input, title: event.target.value })} disabled={pending || blocked || unavailable} /></div>
    <div><label htmlFor="activity-instructions" className="block text-sm font-medium">Instrucciones</label>
      <textarea id="activity-instructions" className="rti-field min-h-32 resize-y" required maxLength={10000}
        value={input.instructions} onChange={event => setInput({ ...input, instructions: event.target.value })}
        disabled={pending || blocked || unavailable} /></div>
    <div><label htmlFor="activity-due-date" className="block text-sm font-medium">Fecha límite</label>
      <input id="activity-due-date" type="date" className="rti-field" required value={input.dueDate}
        onChange={event => setInput({ ...input, dueDate: event.target.value })} disabled={pending || blocked || unavailable} /></div>
    <fieldset disabled={pending || blocked || unavailable} className="space-y-3">
      <legend className="text-sm font-medium">Destinatarios</legend>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-primary/25 bg-accent/35 px-3 py-3 text-sm">
        <input type="checkbox" className="mt-1 size-4 accent-primary" checked={assignToAll}
          onChange={event => setAssignToAll(event.target.checked)} />
        <span><span className="block font-medium">Asignar a todos los colaboradores activos</span>
          <span className="text-muted-foreground">Incluye a todas las inscripciones activas del programa.</span></span>
      </label>
      {!assignToAll && enrollments.map(enrollment => <label key={enrollment.id}
        className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 px-3 py-3 text-sm">
        <input type="checkbox" className="mt-1 size-4 accent-primary" checked={selected.includes(enrollment.id)}
          onChange={() => toggle(enrollment.id)} />
        <span><span className="block font-medium">{[enrollment.participant.firstName, enrollment.participant.lastName]
          .filter(Boolean).join(" ") || enrollment.participant.email}</span><span className="text-muted-foreground">{enrollment.participant.email}</span></span>
      </label>)}
    </fieldset>
    <button className="rti-button-primary" disabled={pending || blocked || unavailable}>
      {pending ? "Creando…" : "Crear y asignar actividad"}
    </button>
  </form>;
}

function ReviewPanel({ organizationId, programId, activityId, assignee, onReviewed }: {
  organizationId: string; programId: string; activityId: string; assignee: ActivityAssignee;
  onReviewed: () => void;
}) {
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const name = [assignee.firstName, assignee.lastName].filter(Boolean).join(" ") || assignee.email;

  async function review(decision: "APPROVE" | "REQUEST_CHANGES") {
    const cleanComment = comment.trim();
    if (decision === "REQUEST_CHANGES" && !cleanComment) {
      setMessage("Escribe qué debe ajustar el colaborador."); return;
    }
    setPending(true); setMessage("Guardando revisión…");
    try {
      await reviewActivityAssignment(organizationId, programId, activityId, assignee.assignmentId,
        { decision, comment: cleanComment || null });
      setMessage(decision === "APPROVE" ? "Actividad aprobada." : "Cambios solicitados.");
      onReviewed();
    } catch (error) {
      setMessage(activityErrorMessage(error));
    } finally { setPending(false); }
  }

  return <article className="rounded-xl border border-border/70 bg-card/80 p-4 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><p className="font-medium">{name}</p><p className="text-muted-foreground">{assignee.email}</p></div>
      <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{assignmentStatusLabel(assignee.status)}</span>
    </div>
    {assignee.responseText && <div className="mt-3"><p className="font-medium">Respuesta</p>
      <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{assignee.responseText}</p></div>}
    {assignee.reviewComment && <p className="mt-3 text-muted-foreground">Comentario de revisión: {assignee.reviewComment}</p>}
    {assignee.status === "SUBMITTED" && <div className="mt-4 space-y-3">
      <label className="block font-medium" htmlFor={`review-${assignee.assignmentId}`}>Comentario de revisión</label>
      <textarea id={`review-${assignee.assignmentId}`} className="rti-field min-h-24 resize-y" maxLength={5000}
        value={comment} onChange={event => setComment(event.target.value)} disabled={pending} />
      {message && <p role="status" className="rounded-xl bg-muted/60 px-3 py-2">{message}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" className="rti-button-primary" disabled={pending}
          onClick={() => void review("APPROVE")}>Aprobar actividad</button>
        <button type="button" className="rti-button-secondary" disabled={pending}
          onClick={() => void review("REQUEST_CHANGES")}>Solicitar cambios</button>
      </div>
    </div>}
  </article>;
}

function assignmentStatusLabel(status: ActivityAssignee["status"]) {
  return { ASSIGNED: "Pendiente", SUBMITTED: "Por revisar", CHANGES_REQUESTED: "Requiere cambios",
    COMPLETED: "Completada" }[status];
}
