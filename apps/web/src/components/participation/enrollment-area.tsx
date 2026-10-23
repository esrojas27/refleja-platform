"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { AlertTriangle } from "lucide-react";
import { fetchCurrentIdentity, IdentityRequestError, type CurrentIdentity } from "@/lib/auth/authenticated-api";
import { createEnrollment, listEnrollments, retryInvitationDelivery, sendProgramInvitations, deliveryMessage, participationErrorMessage,
  inviteeRoleLabel, invitationStatusLabels, ParticipationRequestError, type Enrollment, type EnrollmentInput, type InviteeRole,
  type PageResult, type InvitationBatch, type FailedInvitation } from "@/lib/participation/participation-api";
import { useProgramState } from "@/components/programs/program-state-context";
import { EnrollmentAdministration,roleLabel } from "@/components/participation/enrollment-administration";
import { enrollmentStatusLabels } from "@/lib/participation/enrollment-administration-api";
import { InvitationSendFeedback, batchFeedback, type InvitationFeedback } from "@/components/participation/invitation-send-feedback";

const button = "rti-button-secondary";

export function EnrollmentArea({ organizationId, programId }: { organizationId: string; programId: string }) {
  // Remount state and abort requests when the route context changes.
  return <EnrollmentContent key={`${organizationId}/${programId}`} organizationId={organizationId} programId={programId} />;
}

function EnrollmentContent({ organizationId, programId }: { organizationId: string; programId: string }) {
  const canEdit = useProgramState()?.canEdit ?? true;
  const [identity, setIdentity] = useState<CurrentIdentity>();
  const [result, setResult] = useState<PageResult<Enrollment>>();
  const [page, setPage] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(true);
  const [message, setMessage] = useState("Comprobando acceso al programa…");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<InvitationFeedback | null>(null);
  const [failures, setFailures] = useState<FailedInvitation[]>([]);
  const feedbackSequence = useRef(0);
  const dismissFeedback = useCallback(() => setFeedback(null), []);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const current = await fetchCurrentIdentity(organizationId, controller.signal);
        if (controller.signal.aborted) return;
        if (current.activeOrganizationId !== organizationId || !current.roles.includes("CONSULTANT")) {
          setMessage("Sólo un consultor autorizado puede registrar y consultar colaboradores."); return;
        }
        const data = await listEnrollments(organizationId, programId, page, controller.signal);
        if (controller.signal.aborted) return;
        setIdentity(current); setResult(data);
        setFailures(previous => (previous ?? []).filter(failure => !data.items.some(row => row.id === failure.enrollmentId
          && (row.status !== "INVITED" || row.invitation?.deliveryStatus === "SENT"))));
        setMessage(data.items.length ? "" : "No hay personas en esta página.");
      } catch (error) {
        if (!controller.signal.aborted) setMessage(participationErrorMessage(
          error instanceof IdentityRequestError ? new ParticipationRequestError(error.status) : error));
      } finally { if (!controller.signal.aborted) setPending(false); }
    }
    void load();
    return () => controller.abort();
  }, [organizationId, programId, page, attempt]);
  function refresh(nextPage = page, saved?: Enrollment) {
    setIdentity(undefined); setResult(undefined); setPending(true); setMessage("Comprobando acceso al programa…");
    if (saved) setNotice(saved.invitation?.status === "DRAFT"
      ? "Persona registrada sin enviar correos. Agrega las demás personas y pulsa Enviar Invitaciones cuando la lista esté lista."
      : `Registro guardado: ${enrollmentStatusLabels[saved.status]}.${saved.status === "INVITED" && saved.invitation ? ` ${deliveryMessage(saved.invitation.deliveryStatus)}` : ""}`);
    setPage(nextPage); setAttempt(value => value + 1);
  }
  function batchDone(summary: string, batch?: InvitationBatch) {
    setNotice(summary);
    if (batch) setFailures(batch.failures ?? []);
    setFeedback({ id: ++feedbackSequence.current, ...(batch ? batchFeedback(batch) : {
      tone: "warning" as const, title: "No se pudo confirmar el envío",
      message: "Algunos correos pudieron enviarse. Revisa el listado actualizado antes de reintentar.", hasFailures: false,
    }) });
    refresh();
  }
  function deliveryDone(saved: Enrollment) {
    const confirmed = saved.invitation?.deliveryStatus === "SENT";
    setFeedback({ id: ++feedbackSequence.current, tone: confirmed ? "success" : "warning",
      title: confirmed ? "Invitación enviada" : "El envío sigue sin confirmarse",
      message: confirmed ? "El proveedor confirmó el envío de esta invitación." : "Revisa su estado antes de volver a intentarlo.",
      hasFailures: !confirmed && !!failures?.length,
    });
    refresh(page, saved);
  }
  return <section className="rti-surface mx-auto w-full max-w-6xl p-6 sm:p-8 lg:p-10">
    <p className="rti-kicker">Gestión del programa</p>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Personas del programa</h1>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Primero registra a los colaboradores, líderes o responsables de RRHH sin enviar correos. Cuando termines, pulsa Enviar Invitaciones para enviar las pendientes de todo el programa. El acceso se activa cuando cada persona acepta su invitación.</p>
    {notice && <p className="mt-5 rounded-2xl border border-accent bg-accent/60 px-4 py-3 text-sm" role="status">{notice}</p>}
    {message && <p className="mt-5 rounded-2xl bg-muted/60 px-4 py-3 text-sm" role="status">{message}</p>}
    {!canEdit&&identity&&<p className="mt-5 rounded-2xl border border-border p-4 text-sm text-muted-foreground">El contenido permanece en solo consulta. Puedes restringir accesos mediante retiro, suspensión o revocación, y consultar su historial.</p>}
    {identity && result && canEdit && <BatchInvitationAction organizationId={organizationId} programId={programId}
      disabled={pending || result.totalElements === 0} onBusy={setSending} onDone={batchDone} />}
    {identity && !!failures?.length && <section id="invitation-delivery-failures" aria-labelledby="invitation-failures-title" tabIndex={-1}
      className="mt-5 scroll-mt-24 rounded-2xl border border-amber-300 bg-amber-50/70 p-5 text-amber-950">
      <h2 id="invitation-failures-title" className="flex items-center gap-2 text-base font-semibold"><AlertTriangle aria-hidden="true" className="size-5 shrink-0" />Envíos no confirmados</h2>
      <p className="mt-2 text-sm leading-6">El proveedor no confirmó el envío de estas invitaciones del último lote, incluidas las de otras páginas. Vuelve a pulsar Enviar Invitaciones para reintentar las pendientes; las ya enviadas no se repiten.</p>
      <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm">{failures.map(failure => <li className="break-all" key={failure.enrollmentId}>{failure.email}</li>)}</ul>
    </section>}
    {identity && result && <fieldset disabled={sending} className={`mt-7 grid min-w-0 gap-8 ${canEdit ? "lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]" : ""}`}>
      {canEdit && <div className="rounded-2xl border border-border/70 bg-background/70 p-5 sm:p-6">
        <EnrollmentForm organizationId={organizationId} programId={programId} onSaved={saved => refresh(0, saved)} />
      </div>}
      <section aria-labelledby="enrollment-list-title">
        <h2 id="enrollment-list-title" className="text-xl font-semibold">Personas registradas</h2>
        <ul className="mt-4 space-y-3">{result.items.map(enrollment => <li key={enrollment.id} className="space-y-2 break-words rounded-2xl border border-border/70 bg-background/70 p-5">
          <p className="font-semibold">{[enrollment.participant.firstName, enrollment.participant.lastName].filter(Boolean).join(" ") || enrollment.participant.email}</p>
          <p className="break-all text-sm text-muted-foreground">{enrollment.participant.email}</p>
          {enrollment.invitation && <p className="text-sm text-muted-foreground">Rol invitado: {inviteeRoleLabel(enrollment.invitation.role)}</p>}
          {enrollment.access&&<p className="text-sm text-muted-foreground">Roles actuales: {enrollment.access.roles.map(roleLabel).join(", ")||"Sin rol"}</p>}
          <p className="text-sm text-muted-foreground">Inscripción: <span className="inline-block rounded-full border border-border bg-muted/70 px-2.5 py-1 text-xs font-semibold">{enrollment.status === "INVITED" && enrollment.invitation?.status === "DRAFT" ? "Registrada" : enrollmentStatusLabels[enrollment.status]}</span>{enrollment.invitation ? ` · Invitación: ${invitationStatusLabels[enrollment.invitation.status]}` : ""}</p>
          {enrollment.invitation?.expiresAt && <p className="text-sm text-muted-foreground">Vence: {enrollment.invitation.expiresAt}</p>}
          <DeliveryAction enrollment={enrollment} onSaved={deliveryDone} />
          <EnrollmentAdministration enrollment={enrollment} onSaved={saved=>refresh(page,saved)} />
        </li>)}</ul>
        <p className="mt-4 text-sm text-muted-foreground">{result.totalElements} personas · Página {result.page + 1} de {Math.max(1, result.totalPages)}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button className={button} disabled={pending || page === 0} onClick={() => refresh(page - 1)}>Anterior</button>
          <button className={button} disabled={pending || page + 1 >= result.totalPages} onClick={() => refresh(page + 1)}>Siguiente</button>
        </div>
      </section>
    </fieldset>}
    <button className={`${button} mt-4`} disabled={pending || sending} onClick={() => refresh()}>Actualizar listado</button>
    <nav aria-label="Navegación de colaboradores" className="mt-8 flex flex-wrap gap-4 border-t border-border/70 pt-6 text-sm">
      <Link href={`/organizations/${encodeURIComponent(organizationId)}/programs/${encodeURIComponent(programId)}`} className="rti-link">Volver al programa</Link>
      <Link href="/account" className="rti-link">Volver a Cuenta</Link>
      {!identity && <Link href="/login" className="rti-link">Iniciar sesión</Link>}
    </nav>
    {feedback && <InvitationSendFeedback key={feedback.id} feedback={feedback} onDismiss={dismissFeedback} />}
  </section>;
}

export function EnrollmentForm({ organizationId, programId, onSaved }: {
  organizationId: string; programId: string; onSaved: (result: Enrollment) => void;
}) {
  const [input, setInput] = useState<EnrollmentInput>({ email: "", firstName: "", lastName: "", role: "COLLABORATOR" });
  const [fields, setFields] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || blocked) return;
    const clean = { email: input.email.trim(), firstName: input.firstName.trim(), lastName: input.lastName.trim(), role: input.role };
    const invalid = [];
    if (clean.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) invalid.push("email");
    for (const field of ["firstName", "lastName"] as const) {
      if (!clean[field] || clean[field].length > 100 || /[\u0000-\u001f\u007f]/.test(clean[field])) invalid.push(field);
    }
    if (!["COLLABORATOR", "LEADER", "COMPANY_ADMIN"].includes(clean.role)) invalid.push("role");
    setFields(invalid);
    if (invalid.length) { setMessage("Revisa el correo, el nombre, el apellido y el tipo de invitación."); return; }
    submitting.current = true; setPending(true); setMessage("Registrando persona…");
    const controller = new AbortController(); request.current = controller;
    try {
      const saved = await createEnrollment(organizationId, programId, clean, controller.signal);
      if (!controller.signal.aborted) { setBlocked(true); setMessage("Persona registrada."); onSaved(saved); }
    } catch (error) {
      if (controller.signal.aborted) return;
      const failure = error instanceof ParticipationRequestError ? error : new ParticipationRequestError(0);
      setFields(failure.fields);
      const uncertain = failure.status === 0 || failure.status >= 500;
      setBlocked(uncertain || [401, 403, 404, 409].includes(failure.status));
      setMessage(uncertain ? "No se pudo confirmar el resultado. Actualiza el listado antes de repetir el registro." : participationErrorMessage(failure));
    } finally { submitting.current = false; if (!controller.signal.aborted) setPending(false); }
  }
  return <form onSubmit={submit} noValidate aria-label="Registrar persona" className="space-y-5">
    <div>
      <p className="rti-kicker">Prepara tu lista</p>
      <h2 className="mt-2 text-xl font-semibold">Registrar persona</h2>
      <p className="mt-2 text-sm text-muted-foreground">Este paso no envía correos. Podrás enviar las invitaciones juntas cuando termines.</p>
    </div>
    {message && <p role="status" className="rounded-xl bg-muted/60 px-3 py-2 text-sm">{message}</p>}
    {([["email", "Correo electrónico"], ["firstName", "Nombre"], ["lastName", "Apellido"]] as const).map(([field, label]) => <div key={field}>
      <label htmlFor={`enrollment-${field}`} className="block text-sm font-medium">{label}</label>
      <input id={`enrollment-${field}`} type={field === "email" ? "email" : "text"} required
        maxLength={field === "email" ? 254 : 100} autoComplete="off" value={input[field]}
        onChange={event => setInput({ ...input, [field]: event.target.value })} disabled={pending || blocked}
        aria-invalid={fields.includes(field)} aria-describedby={fields.includes(field) ? `enrollment-${field}-error` : undefined}
        className="rti-field" />
      {fields.includes(field) && <p id={`enrollment-${field}-error`} className="text-sm text-destructive">Revisa este campo.</p>}
    </div>)}
    <div>
      <label htmlFor="enrollment-role" className="block text-sm font-medium">Tipo de invitación</label>
      <select id="enrollment-role" value={input.role} disabled={pending || blocked}
        onChange={event => setInput({ ...input, role: event.target.value as InviteeRole })}
        aria-invalid={fields.includes("role")} aria-describedby={fields.includes("role") ? "enrollment-role-error" : undefined}
        className="rti-field">
        <option value="COLLABORATOR">Colaborador</option>
        <option value="LEADER">Líder</option>
        <option value="COMPANY_ADMIN">RRHH</option>
      </select>
      {fields.includes("role") && <p id="enrollment-role-error" className="text-sm text-destructive">Selecciona un tipo de invitación válido.</p>}
    </div>
    <button className="rti-button-primary w-full sm:w-auto" disabled={pending || blocked}>{pending ? "Registrando…" : "Agregar persona"}</button>
  </form>;
}

function DeliveryAction({ enrollment, onSaved }: { enrollment: Enrollment; onSaved: (result: Enrollment) => void }) {
  const canEdit = useProgramState()?.canEdit ?? true;
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function retry() {
    if (submitting.current || blocked) return;
    submitting.current = true; setPending(true); setMessage("");
    const controller = new AbortController(); request.current = controller;
    try {
      const saved = await retryInvitationDelivery(enrollment.organizationId, enrollment.programId, enrollment.id, controller.signal);
      if (!controller.signal.aborted) { setBlocked(true); onSaved(saved); }
    } catch (error) {
      if (!controller.signal.aborted) {
        setBlocked(true);
        setMessage(`${participationErrorMessage(error)} Actualiza el listado para comprobar el estado antes de repetir el envío.`);
      }
    } finally { submitting.current = false; if (!controller.signal.aborted) setPending(false); }
  }
  const retryable = enrollment.invitation?.status === "PENDING" && ["PENDING", "FAILED"].includes(enrollment.invitation.deliveryStatus);
  return <div className="space-y-2">
    {enrollment.invitation?.status === "PENDING" && enrollment.invitation.deliveryStatus === "FAILED" && <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900"><AlertTriangle aria-hidden="true" className="size-3.5" />Envío no confirmado</p>}
    <p className="text-sm">{enrollment.invitation?.status === "DRAFT" ? "Sin enviar. Se incluirá al pulsar Enviar Invitaciones. La vigencia de 7 días comenzará con el envío." : enrollment.invitation ? deliveryMessage(enrollment.invitation.deliveryStatus) : "No hay invitación asociada."}</p>
    {message && <p role="status" className="text-sm">{message}</p>}
    {canEdit && retryable && <button className={button} disabled={pending || blocked} onClick={() => void retry()}>{pending ? "Solicitando envío…" : "Reintentar envío"}</button>}
  </div>;
}

function BatchInvitationAction({ organizationId, programId, disabled, onBusy, onDone }: {
  organizationId: string; programId: string; disabled: boolean;
  onBusy: (busy: boolean) => void; onDone: (summary: string, result?: InvitationBatch) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function send() {
    if (submitting.current || disabled) return;
    submitting.current = true; setPending(true); onBusy(true);
    const controller = new AbortController(); request.current = controller;
    try {
      const result = await sendProgramInvitations(organizationId, programId, controller.signal);
      if (controller.signal.aborted) return;
      const summary = result.sent + result.failed + result.inProgress === 0
        ? "No hay invitaciones pendientes de envío."
        : `Envío de invitaciones: ${result.sent} con envío confirmado por el proveedor, ${result.failed} con fallo y ${result.inProgress} en curso. La confirmación no garantiza recepción en la bandeja de entrada. Las ya enviadas no se reenvían.`;
      onDone(summary, result);
    } catch (error) {
      if (!controller.signal.aborted) onDone(`${participationErrorMessage(error)} Se actualizará el listado: algunos envíos pudieron completarse. Revisa los estados antes de volver a pulsar Enviar Invitaciones.`);
    } finally {
      submitting.current = false;
      if (!controller.signal.aborted) { setPending(false); onBusy(false); setConfirming(false); }
    }
  }
  return <section aria-label="Envío de invitaciones" className="mt-6 rounded-2xl border border-border bg-muted/40 p-5">
    <h2 className="text-lg font-semibold">Envía la lista cuando esté lista</h2>
    <p className="mt-2 text-sm text-muted-foreground">Se incluyen las invitaciones sin enviar y con fallo de todas las páginas de este programa. No se reenvían las ya enviadas ni las revocadas o vencidas.</p>
    {!confirming ? <button className="rti-button-primary mt-4" disabled={disabled} onClick={() => setConfirming(true)}>Enviar Invitaciones</button>
      : <div className="mt-4" aria-busy={pending}>
        <p className="text-sm font-medium">¿Enviar ahora todas las invitaciones pendientes? Para cuentas nuevas también se enviará el correo de acceso inicial.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button className="rti-button-primary" disabled={disabled || pending} onClick={() => void send()}>{pending ? "Enviando invitaciones…" : "Confirmar envío"}</button>
          <button className={button} disabled={pending} onClick={() => setConfirming(false)}>Cancelar</button>
        </div>
      </div>}
  </section>;
}
