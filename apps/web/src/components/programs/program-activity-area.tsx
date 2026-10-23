"use client";

import Link from "next/link";
import { ActivityVideo } from "@/components/participation/activity-video";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { CheckCircle2, ClipboardCheck } from "lucide-react";
import { fetchCurrentIdentity, IdentityRequestError } from "@/lib/auth/authenticated-api";
import { ActivityRequestError, activityErrorMessage, createProgramActivity, listProgramActivities,
  isYoutubeVideoUrl, reviewActivityAssignment, type ActivityAssignee, type ActivityInput, type ProgramActivity }
  from "@/lib/participation/activity-api";
import { listProgramDimensions, ProgramContentRequestError, programContentErrorMessage, type ProgramDimension } from "@/lib/programs/program-content-api";
import { editActivity } from "@/lib/programs/content-administration-api";
import { ActivityStatusBadges } from "@/components/participation/progress-overview";
import { ProgramModal } from "@/components/programs/program-modal";
import { useProgramState } from "@/components/programs/program-state-context";

export type SessionOption = { id: string; label: string };

export function ProgramActivityArea({ organizationId, programId }: { organizationId: string; programId: string }) {
  return <ActivityContent key={`${organizationId}/${programId}`} organizationId={organizationId} programId={programId} />;
}

function ActivityContent({ organizationId, programId }: { organizationId: string; programId: string }) {
  const state = useProgramState();
  const canEdit = state?.canEdit ?? true;
  const canExecute = state?.canExecute ?? true;
  const [dimensions, setDimensions] = useState<ProgramDimension[]>();
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
        const [structure, activityList] = await Promise.all([
          listProgramDimensions(organizationId, programId, controller.signal),
          listProgramActivities(organizationId, programId, controller.signal, true),
        ]);
        if (controller.signal.aborted) return;
        setDimensions(structure.items);
        setActivities(activityList.items);
        setMessage("");
      } catch (error) {
        if (controller.signal.aborted) return;
        const normalized = error instanceof IdentityRequestError || error instanceof ProgramContentRequestError
          ? new ActivityRequestError(error.status) : error;
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
  const visibleActivities = activities?.filter(activity => !activity.archived && sessionNames.has(activity.sessionId));

  function refresh(saved?: ProgramActivity) {
    setDimensions(undefined); setActivities(undefined);
    setPending(true); setMessage("Actualizando actividades…");
    if (saved) setNotice(saved.assignees.length === 0 ? "Actividad creada. Se asignará al agendar participantes en su sesión."
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
      {canEdit && dimensions && activities && <button type="button" className="rti-button-primary shrink-0"
        onClick={() => setCreateOpen(true)}>Crear actividad</button>}
    </div>
    {notice && <p role="status" className="mt-5 rounded-2xl border border-accent bg-accent/60 px-4 py-3 text-sm">{notice}</p>}
    {message && <p role="status" className="mt-5 rounded-2xl bg-muted/60 px-4 py-3 text-sm">{message}</p>}
    {dimensions && activities && <div className="mt-7 space-y-8">
      {canExecute ? <ReviewQueue organizationId={organizationId} programId={programId} activities={visibleActivities ?? []}
        onReviewed={reviewed} /> : <p className="rounded-2xl border border-border bg-muted/50 p-4 text-sm">
          La revisión de entregas está disponible mientras el programa está activo.
        </p>}
      <section aria-labelledby="activity-list-title" className="border-t border-border/70 pt-7">
        <h2 id="activity-list-title" className="text-xl font-semibold">Actividades creadas</h2>
        {visibleActivities?.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Aún no hay actividades en este programa.</p>
          : <ol className="mt-4 space-y-4">{visibleActivities?.map(activity => <li key={activity.id}
            className="rounded-2xl border border-border/70 bg-background/70 p-5">
            <p className="rti-kicker">{sessionNames.get(activity.sessionId) ?? "Sesión"} · Actividad {activity.position}</p>
            <h3 className="mt-2 text-lg font-semibold">{activity.title}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{activity.instructions}</p>
            {activity.youtubeUrl && <ActivityVideo url={activity.youtubeUrl} title={activity.title} />}
            <p className="mt-3 text-sm font-medium">Vencimiento individual: 3 días calendario después de cada sesión.</p>
            <div className="mt-4 flex flex-wrap gap-2" aria-label={`Estado de asignaciones de ${activity.title}`}>
              {assignmentSummary(activity).map(item => <span key={item.label}
                className="rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
                {item.label}: {item.count}
              </span>)}
            </div>
            {!canExecute && activity.assignees.length > 0 && <details className="mt-4 rounded-xl border border-border p-4">
              <summary className="cursor-pointer text-sm font-semibold">Consultar entregas ({activity.assignees.length})</summary>
              <ul className="mt-4 space-y-4">{activity.assignees.map(person => <li key={person.assignmentId}
                className="border-t border-border pt-4 text-sm first:border-t-0 first:pt-0">
                <p className="break-words font-semibold">{[person.firstName, person.lastName].filter(Boolean).join(" ") || person.email}</p>
                <p className="mt-1 break-all text-muted-foreground">{person.email}</p>
                <p className="mt-2 text-xs">{person.dueDate ? `Fecha límite: ${person.dueDate}` : "Sesión sin agendar"}</p>
                <div className="mt-2"><ActivityStatusBadges status={person.status} dueDate={person.dueDate ?? null}
                  surveyStatus={person.surveyStatus === "NOT_REQUIRED" ? undefined : person.surveyStatus} /></div>
                <p className="mt-3 whitespace-pre-wrap break-words">{person.responseText ?? "Sin entrega."}</p>
                {person.reviewComment && <p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">Comentario del consultor: {person.reviewComment}</p>}
                <p className="mt-2 text-muted-foreground">Avance conservado: {person.completionPercentage}%</p>
              </li>)}</ul>
            </details>}
          </li>)}</ol>}
      </section>
    </div>}
    {createOpen && dimensions && activities && <ProgramModal titleId="create-activity-title"
      closeLabel="Cerrar creación de actividad" onClose={() => setCreateOpen(false)}>
      <ActivityForm organizationId={organizationId} programId={programId} sessions={sessions}
        activities={activities} onSaved={saved => { setCreateOpen(false); refresh(saved); }} />
    </ProgramModal>}
    <button className="rti-button-secondary mt-6" disabled={pending} onClick={() => refresh()}>Actualizar actividades</button>
    <nav aria-label="Navegación de actividades" className="mt-8 flex flex-wrap gap-4 border-t border-border/70 pt-6 text-sm">
      <Link href={`/organizations/${encodeURIComponent(organizationId)}/programs/${encodeURIComponent(programId)}`} className="rti-link">Volver al programa</Link>
      <Link href="/account" className="rti-link">Volver a Cuenta</Link>
    </nav>
  </section>;
}

export function ActivityForm({ organizationId, programId, sessions, activities, onSaved, initial }: {
  organizationId: string; programId: string; sessions: SessionOption[];
  activities: ProgramActivity[]; onSaved: (saved: ProgramActivity) => void; initial?: ProgramActivity;
}) {
  const [input, setInput] = useState({ sessionId: initial?.sessionId ?? sessions[0]?.id ?? "", title: initial?.title ?? "",
    instructions: initial?.instructions ?? "", youtubeUrl: initial?.youtubeUrl ?? "" });
  const instructionsLocked = initial?.assignees.some(person => person.submittedAt != null) ?? false;
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState("");
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  const submitting = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  function clearInvalid(field: string) {
    setInvalidFields(current => current.filter(candidate => candidate !== field));
  }

  function focusFirstInvalid(fields: string[]) {
    const ids: Record<string, string> = {
      sessionId: "activity-session", title: "activity-title", instructions: "activity-instructions",
      youtubeUrl: "activity-youtube-url",
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
      position };
    const invalid = [
      ...(!clean.sessionId ? ["sessionId"] : []),
      ...(!clean.title || clean.title.length > 255 ? ["title"] : []),
      ...(!clean.instructions || clean.instructions.length > 10000 ? ["instructions"] : []),
      ...(clean.youtubeUrl !== null && !isYoutubeVideoUrl(clean.youtubeUrl) ? ["youtubeUrl"] : []),
    ];
    if (invalid.length) {
      setInvalidFields(invalid);
      setMessage("Revisa los campos resaltados antes de guardar la actividad.");
      focusFirstInvalid(invalid);
      return;
    }
    submitting.current = true; setPending(true);
    setMessage(initial ? "Guardando actividad…" : "Creando actividad…");
    const controller = new AbortController(); request.current = controller;
    try {
      let saved: ProgramActivity;
      if (initial) {
        await editActivity(organizationId, programId, initial.id, { ...clean, version: initial.version }, controller.signal);
        saved = { ...initial, title: clean.title, instructions: clean.instructions, youtubeUrl: clean.youtubeUrl };
      } else saved = await createProgramActivity(organizationId, programId, clean, controller.signal);
      if (!controller.signal.aborted) { setBlocked(true);
        setMessage(initial ? "Actividad actualizada." : saved.assignees.length ? "Actividad creada y asignada." : "Actividad creada sin asignaciones.");
        onSaved(saved); }
    } catch (error) {
      if (!controller.signal.aborted) {
        const failure = error instanceof ActivityRequestError ? error : error instanceof ProgramContentRequestError
          ? new ActivityRequestError(error.status, error.fields, error.requestId) : new ActivityRequestError(0);
        setInvalidFields(failure.fields);
        if (failure.fields.length) focusFirstInvalid(failure.fields);
        setBlocked(failure.status === 0 || failure.status >= 500 || [401, 403, 404, 409].includes(failure.status));
        setMessage(error instanceof ProgramContentRequestError ? programContentErrorMessage(error) : activityErrorMessage(failure));
      }
    } finally { submitting.current = false; if (!controller.signal.aborted) setPending(false); }
  }

  const unavailable = sessions.length === 0;
  return <form aria-label={initial ? "Editar actividad" : "Crear actividad"} onSubmit={submit} noValidate className="space-y-5">
    <div><p className="rti-kicker">Nueva actividad</p><h2 id="create-activity-title" className="mt-2 text-xl font-semibold">
      {initial ? "Editar actividad" : "Crear actividad"}</h2></div>
    {message && <p role="status" className="rounded-xl bg-muted/60 px-3 py-2 text-sm">{message}</p>}
    {sessions.length === 0 && <p className="text-sm text-muted-foreground">Crea primero una sesión en Contenido.</p>}
    {!initial && <p className="rounded-xl border border-border/70 bg-muted/60 px-3 py-3 text-sm text-muted-foreground">
      Puedes preparar esta actividad sin participantes. La asignación se gestiona desde la agenda de su sesión.
    </p>}
    <div><label htmlFor="activity-session" className="block text-sm font-medium">Sesión</label>
      <select id="activity-session" className="rti-field" value={input.sessionId}
        aria-invalid={invalidFields.includes("sessionId") || undefined}
        aria-describedby={invalidFields.includes("sessionId") ? "activity-session-error" : undefined}
        onChange={event => { clearInvalid("sessionId"); setInput({ ...input, sessionId: event.target.value }); }}
        disabled={!!initial || pending || blocked || unavailable}>
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
        value={input.instructions} readOnly={instructionsLocked} aria-invalid={invalidFields.includes("instructions") || undefined}
        aria-describedby={invalidFields.includes("instructions") ? "activity-instructions-error" : undefined}
        onChange={event => { clearInvalid("instructions"); setInput({ ...input, instructions: event.target.value }); }}
        disabled={pending || blocked || unavailable} />
      {instructionsLocked && <p className="mt-2 text-sm text-muted-foreground">Las instrucciones y la encuesta están protegidas porque ya existen entregas. Duplica la actividad para cambiarlas.</p>}
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
        : <p className="mt-2 text-xs text-muted-foreground">El video se mostrará dentro de la actividad, con un enlace alternativo a YouTube.</p>}</div>
    <p className="rounded-xl bg-muted/50 p-3 text-sm">Los destinatarios se definen en Agendar participantes de la sesión. Esta actividad se asignará automáticamente a quienes ya tengan fecha y a quienes se agenden después. El vencimiento será tres días calendario después de su sesión.</p>
    <button className="rti-button-primary" disabled={pending || blocked || unavailable}>
      {pending ? "Guardando…" : initial ? "Guardar cambios" : "Crear actividad"}
    </button>
  </form>;
}

type ReviewItem = { activity: ProgramActivity; assignee: ActivityAssignee };

function ReviewQueue({ organizationId, programId, activities, onReviewed }: {
  organizationId: string; programId: string; activities: ProgramActivity[];
  onReviewed: (activityId: string, assignee: ActivityAssignee) => void;
}) {
  const target = useSyncExternalStore(subscribeReviewHash, () => window.location.hash, () => "");
  const selectedAssignment = /^#review-[0-9a-f-]{36}$/i.test(target) ? target.slice(8) : "";
  const queue = useMemo(() => activities.flatMap(activity => activity.assignees
    .filter(assignee => assignee.status === "SUBMITTED"
      && (assignee.surveyStatus === "NOT_REQUIRED" || assignee.surveyStatus === "COMPLETED"))
    .map(assignee => ({ activity, assignee })))
    .sort((a, b) => Number(b.assignee.assignmentId === selectedAssignment) - Number(a.assignee.assignmentId === selectedAssignment)), [activities, selectedAssignment]);
  const waitingForSurvey = useMemo(() => activities.flatMap(activity => activity.assignees)
    .filter(assignee => assignee.status === "SUBMITTED" && assignee.surveyStatus === "PENDING").length, [activities]);
  const selectedWaiting = activities.flatMap(activity => activity.assignees
    .filter(assignee => assignee.assignmentId === selectedAssignment && assignee.status === "SUBMITTED" && assignee.surveyStatus === "PENDING")
    .map(assignee => ({ activity, assignee })))[0];
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const expanded = open || queue.some(item => item.assignee.assignmentId === selectedAssignment);
  const reviewSection = useRef<HTMLElement>(null);
  useEffect(() => { if (selectedAssignment) reviewSection.current?.scrollIntoView?.({ block: "start" }); }, [selectedAssignment]);

  function complete(item: ReviewItem, saved: ActivityAssignee) {
    setLeaving(true);
    window.setTimeout(() => {
      onReviewed(item.activity.id, saved);
      setOpen(queue.length > 1);
      setLeaving(false);
    }, 220);
  }

  return <section ref={reviewSection} aria-labelledby="review-queue-title" className="scroll-mt-28 rounded-3xl border border-primary/15 bg-accent/25 p-5 sm:p-7">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="rti-kicker">Bandeja de revisión</p>
        <h2 id="review-queue-title" className="mt-2 text-xl font-semibold">Revisar actividades</h2>
      </div>
      {queue.length > 0 && !expanded && <button type="button" className="rti-button-primary"
        onClick={() => setOpen(true)}>Revisar actividades ({queue.length})</button>}
    </div>
    {selectedWaiting && <p className="mt-4 rounded-2xl border border-border bg-background/70 p-4 text-sm">
      Recibimos la entrega de {[selectedWaiting.assignee.firstName, selectedWaiting.assignee.lastName].filter(Boolean).join(" ") || selectedWaiting.assignee.email}
      {` para «${selectedWaiting.activity.title}». Podrás revisarla cuando complete la encuesta.`}
    </p>}
    {queue.length === 0 ? <div className="mt-5 flex items-center gap-3 rounded-2xl border border-border/70 bg-background/70 px-4 py-4 text-sm text-muted-foreground">
      <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 text-primary" />
      <p>{waitingForSurvey > 0
        ? `No hay actividades listas para revisar. ${waitingForSurvey} ${waitingForSurvey === 1 ? "entrega espera" : "entregas esperan"} que se complete la encuesta.`
        : "No hay actividades pendientes por revisar."}</p>
    </div> : !expanded ? <p className="mt-4 text-sm text-muted-foreground">
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

function subscribeReviewHash(notify: () => void) {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
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
      <ActivityStatusBadges status={assignee.status} dueDate={assignee.dueDate ?? null} />
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
