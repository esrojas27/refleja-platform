"use client";

import { CalendarDays, History } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ProgramModal } from "./program-modal";
import { listSessionAgenda, scheduleSession, sessionHistory, scheduleError, sessionRequirementMessage, type SessionAgenda, type ScheduledPerson, type SessionHistory } from "@/lib/participation/session-schedule-api";

export function SessionAgendaArea({ organizationId, programId, sessionId }: { organizationId: string; programId: string; sessionId?: string }) {
  return <Agenda key={`${organizationId}/${programId}/${sessionId}`} organizationId={organizationId} programId={programId} sessionId={sessionId} />;
}
function Agenda({ organizationId, programId, sessionId }: { organizationId: string; programId: string; sessionId?: string }) {
  const [agenda, setAgenda] = useState<SessionAgenda>();
  const [message, setMessage] = useState("Consultando agenda…");
  const [attempt, setAttempt] = useState(0);
  const [editor, setEditor] = useState<string>();
  const [history, setHistory] = useState<{ session: string; person: ScheduledPerson }>();
  useEffect(() => {
    const controller = new AbortController();
    listSessionAgenda(organizationId, programId, controller.signal).then(data => {
      if (!controller.signal.aborted) { setAgenda(data); setMessage(data.items.length ? "" : "Aún no hay sesiones en este programa."); }
    }).catch(error => { if (!controller.signal.aborted) { setAgenda(undefined); setMessage(scheduleError(error)); } });
    return () => controller.abort();
  }, [organizationId, programId, attempt]);
  return <section className={sessionId ? "space-y-4" : "rti-surface p-6 sm:p-8 lg:p-10"}>
    <p className="rti-kicker">Fechas por participante</p><h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold"><CalendarDays aria-hidden="true" className="size-7" />Agenda de sesiones</h1>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">Al agendar participantes se asignan automáticamente las actividades de su sesión, incluidas las que se creen después. Cada persona verá el contenido desde que tenga fecha y acepte su invitación. Las actividades vencen tres días calendario después de su sesión. Al reprogramar se conservan los vencimientos de las entregadas, en revisión y completadas.</p>
    {message && <p role="status" className="mt-4 rounded-xl bg-muted p-4 text-sm">{message}</p>}
    {agenda && <div className="mt-6 space-y-4">{agenda.items.filter(item => !sessionId || item.session.id === sessionId).map(item => <section key={item.session.id} className="rounded-2xl border border-border p-5">
      <p className="rti-kicker">{item.session.dimensionName}</p><h2 className="mt-2 text-xl font-semibold">{item.session.name}</h2>
      {item.missingRequirement&&<p className="mt-3 rounded-xl bg-muted p-3 text-sm">{sessionRequirementMessage(item.missingRequirement)} Completa el contenido antes de agendar.</p>}
      {agenda.canEdit && <button disabled={!!item.missingRequirement} className="rti-button-primary mt-4" onClick={() => setEditor(item.session.id)}>Agendar participantes</button>}
      {item.participants.length === 0 && <p className="mt-4 text-sm text-muted-foreground">Agrega participantes al programa para asignar sus fechas.</p>}
      <ul className="mt-4 space-y-3">{item.participants.map(person => <li key={person.enrollmentId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/40 p-3 text-sm">
        <div className="min-w-0"><p className="break-words font-medium">{person.name}</p><p className="break-all text-muted-foreground">{person.email}</p>
          <p className="mt-1">{person.scheduledDate ? `Sesión: ${person.scheduledDate}` : "Sin agendar · Oculta para esta persona"}</p></div>
        {person.scheduledDate && <button className="rti-button-secondary gap-2" onClick={() => setHistory({ session: item.session.id, person })}><History aria-hidden="true" className="size-4" />Historial</button>}
      </li>)}</ul>
    </section>)}</div>}
    <button className="rti-button-secondary mt-5" onClick={() => { setAgenda(undefined); setMessage("Consultando agenda…"); setAttempt(v => v + 1); }}>Actualizar agenda</button>
    <nav className="mt-6 border-t border-border pt-5"><Link href="/account" className="rti-link text-sm">Volver a Cuenta</Link></nav>
    {agenda && editor && <ProgramModal titleId="schedule-session-title" closeLabel="Cerrar agenda" onClose={() => setEditor(undefined)}>
      <ScheduleForm organizationId={organizationId} programId={programId} agenda={agenda} sessionId={editor} onSaved={data => { setAgenda(data); setEditor(undefined); setMessage("Agenda y asignación de actividades actualizadas."); }} />
    </ProgramModal>}
    {history && <ProgramModal titleId="schedule-history-title" closeLabel="Cerrar historial" onClose={() => setHistory(undefined)}>
      <ScheduleHistory organizationId={organizationId} programId={programId} sessionId={history.session} person={history.person} />
    </ProgramModal>}
  </section>;
}
export function ScheduleForm({ organizationId, programId, agenda, sessionId, onSaved }: { organizationId: string; programId: string; agenda: SessionAgenda; sessionId: string; onSaved: (data: SessionAgenda) => void }) {
  const item = agenda.items.find(s => s.session.id === sessionId)!;
  const [selected, setSelected] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const request = useRef<AbortController | null>(null);
  const writing = useRef(false);
  useEffect(() => () => request.current?.abort(), []);
  const people = item.participants.filter(p => selected.includes(p.enrollmentId));
  const rescheduling = people.some(p => p.scheduledDate !== null && p.scheduledDate !== date);
  const min = agenda.startDate && agenda.startDate > agenda.today ? agenda.startDate : agenda.today;
  const afterProgramEnd = Boolean(agenda.endDate && date > agenda.endDate);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (writing.current || blocked) return;
    if (!agenda.canEdit || item.missingRequirement) { setMessage(sessionRequirementMessage(item.missingRequirement ?? "")); return; }
    if (!people.length || !date || date < min || date > "9999-12-28" || rescheduling && !reason.trim()) {
      setMessage(!people.length ? "Selecciona al menos una persona." : rescheduling && !reason.trim() ? "Escribe el motivo de la reprogramación." : "Selecciona una fecha válida, que no sea pasada ni anterior al inicio del programa."); return;
    }
    writing.current = true; setPending(true); setMessage("Guardando fechas…");
    const controller = new AbortController(); request.current = controller;
    try { const data = await scheduleSession(organizationId, programId, sessionId, date, people, reason, controller.signal); if (!controller.signal.aborted) onSaved(data); }
    catch (error) { if (!controller.signal.aborted) { setMessage(scheduleError(error)); setBlocked(true); } }
    finally { writing.current = false; if (!controller.signal.aborted) setPending(false); }
  }
  return <form aria-label="Agendar participantes" onSubmit={submit} noValidate className="space-y-5">
    <h2 id="schedule-session-title" className="text-2xl font-semibold">{item.session.name}</h2>
    <p className="text-sm text-muted-foreground">Selecciona una persona o un subgrupo para asignarles la misma fecha y todas las actividades de esta sesión. Las actividades que se creen después también se asignarán automáticamente. Una fecha asignada solo puede reprogramarse, no quitarse. Guardar la misma fecha completa las asignaciones faltantes sin duplicar las existentes.</p>
    {message && <p role="status" className="rounded-xl bg-muted p-3 text-sm">{message}</p>}
    <fieldset disabled={pending || blocked} className="space-y-3"><legend className="mb-2 font-medium">Participantes</legend>
      {item.participants.filter(p => p.enabled && ["INVITED", "ACTIVE"].includes(p.status)).map(person => <label key={person.enrollmentId} className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
        <input type="checkbox" checked={selected.includes(person.enrollmentId)} onChange={event => setSelected(current => event.target.checked ? [...current, person.enrollmentId] : current.filter(id => id !== person.enrollmentId))} />
        <span className="min-w-0 break-words">{person.name}<span className="block break-all text-muted-foreground">{person.email}</span><span className="block text-xs">{person.scheduledDate ?? "Sin agendar"}</span></span>
      </label>)}
    </fieldset>
    <label className="block text-sm font-medium">Fecha de la sesión<input type="date" required min={min} max="9999-12-28" aria-describedby="session-date-hint" value={date} disabled={pending || blocked} onChange={e => setDate(e.target.value)} className="rti-field" /></label>
    <p id="session-date-hint" aria-live="polite" className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">{afterProgramEnd
      ? `La sesión queda después del fin previsto del programa (${agenda.endDate}). Puedes guardar esta fecha; no cambiará las fechas del programa y sus actividades vencerán tres días después. Las entregas ya enviadas conservan su vencimiento.`
      : "Puedes agendar después del fin previsto del programa. No se permiten fechas pasadas ni anteriores a su inicio."}</p>
    {rescheduling && <label className="block text-sm font-medium">Motivo de la reprogramación<textarea required maxLength={1000} value={reason} disabled={pending || blocked} onChange={e => setReason(e.target.value)} className="rti-field min-h-24" /></label>}
    <button className="rti-button-primary" disabled={pending || blocked || !agenda.canEdit || Boolean(item.missingRequirement)}>{pending ? "Guardando…" : "Guardar fechas y asignar actividades"}</button>
  </form>;
}
function ScheduleHistory({ organizationId, programId, sessionId, person }: { organizationId: string; programId: string; sessionId: string; person: ScheduledPerson }) {
  const [result, setResult] = useState<SessionHistory>(); const [message, setMessage] = useState("Consultando historial…"); const [page, setPage] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    sessionHistory(organizationId, programId, sessionId, person.enrollmentId, page, controller.signal).then(data => { if (!controller.signal.aborted) { setResult(data); setMessage(""); } })
      .catch(error => { if (!controller.signal.aborted) setMessage(scheduleError(error)); }); return () => controller.abort();
  }, [organizationId, programId, sessionId, person.enrollmentId, page]);
  function navigate(next: number) { setResult(undefined); setMessage("Consultando historial…"); setPage(next); }
  return <div><h2 id="schedule-history-title" className="text-2xl font-semibold">Historial de fechas</h2><p className="mt-2 break-words">{person.name}</p>
    {message && <p role="status" className="mt-4 text-sm">{message}</p>}
    <ol className="mt-4 space-y-3">{result?.items.map(revision => <li key={revision.id} className="rounded-xl border border-border p-4 text-sm">
      <p className="font-semibold">{revision.previousDate ? `${revision.previousDate} → ${revision.scheduledDate}` : `Fecha: ${revision.scheduledDate}`}</p>
      <p className="mt-2 whitespace-pre-wrap">{revision.reason}</p><p className="mt-2 text-xs text-muted-foreground">{revision.actorLabel} · {new Date(revision.recordedAt).toLocaleString("es-CO")}</p>
    </li>)}</ol>
    {result && <div className="mt-4 flex gap-3"><button className="rti-button-secondary" disabled={page === 0} onClick={() => navigate(page - 1)}>Anterior</button><button className="rti-button-secondary" disabled={page + 1 >= result.totalPages} onClick={() => navigate(page + 1)}>Siguiente</button></div>}
  </div>;
}
