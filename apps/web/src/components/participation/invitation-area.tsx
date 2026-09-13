"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { acceptInvitation, listInvitations, participationErrorMessage, ParticipationRequestError,
  type Invitation, type PageResult } from "@/lib/participation/participation-api";

const button = "rti-button-secondary";

export function InvitationArea() {
  const [result, setResult] = useState<PageResult<Invitation>>();
  const [page, setPage] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(true);
  const [message, setMessage] = useState("Consultando invitaciones…");
  const [notice, setNotice] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    listInvitations(page, controller.signal).then(data => {
      if (controller.signal.aborted) return;
      setResult(data); setMessage(data.items.length ? "" : "No hay invitaciones disponibles para esta cuenta.");
    }).catch(error => {
      if (!controller.signal.aborted) {
        setMessage(participationErrorMessage(error));
        setNeedsLogin(error instanceof ParticipationRequestError && error.status === 401);
      }
    }).finally(() => { if (!controller.signal.aborted) setPending(false); });
    return () => controller.abort();
  }, [page, attempt]);
  function refresh(nextPage = page, accepted = false) {
    setResult(undefined); setPending(true); setNeedsLogin(false); setMessage("Consultando invitaciones…");
    if (accepted) setNotice("Invitación aceptada. La inscripción está ACTIVE. Puedes volver a Cuenta y comprobar tu sesión.");
    setPage(nextPage); setAttempt(value => value + 1);
  }
  return <section className="rti-surface mx-auto w-full max-w-5xl p-6 sm:p-8 lg:p-10">
    <p className="rti-kicker">Tu participación</p>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Invitaciones</h1>
    <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Sólo se muestran las invitaciones asociadas a tu identidad. Abrir esta página no acepta ninguna invitación.</p>
    {notice && <p role="status" className="mt-5 rounded-2xl border border-accent bg-accent/60 px-4 py-3 text-sm">{notice}</p>}
    {message && <p role="status" className="mt-5 rounded-2xl bg-muted/60 px-4 py-3 text-sm">{message}</p>}
    {needsLogin && <p className="mt-3 text-sm">Inicia sesión con la cuenta invitada. Después del acceso, vuelve desde Cuenta → Invitaciones.</p>}
    {result && <>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">{result.items.map(invitation => <li key={invitation.id} className="space-y-3 break-words rounded-2xl border border-border/70 bg-background/70 p-5">
        <p className="rti-kicker">{invitation.status}</p>
        <h2 className="text-lg font-semibold">{invitation.programName}</h2>
        <p className="text-sm text-muted-foreground">Organización: {invitation.organizationName}</p>
        <p className="text-sm text-muted-foreground">Estado: {invitation.status}</p>
        <p className="text-sm text-muted-foreground">Vence: {invitation.expiresAt}</p>
        <InvitationAcceptance invitation={invitation} onAccepted={() => refresh(page, true)} />
      </li>)}</ul>
      <p className="mt-5 text-sm text-muted-foreground">{result.totalElements} invitaciones · Página {result.page + 1} de {Math.max(1, result.totalPages)}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button className={button} disabled={pending || page === 0} onClick={() => refresh(page - 1)}>Anterior</button>
        <button className={button} disabled={pending || page + 1 >= result.totalPages} onClick={() => refresh(page + 1)}>Siguiente</button>
      </div>
    </>}
    <button className={`${button} mt-4`} disabled={pending} onClick={() => refresh()}>Actualizar invitaciones</button>
    <nav aria-label="Navegación de invitaciones" className="mt-8 flex flex-wrap gap-4 border-t border-border/70 pt-6 text-sm">
      <Link href="/account" className="rti-link">Volver a Cuenta</Link>
      {!result && <Link href="/login" className="rti-link">Iniciar sesión</Link>}
    </nav>
  </section>;
}

function InvitationAcceptance({ invitation, onAccepted }: { invitation: Invitation; onAccepted: () => void }) {
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function accept() {
    if (submitting.current || blocked || invitation.status !== "PENDING") return;
    submitting.current = true; setPending(true); setMessage("");
    const controller = new AbortController(); request.current = controller;
    try {
      const result = await acceptInvitation(invitation.id, controller.signal);
      if (controller.signal.aborted) return;
      if (result.status !== "ACCEPTED" || result.enrollmentStatus !== "ACTIVE") throw new ParticipationRequestError(0);
      setBlocked(true); onAccepted();
    } catch (error) {
      if (!controller.signal.aborted) {
        setBlocked(true);
        const status = error instanceof ParticipationRequestError ? error.status : 0;
        setMessage(status === 0 || status >= 500
          ? "No se pudo confirmar la aceptación. Actualiza las invitaciones antes de repetir la operación."
          : participationErrorMessage(error));
      }
    } finally { submitting.current = false; if (!controller.signal.aborted) setPending(false); }
  }
  return <div className="space-y-2">
    {invitation.status === "EXPIRED" && <p className="text-sm">La invitación venció. Solicita al consultor que revise tu acceso.</p>}
    {invitation.status === "REVOKED" && <p className="text-sm">Esta invitación ya no está disponible.</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
    {invitation.status === "PENDING" && <button className={button} disabled={pending || blocked} onClick={() => void accept()}>{pending ? "Aceptando…" : "Aceptar invitación"}</button>}
  </div>;
}
