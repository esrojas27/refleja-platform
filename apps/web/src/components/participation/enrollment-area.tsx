"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { fetchCurrentIdentity, IdentityRequestError, type CurrentIdentity } from "@/lib/auth/authenticated-api";
import { createEnrollment, listEnrollments, retryInvitationDelivery, deliveryMessage, participationErrorMessage,
  inviteeRoleLabel, ParticipationRequestError, type Enrollment, type EnrollmentInput, type InviteeRole,
  type PageResult } from "@/lib/participation/participation-api";

const button = "rti-button-secondary";

export function EnrollmentArea({ organizationId, programId }: { organizationId: string; programId: string }) {
  // Remount state and abort requests when the route context changes.
  return <EnrollmentContent key={`${organizationId}/${programId}`} organizationId={organizationId} programId={programId} />;
}

function EnrollmentContent({ organizationId, programId }: { organizationId: string; programId: string }) {
  const [identity, setIdentity] = useState<CurrentIdentity>();
  const [result, setResult] = useState<PageResult<Enrollment>>();
  const [page, setPage] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(true);
  const [message, setMessage] = useState("Comprobando acceso al programa…");
  const [notice, setNotice] = useState("");
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
    if (saved) setNotice(`Registro guardado: ${saved.status}. ${saved.invitation ? deliveryMessage(saved.invitation.deliveryStatus) : "No hay invitación asociada."}`);
    setPage(nextPage); setAttempt(value => value + 1);
  }
  return <section className="rti-surface mx-auto w-full max-w-6xl p-6 sm:p-8 lg:p-10">
    <p className="rti-kicker">Gestión del programa</p>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Personas del programa</h1>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Invita a un colaborador, líder o responsable de RRHH. El acceso se activa cuando acepta con su cuenta de Cognito.</p>
    {notice && <p className="mt-5 rounded-2xl border border-accent bg-accent/60 px-4 py-3 text-sm" role="status">{notice}</p>}
    {message && <p className="mt-5 rounded-2xl bg-muted/60 px-4 py-3 text-sm" role="status">{message}</p>}
    {identity && result && <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <div className="rounded-2xl border border-border/70 bg-background/70 p-5 sm:p-6">
        <EnrollmentForm organizationId={organizationId} programId={programId} onSaved={saved => refresh(0, saved)} />
      </div>
      <section aria-labelledby="enrollment-list-title">
        <h2 id="enrollment-list-title" className="text-xl font-semibold">Personas registradas</h2>
        <ul className="mt-4 space-y-3">{result.items.map(enrollment => <li key={enrollment.id} className="space-y-2 break-words rounded-2xl border border-border/70 bg-background/70 p-5">
          <p className="font-semibold">{[enrollment.participant.firstName, enrollment.participant.lastName].filter(Boolean).join(" ") || enrollment.participant.email}</p>
          <p className="break-all text-sm text-muted-foreground">{enrollment.participant.email}</p>
          {enrollment.invitation && <p className="text-sm text-muted-foreground">Rol invitado: {inviteeRoleLabel(enrollment.invitation.role)}</p>}
          <p className="text-sm text-muted-foreground">Inscripción: {enrollment.status}{enrollment.invitation ? ` · Invitación: ${enrollment.invitation.status}` : ""}</p>
          {enrollment.invitation && <p className="text-sm text-muted-foreground">Vence: {enrollment.invitation.expiresAt}</p>}
          <DeliveryAction enrollment={enrollment} onSaved={saved => refresh(page, saved)} />
        </li>)}</ul>
        <p className="mt-4 text-sm text-muted-foreground">{result.totalElements} personas · Página {result.page + 1} de {Math.max(1, result.totalPages)}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button className={button} disabled={pending || page === 0} onClick={() => refresh(page - 1)}>Anterior</button>
          <button className={button} disabled={pending || page + 1 >= result.totalPages} onClick={() => refresh(page + 1)}>Siguiente</button>
        </div>
      </section>
    </div>}
    <button className={`${button} mt-4`} disabled={pending} onClick={() => refresh()}>Actualizar listado</button>
    <nav aria-label="Navegación de colaboradores" className="mt-8 flex flex-wrap gap-4 border-t border-border/70 pt-6 text-sm">
      <Link href={`/organizations/${encodeURIComponent(organizationId)}/programs/${encodeURIComponent(programId)}`} className="rti-link">Volver al programa</Link>
      <Link href="/account" className="rti-link">Volver a Cuenta</Link>
      {!identity && <Link href="/login" className="rti-link">Iniciar sesión</Link>}
    </nav>
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
  return <form onSubmit={submit} noValidate aria-label="Invitar persona" className="space-y-5">
    <div>
      <p className="rti-kicker">Nueva invitación</p>
      <h2 className="mt-2 text-xl font-semibold">Invitar persona</h2>
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
    <button className="rti-button-primary w-full sm:w-auto" disabled={pending || blocked}>{pending ? "Registrando…" : "Registrar e invitar"}</button>
  </form>;
}

function DeliveryAction({ enrollment, onSaved }: { enrollment: Enrollment; onSaved: (result: Enrollment) => void }) {
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
    <p className="text-sm">{enrollment.invitation ? deliveryMessage(enrollment.invitation.deliveryStatus) : "No hay invitación asociada."}</p>
    {message && <p role="status" className="text-sm">{message}</p>}
    {retryable && <button className={button} disabled={pending || blocked} onClick={() => void retry()}>{pending ? "Solicitando envío…" : "Reintentar envío"}</button>}
  </div>;
}
