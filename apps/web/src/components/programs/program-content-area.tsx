"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { fetchCurrentIdentity, IdentityRequestError } from "@/lib/auth/authenticated-api";
import {
  createProgramDimension, createProgramSession, listProgramDimensions, programContentErrorMessage,
  ProgramContentRequestError, type ProgramDimension, type ProgramDimensionInput, type ProgramSessionInput,
} from "@/lib/programs/program-content-api";

export function ProgramContentArea({ organizationId, programId }: { organizationId: string; programId: string }) {
  return <ProgramContent key={`${organizationId}/${programId}`} organizationId={organizationId} programId={programId} />;
}

function ProgramContent({ organizationId, programId }: { organizationId: string; programId: string }) {
  const [dimensions, setDimensions] = useState<ProgramDimension[]>();
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(true);
  const [message, setMessage] = useState("Comprobando acceso al contenido…");
  const [notice, setNotice] = useState("");

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
        const result = await listProgramDimensions(organizationId, programId, controller.signal);
        if (!controller.signal.aborted) {
          setDimensions(result.items);
          setMessage(result.items.length ? "" : "Este programa todavía no tiene dimensiones.");
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          const normalized = error instanceof IdentityRequestError
            ? new ProgramContentRequestError(error.status) : error;
          setMessage(programContentErrorMessage(normalized));
        }
      } finally {
        if (!controller.signal.aborted) setPending(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [organizationId, programId, attempt]);

  function refresh(saved: string) {
    setDimensions(undefined);
    setPending(true);
    setMessage("Actualizando contenido…");
    setNotice(saved);
    setAttempt(value => value + 1);
  }

  const nextDimensionPosition = dimensions ? Math.max(0, ...dimensions.map(dimension => dimension.position)) + 1 : 1;
  return (
    <section className="rti-surface mx-auto w-full max-w-6xl p-6 sm:p-8 lg:p-10">
      <p className="rti-kicker">Estructura del programa</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Contenido</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
        Organiza el recorrido en dimensiones configurables y sesiones. Las dimensiones iniciales llegarán desde plantillas en un incremento posterior.
      </p>
      {notice && <p className="mt-5 rounded-2xl border border-accent bg-accent/60 px-4 py-3 text-sm" role="status">{notice}</p>}
      {message && <p className="mt-5 rounded-2xl bg-muted/60 px-4 py-3 text-sm" role="status">{message}</p>}
      {dimensions && <div className="mt-7 space-y-8">
        <div className="rounded-2xl border border-border/70 bg-background/70 p-5 sm:p-6">
          <DimensionForm organizationId={organizationId} programId={programId} position={nextDimensionPosition}
            onSaved={() => refresh("Dimensión creada.")} />
        </div>
        <section aria-labelledby="dimensions-title">
          <h2 id="dimensions-title" className="text-xl font-semibold">Dimensiones del programa</h2>
          {dimensions.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Crea la primera dimensión para comenzar la estructura.</p>
            : <ol className="mt-4 space-y-5">{dimensions.map(dimension => <li key={dimension.id}
              className="rounded-2xl border border-border/70 bg-background/70 p-5 sm:p-6">
              <p className="rti-kicker">Dimensión {dimension.position}</p>
              <h3 className="mt-2 text-xl font-semibold">{dimension.name}</h3>
              {dimension.description && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{dimension.description}</p>}
              <div className="mt-5 border-t border-border/70 pt-5">
                <h4 className="font-semibold">Sesiones</h4>
                {dimension.sessions.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Esta dimensión todavía no tiene sesiones.</p>
                  : <ol className="mt-3 grid gap-3 sm:grid-cols-2">{dimension.sessions.map(session => <li key={session.id}
                    className="rounded-xl border border-border/70 bg-card p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Sesión {session.position}</p>
                    <p className="mt-1 font-semibold">{session.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{session.scheduledDate}</p>
                    {session.objective && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground"><span className="font-medium text-foreground">Objetivo: </span>{session.objective}</p>}
                  </li>)}</ol>}
                <div className="mt-5 rounded-xl bg-muted/60 p-4">
                  <SessionForm organizationId={organizationId} programId={programId} dimensionId={dimension.id}
                    position={Math.max(0, ...dimension.sessions.map(session => session.position)) + 1}
                    onSaved={() => refresh(`Sesión creada en ${dimension.name}.`)} />
                </div>
              </div>
            </li>)}</ol>}
        </section>
      </div>}
      {!dimensions && !pending && <p className="mt-6 text-sm text-muted-foreground">Vuelve al resumen del programa para comprobar el contexto.</p>}
      <nav aria-label="Navegación de contenido" className="mt-8 border-t border-border/70 pt-6 text-sm">
        <Link href="/account" className="rti-link">Volver a Cuenta</Link>
      </nav>
    </section>
  );
}

export function DimensionForm({ organizationId, programId, position, onSaved }: {
  organizationId: string; programId: string; position: number; onSaved: () => void;
}) {
  const [input, setInput] = useState({ name: "", description: "" });
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
    submitting.current = true; setPending(true); setMessage("Creando dimensión…");
    const controller = new AbortController(); request.current = controller;
    try {
      await createProgramDimension(organizationId, programId, clean, controller.signal);
      if (!controller.signal.aborted) onSaved();
    } catch (error) {
      if (!controller.signal.aborted) {
        const status = error instanceof ProgramContentRequestError ? error.status : 0;
        setBlocked(status === 0 || status >= 500 || [401, 403, 404, 409].includes(status));
        setMessage(programContentErrorMessage(error));
      }
    } finally { submitting.current = false; if (!controller.signal.aborted) setPending(false); }
  }

  return <form onSubmit={submit} noValidate aria-label="Crear dimensión" className="space-y-4">
    <div><p className="rti-kicker">Siguiente paso</p><h2 className="mt-2 text-xl font-semibold">Crear dimensión</h2></div>
    {message && <p role="status" className="rounded-xl bg-muted/60 px-3 py-2 text-sm">{message}</p>}
    <div><label htmlFor="dimension-name" className="block text-sm font-medium">Nombre</label>
      <input id="dimension-name" className="rti-field" required maxLength={255} value={input.name}
        onChange={event => setInput({ ...input, name: event.target.value })} disabled={pending || blocked} /></div>
    <div><label htmlFor="dimension-description" className="block text-sm font-medium">Descripción opcional</label>
      <textarea id="dimension-description" className="rti-field min-h-24 resize-y" maxLength={10000} value={input.description}
        onChange={event => setInput({ ...input, description: event.target.value })} disabled={pending || blocked} /></div>
    <button className="rti-button-primary" disabled={pending || blocked}>{pending ? "Creando…" : "Crear dimensión"}</button>
  </form>;
}

export function SessionForm({ organizationId, programId, dimensionId, position, onSaved }: {
  organizationId: string; programId: string; dimensionId: string; position: number; onSaved: () => void;
}) {
  const [input, setInput] = useState({ name: "", objective: "", scheduledDate: "" });
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || blocked) return;
    const clean: ProgramSessionInput = { name: input.name.trim(), objective: input.objective.trim(),
      scheduledDate: input.scheduledDate, position };
    if (!clean.name || clean.name.length > 255 || clean.objective.length > 10000 || !/^\d{4}-\d{2}-\d{2}$/.test(clean.scheduledDate)) {
      setMessage("Revisa el nombre, la descripción y la fecha."); return;
    }
    submitting.current = true; setPending(true); setMessage("Creando sesión…");
    const controller = new AbortController(); request.current = controller;
    try {
      await createProgramSession(organizationId, programId, dimensionId, clean, controller.signal);
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
  return <form onSubmit={submit} noValidate aria-label="Crear sesión" className="space-y-4">
    <h5 className="font-semibold">Agregar sesión</h5>
    {message && <p role="status" className="text-sm">{message}</p>}
    <div><label htmlFor={`${prefix}-name`} className="block text-sm font-medium">Nombre</label>
      <input id={`${prefix}-name`} className="rti-field" required maxLength={255} value={input.name}
        onChange={event => setInput({ ...input, name: event.target.value })} disabled={pending || blocked} /></div>
    <div><label htmlFor={`${prefix}-date`} className="block text-sm font-medium">Fecha</label>
      <input id={`${prefix}-date`} type="date" className="rti-field" required value={input.scheduledDate}
        onChange={event => setInput({ ...input, scheduledDate: event.target.value })} disabled={pending || blocked} /></div>
    <div><label htmlFor={`${prefix}-objective`} className="block text-sm font-medium">Objetivo opcional</label>
      <textarea id={`${prefix}-objective`} className="rti-field min-h-20 resize-y" maxLength={10000} value={input.objective}
        onChange={event => setInput({ ...input, objective: event.target.value })} disabled={pending || blocked} /></div>
    <button className="rti-button-secondary" disabled={pending || blocked}>{pending ? "Creando…" : "Agregar sesión"}</button>
  </form>;
}
