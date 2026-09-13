"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { fetchCurrentIdentity, IdentityRequestError } from "@/lib/auth/authenticated-api";
import {
  createProgramModule, createProgramSession, listProgramModules, programContentErrorMessage,
  ProgramContentRequestError, type ProgramModule, type ProgramModuleInput, type ProgramSessionInput,
} from "@/lib/programs/program-content-api";

export function ProgramContentArea({ organizationId, programId }: { organizationId: string; programId: string }) {
  return <ProgramContent key={`${organizationId}/${programId}`} organizationId={organizationId} programId={programId} />;
}

function ProgramContent({ organizationId, programId }: { organizationId: string; programId: string }) {
  const [modules, setModules] = useState<ProgramModule[]>();
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
        const result = await listProgramModules(organizationId, programId, controller.signal);
        if (!controller.signal.aborted) {
          setModules(result.items);
          setMessage(result.items.length ? "" : "Este programa todavía no tiene módulos.");
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
    setModules(undefined);
    setPending(true);
    setMessage("Actualizando contenido…");
    setNotice(saved);
    setAttempt(value => value + 1);
  }

  const nextModulePosition = modules ? Math.max(0, ...modules.map(module => module.position)) + 1 : 1;
  return (
    <section className="rti-surface mx-auto w-full max-w-6xl p-6 sm:p-8 lg:p-10">
      <p className="rti-kicker">Estructura del programa</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Contenido</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
        Organiza el recorrido en módulos y sesiones. Las actividades se agregarán dentro de las sesiones en el siguiente incremento.
      </p>
      {notice && <p className="mt-5 rounded-2xl border border-accent bg-accent/60 px-4 py-3 text-sm" role="status">{notice}</p>}
      {message && <p className="mt-5 rounded-2xl bg-muted/60 px-4 py-3 text-sm" role="status">{message}</p>}
      {modules && <div className="mt-7 space-y-8">
        <div className="rounded-2xl border border-border/70 bg-background/70 p-5 sm:p-6">
          <ModuleForm organizationId={organizationId} programId={programId} position={nextModulePosition}
            onSaved={() => refresh("Módulo creado.")} />
        </div>
        <section aria-labelledby="modules-title">
          <h2 id="modules-title" className="text-xl font-semibold">Módulos del programa</h2>
          {modules.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Crea el primer módulo para comenzar la estructura.</p>
            : <ol className="mt-4 space-y-5">{modules.map(module => <li key={module.id}
              className="rounded-2xl border border-border/70 bg-background/70 p-5 sm:p-6">
              <p className="rti-kicker">Módulo {module.position}</p>
              <h3 className="mt-2 text-xl font-semibold">{module.name}</h3>
              {module.description && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{module.description}</p>}
              <div className="mt-5 border-t border-border/70 pt-5">
                <h4 className="font-semibold">Sesiones</h4>
                {module.sessions.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Este módulo todavía no tiene sesiones.</p>
                  : <ol className="mt-3 grid gap-3 sm:grid-cols-2">{module.sessions.map(session => <li key={session.id}
                    className="rounded-xl border border-border/70 bg-card p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Sesión {session.position}</p>
                    <p className="mt-1 font-semibold">{session.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{session.scheduledDate}</p>
                    {session.description && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{session.description}</p>}
                  </li>)}</ol>}
                <div className="mt-5 rounded-xl bg-muted/60 p-4">
                  <SessionForm organizationId={organizationId} programId={programId} moduleId={module.id}
                    position={Math.max(0, ...module.sessions.map(session => session.position)) + 1}
                    onSaved={() => refresh(`Sesión creada en ${module.name}.`)} />
                </div>
              </div>
            </li>)}</ol>}
        </section>
      </div>}
      {!modules && !pending && <p className="mt-6 text-sm text-muted-foreground">Vuelve al resumen del programa para comprobar el contexto.</p>}
      <nav aria-label="Navegación de contenido" className="mt-8 border-t border-border/70 pt-6 text-sm">
        <Link href="/account" className="rti-link">Volver a Cuenta</Link>
      </nav>
    </section>
  );
}

export function ModuleForm({ organizationId, programId, position, onSaved }: {
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
    const clean: ProgramModuleInput = { name: input.name.trim(), description: input.description.trim(), position };
    if (!clean.name || clean.name.length > 255 || clean.description.length > 10000) {
      setMessage("Revisa el nombre y la descripción."); return;
    }
    submitting.current = true; setPending(true); setMessage("Creando módulo…");
    const controller = new AbortController(); request.current = controller;
    try {
      await createProgramModule(organizationId, programId, clean, controller.signal);
      if (!controller.signal.aborted) onSaved();
    } catch (error) {
      if (!controller.signal.aborted) {
        const status = error instanceof ProgramContentRequestError ? error.status : 0;
        setBlocked(status === 0 || status >= 500 || [401, 403, 404, 409].includes(status));
        setMessage(programContentErrorMessage(error));
      }
    } finally { submitting.current = false; if (!controller.signal.aborted) setPending(false); }
  }

  return <form onSubmit={submit} noValidate aria-label="Crear módulo" className="space-y-4">
    <div><p className="rti-kicker">Siguiente paso</p><h2 className="mt-2 text-xl font-semibold">Crear módulo</h2></div>
    {message && <p role="status" className="rounded-xl bg-muted/60 px-3 py-2 text-sm">{message}</p>}
    <div><label htmlFor="module-name" className="block text-sm font-medium">Nombre</label>
      <input id="module-name" className="rti-field" required maxLength={255} value={input.name}
        onChange={event => setInput({ ...input, name: event.target.value })} disabled={pending || blocked} /></div>
    <div><label htmlFor="module-description" className="block text-sm font-medium">Descripción opcional</label>
      <textarea id="module-description" className="rti-field min-h-24 resize-y" maxLength={10000} value={input.description}
        onChange={event => setInput({ ...input, description: event.target.value })} disabled={pending || blocked} /></div>
    <button className="rti-button-primary" disabled={pending || blocked}>{pending ? "Creando…" : "Crear módulo"}</button>
  </form>;
}

export function SessionForm({ organizationId, programId, moduleId, position, onSaved }: {
  organizationId: string; programId: string; moduleId: string; position: number; onSaved: () => void;
}) {
  const [input, setInput] = useState({ name: "", description: "", scheduledDate: "" });
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || blocked) return;
    const clean: ProgramSessionInput = { name: input.name.trim(), description: input.description.trim(),
      scheduledDate: input.scheduledDate, position };
    if (!clean.name || clean.name.length > 255 || clean.description.length > 10000 || !/^\d{4}-\d{2}-\d{2}$/.test(clean.scheduledDate)) {
      setMessage("Revisa el nombre, la descripción y la fecha."); return;
    }
    submitting.current = true; setPending(true); setMessage("Creando sesión…");
    const controller = new AbortController(); request.current = controller;
    try {
      await createProgramSession(organizationId, programId, moduleId, clean, controller.signal);
      if (!controller.signal.aborted) onSaved();
    } catch (error) {
      if (!controller.signal.aborted) {
        const status = error instanceof ProgramContentRequestError ? error.status : 0;
        setBlocked(status === 0 || status >= 500 || [401, 403, 404, 409].includes(status));
        setMessage(programContentErrorMessage(error));
      }
    } finally { submitting.current = false; if (!controller.signal.aborted) setPending(false); }
  }

  const prefix = `session-${moduleId}`;
  return <form onSubmit={submit} noValidate aria-label="Crear sesión" className="space-y-4">
    <h5 className="font-semibold">Agregar sesión</h5>
    {message && <p role="status" className="text-sm">{message}</p>}
    <div><label htmlFor={`${prefix}-name`} className="block text-sm font-medium">Nombre</label>
      <input id={`${prefix}-name`} className="rti-field" required maxLength={255} value={input.name}
        onChange={event => setInput({ ...input, name: event.target.value })} disabled={pending || blocked} /></div>
    <div><label htmlFor={`${prefix}-date`} className="block text-sm font-medium">Fecha</label>
      <input id={`${prefix}-date`} type="date" className="rti-field" required value={input.scheduledDate}
        onChange={event => setInput({ ...input, scheduledDate: event.target.value })} disabled={pending || blocked} /></div>
    <div><label htmlFor={`${prefix}-description`} className="block text-sm font-medium">Descripción opcional</label>
      <textarea id={`${prefix}-description`} className="rti-field min-h-20 resize-y" maxLength={10000} value={input.description}
        onChange={event => setInput({ ...input, description: event.target.value })} disabled={pending || blocked} /></div>
    <button className="rti-button-secondary" disabled={pending || blocked}>{pending ? "Creando…" : "Agregar sesión"}</button>
  </form>;
}
