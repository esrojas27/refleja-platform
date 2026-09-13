"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { fetchCurrentIdentity, IdentityRequestError, type CurrentIdentity } from "@/lib/auth/authenticated-api";
import { createProgram, getProgram, listPrograms, programsPath, programErrorMessage, ProgramRequestError,
  type Program, type ProgramInput, type ProgramPage } from "@/lib/programs/program-api";

const button = "min-h-10 rounded-md border px-4 py-2 text-sm disabled:opacity-50";

export function ProgramArea({ organizationId, mode, programId }: {
  organizationId: string; mode: "list" | "create" | "detail"; programId?: string;
}) {
  const [identity, setIdentity] = useState<CurrentIdentity>();
  const [message, setMessage] = useState("Comprobando acceso a la organización…");
  useEffect(() => {
    const controller = new AbortController();
    fetchCurrentIdentity(organizationId, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      if (!result.roles.some(role => ["CONSULTANT", "COMPANY_ADMIN", "LEADER"].includes(role))) {
        setMessage("No tienes permiso para consultar estos programas."); return;
      }
      setIdentity(result); setMessage("");
    }).catch(error => {
      if (!controller.signal.aborted) setMessage(programErrorMessage(
        error instanceof IdentityRequestError ? new ProgramRequestError(error.status) : error));
    });
    return () => controller.abort();
  }, [organizationId]);
  const canCreate = identity?.roles.includes("CONSULTANT") === true;
  return <section className="w-full max-w-3xl rounded-xl border bg-background p-5 shadow-sm sm:p-8">
    <h1 className="text-2xl font-semibold">{mode === "create" ? "Crear programa" : mode === "detail" ? "Detalle del programa" : "Programas"}</h1>
    {identity && <p className="mt-2 break-words text-sm text-muted-foreground">Organización: {identity.organizations.find(org => org.id === organizationId)?.name}</p>}
    {message && <p className="mt-4 text-sm" role="status">{message}</p>}
    {identity && (mode === "list" ? <ProgramList organizationId={organizationId} canCreate={canCreate} />
      : mode === "create" ? canCreate ? <CreateProgramForm organizationId={organizationId} /> : <p className="mt-4" role="status">No tienes permiso para crear programas.</p>
      : programId ? <ProgramDetail organizationId={organizationId} programId={programId} canEnroll={canCreate} /> : null)}
    <nav aria-label="Navegación de programas" className="mt-6 flex flex-wrap gap-4 text-sm">
      <Link href="/account" className="underline">Volver a Cuenta</Link>
      {mode !== "list" && <Link href={programsPath(organizationId)} className="underline">Ver programas</Link>}
      {!identity && <Link href="/login" className="underline">Iniciar sesión</Link>}
    </nav>
  </section>;
}

function ProgramList({ organizationId, canCreate }: { organizationId: string; canCreate: boolean }) {
  const [result, setResult] = useState<ProgramPage>();
  const [page, setPage] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState("Cargando programas…");
  const [pending, setPending] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    listPrograms(organizationId, page, controller.signal).then(data => {
      if (!controller.signal.aborted) { setResult(data); setMessage(data.items.length ? "" : "No hay programas en esta página."); }
    }).catch(error => { if (!controller.signal.aborted) setMessage(programErrorMessage(error)); })
      .finally(() => { if (!controller.signal.aborted) setPending(false); });
    return () => controller.abort();
  }, [organizationId, page, attempt]);
  function load(nextPage: number) { setResult(undefined); setPending(true); setMessage("Cargando programas…"); setPage(nextPage); setAttempt(value => value + 1); }
  return <div className="mt-5 space-y-4">
    {canCreate && <Link href={`${programsPath(organizationId)}/new`} className={`${button} inline-block`}>Crear programa</Link>}
    {message && <p role="status">{message}</p>}
    {result && <>
      <ul className="space-y-3">{result.items.map(program => <li key={program.id} className="rounded-md border p-4">
        <Link href={`${programsPath(organizationId)}/${program.id}`} className="break-words font-medium underline">{program.name}</Link>
        <p className="mt-1 text-sm">{program.status} · {program.startDate ?? "Sin fecha"} — {program.endDate ?? "Sin fecha"}</p>
      </li>)}</ul>
      <p className="text-sm">{result.totalElements} programas · Página {result.page + 1} de {Math.max(1, result.totalPages)}</p>
      <div className="flex flex-wrap gap-3">
        <button className={button} disabled={pending || page === 0} onClick={() => load(page - 1)}>Anterior</button>
        <button className={button} disabled={pending || page + 1 >= result.totalPages} onClick={() => load(page + 1)}>Siguiente</button>
      </div>
    </>}
    <button className={button} disabled={pending} onClick={() => load(page)}>Actualizar listado</button>
  </div>;
}

function ProgramValues({ program }: { program: Program }) {
  return <dl className="mt-4 space-y-2 break-words">
    <dt className="font-medium">Nombre</dt><dd>{program.name}</dd>
    <dt className="font-medium">Descripción</dt><dd className="whitespace-pre-wrap">{program.description || "Sin descripción"}</dd>
    <dt className="font-medium">Estado</dt><dd>{program.status}</dd>
    <dt className="font-medium">Inicio</dt><dd>{program.startDate ?? "Sin fecha"}</dd>
    <dt className="font-medium">Fin</dt><dd>{program.endDate ?? "Sin fecha"}</dd>
    <dt className="font-medium">Versión</dt><dd>{program.version}</dd>
  </dl>;
}

function ProgramDetail({ organizationId, programId, canEnroll }: { organizationId: string; programId: string; canEnroll: boolean }) {
  const [program, setProgram] = useState<Program>();
  const [message, setMessage] = useState("Cargando programa…");
  useEffect(() => {
    const controller = new AbortController();
    getProgram(organizationId, programId, controller.signal).then(data => {
      if (!controller.signal.aborted) { setProgram(data); setMessage(""); }
    }).catch(error => { if (!controller.signal.aborted) setMessage(programErrorMessage(error)); });
    return () => controller.abort();
  }, [organizationId, programId]);
  return <>{message && <p className="mt-4" role="status">{message}</p>}{program && <>
    <ProgramValues program={program} />
    {canEnroll && <Link href={`${programsPath(organizationId)}/${encodeURIComponent(programId)}/enrollments`} className={`${button} mt-4 inline-block`}>Colaboradores del programa</Link>}
  </>}</>;
}

export function CreateProgramForm({ organizationId }: { organizationId: string }) {
  const [input, setInput] = useState<ProgramInput>({ name: "", description: "", startDate: "", endDate: "" });
  const [fields, setFields] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState("");
  const [created, setCreated] = useState<Program>();
  const submitting = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || blocked || created) return;
    const invalid = [];
    if (!input.name.trim() || input.name.length > 255 || /[\u0000-\u001f\u007f]/.test(input.name)) invalid.push("name");
    if (input.description.length > 10000) invalid.push("description");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate) || input.startDate > input.endDate) invalid.push("startDate");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.endDate)) invalid.push("endDate");
    setFields(invalid);
    if (invalid.length) { setMessage("Revisa los campos. El inicio debe ser anterior o igual al fin."); return; }
    submitting.current = true; setPending(true); setMessage("Creando programa…");
    const controller = new AbortController(); request.current = controller;
    try {
      const result = await createProgram(organizationId, { ...input, name: input.name.trim() }, controller.signal);
      if (!controller.signal.aborted) { setCreated(result); setMessage("Programa creado."); }
    } catch (error) {
      if (controller.signal.aborted) return;
      const failure = error instanceof ProgramRequestError ? error : new ProgramRequestError(0);
      setFields(failure.fields);
      const uncertain = failure.status === 0 || failure.status >= 500;
      setBlocked(uncertain || [401, 403, 404].includes(failure.status));
      setMessage(uncertain ? "No se pudo confirmar el resultado. Revisa el listado antes de repetir la creación." : programErrorMessage(failure));
    } finally { submitting.current = false; if (!controller.signal.aborted) setPending(false); }
  }
  return <div className="mt-4">
    <p className="text-sm text-muted-foreground">El programa se creará en DRAFT. Esta operación no activa el programa.</p>
    {message && <p className="mt-4" role="status">{message}</p>}
    {created ? <><ProgramValues program={created} /><Link className="mt-4 inline-block underline" href={`${programsPath(organizationId)}/${created.id}`}>Consultar programa creado</Link></>
      : <form className="mt-4 space-y-4" aria-label="Crear programa" onSubmit={submit} noValidate>
        {([['name', 'Nombre'], ['description', 'Descripción (opcional)'], ['startDate', 'Fecha de inicio'], ['endDate', 'Fecha de fin']] as const).map(([field, label]) =>
          <div key={field}>
            <label htmlFor={`program-${field}`} className="block text-sm font-medium">{label}</label>
            {field === "description" ? <textarea id={`program-${field}`} rows={4} maxLength={10000} value={input[field]}
              onChange={e => setInput({ ...input, [field]: e.target.value })} disabled={pending || blocked}
              aria-invalid={fields.includes(field)} aria-describedby={fields.includes(field) ? `${field}-error` : undefined}
              className="mt-1 w-full rounded-md border px-3 py-2" />
              : <input id={`program-${field}`} type={field === "name" ? "text" : "date"} required maxLength={field === "name" ? 255 : undefined}
                value={input[field]} onChange={e => setInput({ ...input, [field]: e.target.value })} disabled={pending || blocked}
                aria-invalid={fields.includes(field)} aria-describedby={fields.includes(field) ? `${field}-error` : undefined}
                className="mt-1 min-h-10 w-full min-w-0 rounded-md border px-3 py-2" />}
            {fields.includes(field) && <p id={`${field}-error`} className="text-sm text-destructive">Revisa este campo.</p>}
          </div>)}
        <button className={button} disabled={pending || blocked}>{pending ? "Creando…" : "Crear programa"}</button>
      </form>}
  </div>;
}
