"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, ClipboardCheck } from "lucide-react";
import { fetchCurrentIdentity, IdentityRequestError } from "@/lib/auth/authenticated-api";
import { listEnrollments, ParticipationRequestError, type Enrollment } from "@/lib/participation/participation-api";
import { ActivityRequestError, activityErrorMessage, createProgramActivity, listProgramActivities,
  isYoutubeVideoUrl, reviewActivityAssignment, type ActivityAssignee, type ActivityInput, type ProgramActivity }
  from "@/lib/participation/activity-api";
import { listProgramDimensions, ProgramContentRequestError, type ProgramDimension } from "@/lib/programs/program-content-api";
import { ActivityStatusBadges } from "@/components/participation/progress-overview";
import { ProgramModal } from "@/components/programs/program-modal";

export type SessionOption = { id: string; label: string };

export function ProgramActivityArea({ organizationId, programId }: { organizationId: string; programId: string }) {
  return <ActivityContent key={`${organizationId}/${programId}`} organizationId={organizationId} programId={programId} />;
}

function ActivityContent({ organizationId, programId }: { organizationId: string; programId: string }) {
  const [dimensions, setDimensions] = useState<ProgramDimension[]>();
  const [enrollments, setEnrollments] = useState<Enrollment[]>();
  const [activities, setActivities] = useState<ProgramActivity[]>();
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(true);
  const [message, setMessage] = useState("Comprobando acceso y cargando actividades…");
  const [notice, setNotice] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const identity = await fetchCurrentIdentity(organizationId, controller.signal);
        if (identity.activeOrganizationId !== organizationId || !identity.roles.includes("CONSULTANT")) {
          setMessage("Sólo un consultor autorizado puede gestionar actividades."); return;
        }
        const [structure, enrollmentPage, activityList] = await Promise.all([
          listProgramDimensions(organizationId, programId, controller.signal),
          listEnrollments(organizationId, programId, 0, controller.signal, 100),
          listProgramActivities(organizationId, programId, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setDimensions(structure.items);
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

  const sessions = useMemo(() => (dimensions ?? []).flatMap(dimension => dimension.sessions.map(session => ({
    id: session.id, label: `${dimension.name} · ${session.name}`,
  }))), [dimensions]);
  const sessionNames = useMemo(() => new Map(sessions.map(session => [session.id, session.label])), [sessions]);

  function refresh(saved?: ProgramActivity) {
    setDimensions(undefined); setEnrollments(undefined); setActivities(undefined);
    setPending(true); setMessage("Actualizando actividades…");
    if (saved) setNotice(saved.assignees.length === 0 ? "Actividad creada sin asignaciones."
      : `Actividad creada y asignada a ${saved.assignees.length} colaborador${saved.assignees.length === 1 ? "" : "es"}.`);
    setAttempt(value => value + 1);
  }

  function reviewed(activityId: string, assignee: ActivityAssignee) {
    setActivities(current => current?.map(activity => activity.id !== activityId ? activity : {
      ...activity,
      assignees: activity.assignees.map(item => item.assignmentId === assignee.assignmentId ? assignee : item),
    }));
  }

  return <section className="rti-surface w-full p-6 sm:p-8 lg:p-10">
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="rti-kicker">Ejecución del programa</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Actividades</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Crea actividades, consulta su alcance y revisa las respuestas pendientes.
        </p>
      </div>
      {dimensions && enrollments && activities && <button type="button" className="rti-button-primary shrink-0"
        onClick={() => setCreateOpen(true)}>{enrollments.length ? "Crear y asignar" : "Crear actividad"}</button>}
    </div>
    {notice && <p role="status" className="mt-5 rounded-2xl border border-accent bg-accent/60 px-4 py-3 text-sm">{notice}</p>}
    {message && <p role="status" className="mt-5 rounded-2xl bg-muted/60 px-4 py-3 text-sm">{message}</p>}
    {dimensions && enrollments && activities && <div className="mt-7 space-y-8">
      <ReviewQueue organizationId={organizationId} programId={programId} activities={activities}
        onReviewed={reviewed} />
      <section aria-labelledby="activity-list-title" className="border-t border-border/70 pt-7">
        <h2 id="activity-list-title" className="text-xl font-semibold">Actividades creadas</h2>
        {activities.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Aún no hay actividades en este programa.</p>
          : <ol className="mt-4 space-y-4">{activities.map(activity => <li key={activity.id}
            className="rounded-2xl border border-border/70 bg-background/70 p-5">
            <p className="rti-kicker">{sessionNames.get(activity.sessionId) ?? "Sesión"} · Actividad {activity.position}</p>
            <h3 className="mt-2 text-lg font-semibold">{activity.title}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{activity.instructions}</p>
            {activity.youtubeUrl && <a href={activity.youtubeUrl} target="_blank" rel="noopener noreferrer"
              className="rti-link mt-3 inline-block text-sm">Ver video en YouTube</a>}
            <p className="mt-3 text-sm font-medium">Fecha límite: {activity.dueDate}</p>
            <div className="mt-4 flex flex-wrap gap-2" aria-label={`Estado de asignaciones de ${activity.title}`}>
              {assignmentSummary(activity).map(item => <span key={item.label}
                className="rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
                {item.label}: {item.count}
              </span>)}
            </div>
          </li>)}</ol>}
      </section>
    </div>}
    {createOpen && dimensions && enrollments && activities && <ProgramModal titleId="create-activity-title"
      closeLabel="Cerrar creación de actividad" onClose={() => setCreateOpen(false)}>
      <ActivityForm organizationId={organizationId} programId={programId} sessions={sessions}
        enrollments={enrollments} activities={activities} onSaved={saved => { setCreateOpen(false); refresh(saved); }} />
    </ProgramModal>}
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
  const [input, setInput] = useState({ sessionId: sessions[0]?.id ?? "", title: "", instructions: "", youtubeUrl: "", dueDate: "" });
  const [selected, setSelected] = useState<string[]>([]);
  const [assignToAll, setAssignToAll] = useState(true);
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState("");
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  const submitting = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  function toggle(enrollmentId: string) {
    setInvalidFields(current => current.filter(field => field !== "enrollmentIds"));
    setSelected(current => current.includes(enrollmentId)
      ? current.filter(id => id !== enrollmentId) : [...current, enrollmentId]);
  }

  function clearInvalid(field: string) {
    setInvalidFields(current => current.filter(candidate => candidate !== field));
  }

  function focusFirstInvalid(fields: string[]) {
    const ids: Record<string, string> = {
      sessionId: "activity-session", title: "activity-title", instructions: "activity-instructions",
      youtubeUrl: "activity-youtube-url", dueDate: "activity-due-date", enrollmentIds: "activity-assign-to-all",
    };
    window.setTimeout(() => document.getElementById(ids[fields[0]])?.focus(), 0);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || blocked) return;
    const position = Math.max(0, ...activities.filter(activity => activity.sessionId === input.sessionId)
      .map(activity => activity.position)) + 1;
    const clean: ActivityInput = { sessionId: input.sessionId, title: input.title.trim(),
      instructions: input.instructions.trim(), youtubeUrl: input.youtubeUrl.trim() || null,
      dueDate: input.dueDate, position, assignToAll,
      enrollmentIds: assignToAll ? [] : selected };
    const invalid = [
      ...(!clean.sessionId ? ["sessionId"] : []),
      ...(!clean.title || clean.title.length > 255 ? ["title"] : []),
      ...(!clean.instructions || clean.instructions.length > 10000 ? ["instructions"] : []),
      ...(clean.youtubeUrl !== null && !isYoutubeVideoUrl(clean.youtubeUrl) ? ["youtubeUrl"] : []),
      ...(!/^\d{4}-\d{2}-\d{2}$/.test(clean.dueDate) ? ["dueDate"] : []),
      ...(!assignToAll && !selected.length ? ["enrollmentIds"] : []),
    ];
    if (invalid.length) {
      setInvalidFields(invalid);
      setMessage("Revisa los campos resaltados antes de crear la actividad.");
      focusFirstInvalid(invalid);
      return;
    }
    submitting.current = true; setPending(true);
    setMessage(enrollments.length ? "Creando y asignando actividad…" : "Creando actividad…");
    const controller = new AbortController(); request.current = controller;
    try {
      const saved = await createProgramActivity(organizationId, programId, clean, controller.signal);
      if (!controller.signal.aborted) { setBlocked(true);
        setMessage(saved.assignees.length ? "Actividad creada y asignada." : "Actividad creada sin asignaciones.");
        onSaved(saved); }
    } catch (error) {
      if (!controller.signal.aborted) {
        const failure = error instanceof ActivityRequestError ? error : new ActivityRequestError(0);
        setInvalidFields(failure.fields);
        if (failure.fields.length) focusFirstInvalid(failure.fields);
        setBlocked(failure.status === 0 || failure.status >= 500 || [401, 403, 404, 409].includes(failure.status));
        setMessage(activityErrorMessage(failure));
      }
    } finally { submitting.current = false; if (!controller.signal.aborted) setPending(false); }
  }

  const unavailable = sessions.length === 0;
  return <form aria-label="Crear actividad" onSubmit={submit} noValidate className="space-y-5">
    <div><p className="rti-kicker">Nueva actividad</p><h2 id="create-activity-title" className="mt-2 text-xl font-semibold">
      {enrollments.length ? "Crear y asignar" : "Crear actividad"}</h2></div>
    {message && <p role="status" className="rounded-xl bg-muted/60 px-3 py-2 text-sm">{message}</p>}
    {sessions.length === 0 && <p className="text-sm text-muted-foreground">Crea primero una sesión en Contenido.</p>}
    {enrollments.length === 0 && <p className="rounded-xl border border-border/70 bg-muted/60 px-3 py-3 text-sm text-muted-foreground">
      Puedes preparar esta actividad sin participantes. Quedará como contenido del programa y no será visible para colaboradores hasta que tenga asignaciones.
    </p>}
    <div><label htmlFor="activity-session" className="block text-sm font-medium">Sesión</label>
      <select id="activity-session" className="rti-field" value={input.sessionId}
        aria-invalid={invalidFields.includes("sessionId") || undefined}
        aria-describedby={invalidFields.includes("sessionId") ? "activity-session-error" : undefined}
        onChange={event => { clearInvalid("sessionId"); setInput({ ...input, sessionId: event.target.value }); }}
        disabled={pending || blocked || unavailable}>
        {sessions.map(session => <option key={session.id} value={session.id}>{session.label}</option>)}
      </select>
      {invalidFields.includes("sessionId") && <p id="activity-session-error" className="mt-1 text-sm text-destructive">Selecciona una sesión.</p>}</div>
    <div><label htmlFor="activity-title" className="block text-sm font-medium">Título</label>
      <input id="activity-title" className="rti-field" required maxLength={255} value={input.title}
        aria-invalid={invalidFields.includes("title") || undefined}
        aria-describedby={invalidFields.includes("title") ? "activity-title-error" : undefined}
        onChange={event => { clearInvalid("title"); setInput({ ...input, title: event.target.value }); }}
        disabled={pending || blocked || unavailable} />
      {invalidFields.includes("title") && <p id="activity-title-error" className="mt-1 text-sm text-destructive">Escribe el título de la actividad.</p>}</div>
    <div><label htmlFor="activity-instructions" className="block text-sm font-medium">Instrucciones</label>
      <textarea id="activity-instructions" className="rti-field min-h-32 resize-y" required maxLength={10000}
        value={input.instructions} aria-invalid={invalidFields.includes("instructions") || undefined}
        aria-describedby={invalidFields.includes("instructions") ? "activity-instructions-error" : undefined}
        onChange={event => { clearInvalid("instructions"); setInput({ ...input, instructions: event.target.value }); }}
        disabled={pending || blocked || unavailable} />
      {invalidFields.includes("instructions") && <p id="activity-instructions-error" className="mt-1 text-sm text-destructive">Escribe las instrucciones que debe seguir el colaborador.</p>}</div>
    <div><label htmlFor="activity-youtube-url" className="block text-sm font-medium">Video de YouTube (opcional)</label>
      <input id="activity-youtube-url" type="url" className="rti-field" maxLength={2048}
        placeholder="https://www.youtube.com/watch?v=..." value={input.youtubeUrl}
        aria-invalid={invalidFields.includes("youtubeUrl") || undefined}
        aria-describedby={invalidFields.includes("youtubeUrl") ? "activity-youtube-url-error" : undefined}
        onChange={event => { clearInvalid("youtubeUrl"); setInput({ ...input, youtubeUrl: event.target.value }); }}
        disabled={pending || blocked || unavailable} />
      {invalidFields.includes("youtubeUrl")
        ? <p id="activity-youtube-url-error" className="mt-1 text-sm text-destructive">Usa un enlace HTTPS válido de YouTube.</p>
        : <p className="mt-2 text-xs text-muted-foreground">Se mostrará como enlace. El video embebido llegará en una iteración posterior.</p>}</div>
    <div><label htmlFor="activity-due-date" className="block text-sm font-medium">Fecha límite</label>
      <input id="activity-due-date" type="date" className="rti-field" required value={input.dueDate}
        aria-invalid={invalidFields.includes("dueDate") || undefined}
        aria-describedby={invalidFields.includes("dueDate") ? "activity-due-date-error" : undefined}
        onChange={event => { clearInvalid("dueDate"); setInput({ ...input, dueDate: event.target.value }); }}
        disabled={pending || blocked || unavailable} />
      {invalidFields.includes("dueDate") && <p id="activity-due-date-error" className="mt-1 text-sm text-destructive">Selecciona la fecha límite.</p>}</div>
    {enrollments.length > 0 && <fieldset disabled={pending || blocked || unavailable} className="space-y-3">
      <legend className="text-sm font-medium">Destinatarios</legend>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-primary/25 bg-accent/35 px-3 py-3 text-sm">
        <input id="activity-assign-to-all" type="checkbox" className="mt-1 size-4 accent-primary" checked={assignToAll}
          aria-invalid={invalidFields.includes("enrollmentIds") || undefined}
          aria-describedby={invalidFields.includes("enrollmentIds") ? "activity-enrollments-error" : undefined}
          onChange={event => { clearInvalid("enrollmentIds"); setAssignToAll(event.target.checked); }} />
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
      {invalidFields.includes("enrollmentIds") && <p id="activity-enrollments-error" className="text-sm text-destructive">Selecciona al menos un colaborador o activa la asignación para todos.</p>}
    </fieldset>}
    <button className="rti-button-primary" disabled={pending || blocked || unavailable}>
      {pending ? "Creando…" : enrollments.length ? "Crear y asignar actividad" : "Crear actividad"}
    </button>
  </form>;
}

type ReviewItem = { activity: ProgramActivity; assignee: ActivityAssignee };

function ReviewQueue({ organizationId, programId, activities, onReviewed }: {
  organizationId: string; programId: string; activities: ProgramActivity[];
  onReviewed: (activityId: string, assignee: ActivityAssignee) => void;
}) {
  const queue = useMemo(() => activities.flatMap(activity => activity.assignees
    .filter(assignee => assignee.status === "SUBMITTED"
      && (assignee.surveyStatus === "NOT_REQUIRED" || assignee.surveyStatus === "COMPLETED"))
    .map(assignee => ({ activity, assignee }))), [activities]);
  const waitingForSurvey = useMemo(() => activities.flatMap(activity => activity.assignees)
    .filter(assignee => assignee.status === "SUBMITTED" && assignee.surveyStatus === "PENDING").length, [activities]);
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  function complete(item: ReviewItem, saved: ActivityAssignee) {
    setLeaving(true);
    window.setTimeout(() => {
      onReviewed(item.activity.id, saved);
      if (queue.length === 1) setOpen(false);
      setLeaving(false);
    }, 220);
  }

  return <section aria-labelledby="review-queue-title" className="rounded-3xl border border-primary/15 bg-accent/25 p-5 sm:p-7">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="rti-kicker">Bandeja de revisión</p>
        <h2 id="review-queue-title" className="mt-2 text-xl font-semibold">Revisar actividades</h2>
      </div>
      {queue.length > 0 && !open && <button type="button" className="rti-button-primary"
        onClick={() => setOpen(true)}>Revisar actividades ({queue.length})</button>}
    </div>
    {queue.length === 0 ? <div className="mt-5 flex items-center gap-3 rounded-2xl border border-border/70 bg-background/70 px-4 py-4 text-sm text-muted-foreground">
      <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 text-primary" />
      <p>{waitingForSurvey > 0
        ? `No hay actividades listas para revisar. ${waitingForSurvey} ${waitingForSurvey === 1 ? "entrega espera" : "entregas esperan"} que se complete la encuesta.`
        : "No hay actividades pendientes por revisar."}</p>
    </div> : !open ? <p className="mt-4 text-sm text-muted-foreground">
      Tienes {queue.length} {queue.length === 1 ? "respuesta pendiente" : "respuestas pendientes"}. Revísalas una por una.
    </p> : <div className="mt-5 overflow-hidden">
      <p aria-live="polite" className="mb-3 text-sm font-medium text-muted-foreground">
        {queue.length} {queue.length === 1 ? "pendiente" : "pendientes"} en la bandeja
      </p>
      <ReviewCard key={queue[0].assignee.assignmentId} item={queue[0]} organizationId={organizationId}
        programId={programId} leaving={leaving} onReviewed={saved => complete(queue[0], saved)} />
    </div>}
  </section>;
}

function ReviewCard({ organizationId, programId, item, leaving, onReviewed }: {
  organizationId: string; programId: string; item: ReviewItem; leaving: boolean;
  onReviewed: (assignee: ActivityAssignee) => void;
}) {
  const { activity, assignee } = item;
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
      const saved = await reviewActivityAssignment(organizationId, programId, activity.id, assignee.assignmentId,
        { decision, comment: cleanComment || null });
      setMessage(decision === "APPROVE" ? "Actividad aprobada." : "Cambios solicitados.");
      onReviewed(saved);
    } catch (error) {
      setMessage(activityErrorMessage(error));
    } finally { setPending(false); }
  }

  return <article className={`animate-in slide-in-from-bottom-6 fade-in rounded-2xl border border-border/70 bg-card p-5 text-sm shadow-sm transition duration-200 motion-reduce:animate-none motion-reduce:transition-none sm:p-6 ${leaving ? "-translate-y-6 opacity-0" : "translate-y-0 opacity-100"}`}>
    <div className="mb-5 flex items-start gap-3 border-b border-border/70 pb-4">
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <ClipboardCheck aria-hidden="true" className="size-5" />
      </span>
      <div><p className="rti-kicker">{activity.dimensionName} · {activity.sessionName}</p>
        <h3 className="mt-1 text-lg font-semibold">{activity.title}</h3></div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><p className="font-medium">{name}</p><p className="text-muted-foreground">{assignee.email}</p></div>
      <ActivityStatusBadges status={assignee.status} dueDate={activity.dueDate} />
    </div>
    {assignee.responseText && <div className="mt-3"><p className="font-medium">Respuesta</p>
      <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{assignee.responseText}</p></div>}
    {assignee.reviewComment && <p className="mt-3 text-muted-foreground">Comentario de revisión: {assignee.reviewComment}</p>}
    <div className="mt-4 space-y-3">
      <label className="block font-medium" htmlFor={`review-${assignee.assignmentId}`}>Comentario de revisión</label>
      <textarea id={`review-${assignee.assignmentId}`} className="rti-field min-h-24 resize-y" maxLength={5000}
        value={comment} onChange={event => setComment(event.target.value)} disabled={pending || leaving} />
      {message && <p role="status" className="rounded-xl bg-muted/60 px-3 py-2">{message}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" className="rti-button-primary" disabled={pending || leaving}
          onClick={() => void review("APPROVE")}>Aprobar actividad</button>
        <button type="button" className="rti-button-secondary" disabled={pending || leaving}
          onClick={() => void review("REQUEST_CHANGES")}>Solicitar cambios</button>
      </div>
    </div>
  </article>;
}

function assignmentSummary(activity: ProgramActivity) {
  const labels: Record<ActivityAssignee["status"], string> = {
    ASSIGNED: "Pendientes", SUBMITTED: "En revisión", CHANGES_REQUESTED: "Con cambios", COMPLETED: "Completadas",
  };
  const workflow = (Object.keys(labels) as ActivityAssignee["status"][]).map(status => ({
    label: labels[status], count: activity.assignees.filter(assignee => assignee.status === status).length,
  })).filter(item => item.count > 0);
  const pendingSurveys = activity.assignees.filter(assignee => assignee.surveyStatus === "PENDING").length;
  return pendingSurveys ? [...workflow, { label: "Encuestas pendientes", count: pendingSurveys }] : workflow;
}
