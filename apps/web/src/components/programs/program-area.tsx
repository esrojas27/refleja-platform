"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Files, Save } from "lucide-react";
import { fetchCurrentIdentity, IdentityRequestError, type CurrentIdentity } from "@/lib/auth/authenticated-api";
import { createProgram, getProgram, listPrograms, programsPath, programErrorMessage, ProgramRequestError,
  type Program, type ProgramInput, type ProgramPage } from "@/lib/programs/program-api";
import { ProgramModal } from "@/components/programs/program-modal";
import { createProgramFromTemplate, createProgramTemplate, getProgramTemplateReadiness, listProgramTemplates,
  programTemplateErrorMessage, type ProgramTemplate,
  type ProgramTemplateReadiness } from "@/lib/programs/program-template-api";

const button = "rti-button-secondary";

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
  return <section className="rti-surface mx-auto w-full max-w-5xl p-6 sm:p-8 lg:p-10">
    <p className="rti-kicker">Espacio del consultor</p>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{mode === "create" ? "Crear programa" : mode === "detail" ? "Detalle del programa" : "Programas"}</h1>
    {identity && <p className="mt-3 break-words text-sm text-muted-foreground">Organización: <span className="font-semibold text-foreground">{identity.organizations.find(org => org.id === organizationId)?.name}</span></p>}
    {message && <p className="mt-5 rounded-2xl border border-border/70 bg-muted/60 px-4 py-3 text-sm" role="status">{message}</p>}
    {identity && (mode === "list" ? <ProgramList organizationId={organizationId} canCreate={canCreate} />
      : mode === "create" ? canCreate ? <CreateProgramForm organizationId={organizationId} /> : <p className="mt-4" role="status">No tienes permiso para crear programas.</p>
      : programId ? <ProgramDetail organizationId={organizationId} programId={programId} canEnroll={canCreate} /> : null)}
    <nav aria-label="Navegación de programas" className="mt-8 flex flex-wrap gap-4 border-t border-border/70 pt-6 text-sm">
      <Link href="/account" className="rti-link">Volver a Cuenta</Link>
      {mode !== "list" && <Link href={programsPath(organizationId)} className="rti-link">Ver programas</Link>}
      {!identity && <Link href="/login" className="rti-link">Iniciar sesión</Link>}
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
  return <div className="mt-7 space-y-5">
    {canCreate && <Link href={`${programsPath(organizationId)}/new`} className="rti-button-primary">Crear programa</Link>}
    {message && <p role="status" className="rounded-2xl bg-muted/60 px-4 py-3 text-sm">{message}</p>}
    {result && <>
      <ul className="grid gap-4 sm:grid-cols-2">{result.items.map(program => <li key={program.id} className="rounded-2xl border border-border/70 bg-background/70 p-5 transition-colors hover:border-primary/30">
        <p className="rti-kicker">{program.status}</p>
        <Link href={`${programsPath(organizationId)}/${program.id}`} className="rti-link mt-3 inline-block break-words text-lg">{program.name}</Link>
        <p className="mt-3 text-sm text-muted-foreground">{program.startDate ?? "Sin fecha"} — {program.endDate ?? "Sin fecha"}</p>
      </li>)}</ul>
      <p className="text-sm text-muted-foreground">{result.totalElements} programas · Página {result.page + 1} de {Math.max(1, result.totalPages)}</p>
      <div className="flex flex-wrap gap-3">
        <button className={button} disabled={pending || page === 0} onClick={() => load(page - 1)}>Anterior</button>
        <button className={button} disabled={pending || page + 1 >= result.totalPages} onClick={() => load(page + 1)}>Siguiente</button>
      </div>
    </>}
    <button className={button} disabled={pending} onClick={() => load(page)}>Actualizar listado</button>
  </div>;
}

function ProgramValues({ program }: { program: Program }) {
  return <dl className="mt-6 grid gap-x-8 gap-y-2 break-words rounded-2xl border border-border/70 bg-background/70 p-5 sm:grid-cols-[auto_1fr]">
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
  return <>{message && <p className="mt-5 rounded-2xl bg-muted/60 px-4 py-3 text-sm" role="status">{message}</p>}{program && <>
    <ProgramValues program={program} />
    {canEnroll && <>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href={`${programsPath(organizationId)}/${encodeURIComponent(programId)}/enrollments`} className="rti-button-primary">Colaboradores del programa</Link>
      </div>
      <ProgramTemplatePanel organizationId={organizationId} program={program} />
    </>}
  </>}</>;
}

export function CreateProgramForm({ organizationId }: { organizationId: string }) {
  const [creationMode, setCreationMode] = useState<"scratch" | "template">("scratch");
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
  return <div className="mt-6">
    <div className="grid gap-3 sm:grid-cols-2" aria-label="Forma de crear el programa">
      <button type="button" onClick={() => setCreationMode("scratch")} aria-pressed={creationMode === "scratch"}
        className={`rounded-2xl border p-4 text-left transition-colors ${creationMode === "scratch" ? "border-primary bg-primary/5" : "border-border bg-background/70 hover:border-primary/40"}`}>
        <span className="font-semibold">Crear desde cero</span>
        <span className="mt-1 block text-sm text-muted-foreground">Define el programa y construye su contenido después.</span>
      </button>
      <button type="button" onClick={() => setCreationMode("template")} aria-pressed={creationMode === "template"}
        className={`rounded-2xl border p-4 text-left transition-colors ${creationMode === "template" ? "border-primary bg-primary/5" : "border-border bg-background/70 hover:border-primary/40"}`}>
        <span className="flex items-center gap-2 font-semibold"><Files aria-hidden="true" className="size-5" />Crear a partir de plantilla</span>
        <span className="mt-1 block text-sm text-muted-foreground">Copia dimensiones, sesiones, actividades y encuestas.</span>
      </button>
    </div>
    {creationMode === "template" ? <CreateFromTemplateForm organizationId={organizationId} /> : <>
      <p className="mt-6 text-sm text-muted-foreground">El programa se creará en DRAFT. Esta operación no activa el programa.</p>
      {message && <p className="mt-4 rounded-2xl bg-muted/60 px-4 py-3 text-sm" role="status">{message}</p>}
      {created ? <><ProgramValues program={created} /><Link className="rti-link mt-5 inline-block" href={`${programsPath(organizationId)}/${created.id}`}>Consultar programa creado</Link></>
      : <form className="mt-6 space-y-5" aria-label="Crear programa" onSubmit={submit} noValidate>
        {([['name', 'Nombre'], ['description', 'Descripción (opcional)'], ['startDate', 'Fecha de inicio'], ['endDate', 'Fecha de fin']] as const).map(([field, label]) =>
          <div key={field}>
            <label htmlFor={`program-${field}`} className="block text-sm font-medium">{label}</label>
            {field === "description" ? <textarea id={`program-${field}`} rows={4} maxLength={10000} value={input[field]}
              onChange={e => setInput({ ...input, [field]: e.target.value })} disabled={pending || blocked}
              aria-invalid={fields.includes(field)} aria-describedby={fields.includes(field) ? `${field}-error` : undefined}
              className="rti-field" />
              : <input id={`program-${field}`} type={field === "name" ? "text" : "date"} required maxLength={field === "name" ? 255 : undefined}
                value={input[field]} onChange={e => setInput({ ...input, [field]: e.target.value })} disabled={pending || blocked}
                aria-invalid={fields.includes(field)} aria-describedby={fields.includes(field) ? `${field}-error` : undefined}
                className="rti-field" />}
            {fields.includes(field) && <p id={`${field}-error`} className="text-sm text-destructive">Revisa este campo.</p>}
          </div>)}
        <button className="rti-button-primary" disabled={pending || blocked}>{pending ? "Creando…" : "Crear programa"}</button>
      </form>}
    </>}
  </div>;
}

function CreateFromTemplateForm({ organizationId }: { organizationId: string }) {
  const [templates, setTemplates] = useState<ProgramTemplate[]>([]);
  const [selected, setSelected] = useState<ProgramTemplate>();
  const [input, setInput] = useState<ProgramInput>({ name: "", description: "", startDate: "", endDate: "" });
  const [message, setMessage] = useState("Cargando plantillas…");
  const [pending, setPending] = useState(true);
  const [created, setCreated] = useState<Program>();
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController(); request.current = controller;
    listProgramTemplates(organizationId, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setTemplates(result.items);
      setMessage(result.items.length ? "" : "Todavía no hay plantillas disponibles en el catálogo.");
    }).catch(error => { if (!controller.signal.aborted) setMessage(programTemplateErrorMessage(error)); })
      .finally(() => { if (!controller.signal.aborted) setPending(false); });
    return () => controller.abort();
  }, [organizationId]);

  function choose(template: ProgramTemplate) {
    setSelected(template);
    setInput(value => ({ ...value, name: template.name, description: template.description ?? "",
      endDate: value.startDate ? addDays(value.startDate, template.durationDays) : "" }));
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || pending || created) return;
    if (!input.name.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)
      || !/^\d{4}-\d{2}-\d{2}$/.test(input.endDate) || input.startDate > input.endDate) {
      setMessage("Selecciona una plantilla y revisa el nombre y las fechas del nuevo programa.");
      return;
    }
    setPending(true); setMessage("Creando programa y copiando su contenido…");
    const controller = new AbortController(); request.current = controller;
    try {
      const result = await createProgramFromTemplate(organizationId, selected.id,
        { ...input, name: input.name.trim() }, controller.signal);
      if (!controller.signal.aborted) { setCreated(result); setMessage("Programa creado desde la plantilla."); }
    } catch (error) {
      if (!controller.signal.aborted) setMessage(programTemplateErrorMessage(error));
    } finally { if (!controller.signal.aborted) setPending(false); }
  }

  return <div className="mt-6">
    {message && <p role="status" className="rounded-2xl bg-muted/60 px-4 py-3 text-sm">{message}</p>}
    {!created && templates.length > 0 && <form aria-label="Crear programa desde plantilla" onSubmit={submit} className="mt-5 space-y-5" noValidate>
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Selecciona una plantilla</legend>
        <div className="grid gap-3 sm:grid-cols-2">{templates.map(template => <label key={template.id}
          className={`cursor-pointer rounded-2xl border p-4 ${selected?.id === template.id ? "border-primary bg-primary/5" : "border-border bg-background/70"}`}>
          <input type="radio" name="program-template" className="sr-only" checked={selected?.id === template.id}
            onChange={() => choose(template)} />
          <span className="font-semibold">{template.name}</span>
          <span className="mt-1 block text-sm text-muted-foreground">Origen: {template.sourceProgramName}</span>
          <span className="mt-3 block text-xs text-muted-foreground">{template.dimensionCount} dimensiones · {template.sessionCount} sesiones · {template.activityCount} actividades · {template.surveyCount} encuestas</span>
        </label>)}</div>
      </fieldset>
      {selected && <>
        <div><label htmlFor="template-program-name" className="block text-sm font-medium">Nombre del nuevo programa</label>
          <input id="template-program-name" className="rti-field" maxLength={255} required value={input.name}
            onChange={event => setInput({ ...input, name: event.target.value })} /></div>
        <div><label htmlFor="template-program-description" className="block text-sm font-medium">Descripción (opcional)</label>
          <textarea id="template-program-description" className="rti-field" rows={4} maxLength={10000} value={input.description}
            onChange={event => setInput({ ...input, description: event.target.value })} /></div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div><label htmlFor="template-program-start" className="block text-sm font-medium">Fecha de inicio</label>
            <input id="template-program-start" className="rti-field" type="date" required value={input.startDate}
              onChange={event => setInput({ ...input, startDate: event.target.value,
                endDate: event.target.value ? addDays(event.target.value, selected.durationDays) : "" })} /></div>
          <div><label htmlFor="template-program-end" className="block text-sm font-medium">Fecha de fin</label>
            <input id="template-program-end" className="rti-field" type="date" required value={input.endDate}
              onChange={event => setInput({ ...input, endDate: event.target.value })} /></div>
        </div>
        <p className="text-sm text-muted-foreground">Las fechas de sesiones y actividades conservarán su distancia respecto al inicio del programa original.</p>
        <button className="rti-button-primary" disabled={pending}>{pending ? "Creando…" : "Crear programa desde plantilla"}</button>
      </>}
    </form>}
    {created && <><ProgramValues program={created} /><Link className="rti-link mt-5 inline-block"
      href={`${programsPath(organizationId)}/${created.id}`}>Consultar programa creado</Link></>}
  </div>;
}

function ProgramTemplatePanel({ organizationId, program }: { organizationId: string; program: Program }) {
  const [readiness, setReadiness] = useState<ProgramTemplateReadiness>();
  const [message, setMessage] = useState("Comprobando si el programa puede convertirse en plantilla…");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    getProgramTemplateReadiness(organizationId, program.id, controller.signal).then(result => {
      if (!controller.signal.aborted) { setReadiness(result); setMessage(""); }
    }).catch(error => { if (!controller.signal.aborted) setMessage(programTemplateErrorMessage(error)); });
    return () => controller.abort();
  }, [organizationId, program.id]);
  return <section className="mt-7 rounded-2xl border border-border/70 bg-background/60 p-5" aria-labelledby="template-heading">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="rti-kicker">Reutilizar contenido</p><h2 id="template-heading" className="mt-2 text-xl font-semibold">Plantilla del programa</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Guarda una copia reutilizable en el catálogo global de Refleja Tu Interior. Incluye dimensiones, sesiones, actividades y encuestas; no copia personas, asignaciones, respuestas ni progreso.</p></div>
      <button type="button" className="rti-button-secondary inline-flex items-center gap-2" disabled={!readiness?.eligible}
        onClick={() => setOpen(true)}><Save aria-hidden="true" className="size-4" />Crear plantilla global</button>
    </div>
    {message && <p role="status" className="mt-4 rounded-2xl bg-muted/60 px-4 py-3 text-sm">{message}</p>}
    {readiness && <div className="mt-4 text-sm">
      <p>{readiness.dimensionCount} dimensiones · {readiness.sessionCount} sesiones · {readiness.activityCount} actividades · {readiness.surveyCount} encuestas</p>
      {!readiness.eligible && <p role="status" className="mt-3 rounded-2xl bg-muted/60 px-4 py-3 font-medium">
        {primaryReadinessIssue(readiness.issues)}
      </p>}
    </div>}
    {open && readiness?.eligible && <CreateTemplateModal organizationId={organizationId} program={program}
      readiness={readiness} onClose={() => setOpen(false)} />}
  </section>;
}

function CreateTemplateModal({ organizationId, program, readiness, onClose }: {
  organizationId: string; program: Program; readiness: ProgramTemplateReadiness; onClose: () => void;
}) {
  const [name, setName] = useState(program.name);
  const [description, setDescription] = useState(program.description ?? "");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<ProgramTemplate>();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || pending || created) { if (!name.trim()) setMessage("Escribe un nombre para la plantilla."); return; }
    setPending(true); setMessage("Creando plantilla…");
    try {
      const result = await createProgramTemplate(organizationId,
        { sourceProgramId: program.id, name: name.trim(), description });
      setCreated(result); setMessage("Plantilla creada y disponible para todas las organizaciones.");
    } catch (error) {
      setMessage(programTemplateErrorMessage(error));
    } finally { setPending(false); }
  }
  return <ProgramModal titleId="create-template-title" closeLabel="Cerrar creación de plantilla" onClose={onClose}>
    <p className="rti-kicker">Nueva plantilla</p><h2 id="create-template-title" className="mt-2 text-2xl font-semibold">Crear desde este programa</h2>
    <p className="mt-3 text-sm text-muted-foreground">Se guardarán {readiness.dimensionCount} dimensiones, {readiness.sessionCount} sesiones, {readiness.activityCount} actividades y {readiness.surveyCount} encuestas. La plantilla será visible para consultores autorizados desde cualquier organización.</p>
    {message && <p role="status" className="mt-4 rounded-2xl bg-muted/60 px-4 py-3 text-sm">{message}</p>}
    {!created && <form aria-label="Crear plantilla" onSubmit={submit} className="mt-5 space-y-5">
      <div><label htmlFor="template-name" className="block text-sm font-medium">Nombre de la plantilla</label>
        <input id="template-name" className="rti-field" required maxLength={255} value={name} onChange={event => setName(event.target.value)} /></div>
      <div><label htmlFor="template-description" className="block text-sm font-medium">Descripción (opcional)</label>
        <textarea id="template-description" className="rti-field" rows={4} maxLength={10000} value={description}
          onChange={event => setDescription(event.target.value)} /></div>
      <button className="rti-button-primary" disabled={pending}>{pending ? "Creando…" : "Guardar plantilla global"}</button>
    </form>}
  </ProgramModal>;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function primaryReadinessIssue(issues: string[]) {
  const priority = ["PROGRAM_WITHOUT_DATES", "MISSING_DIMENSIONS", "DIMENSION_WITHOUT_SESSIONS",
    "SESSION_WITHOUT_ACTIVITIES", "ACTIVITY_WITHOUT_SURVEY"];
  const issue = priority.find(candidate => issues.includes(candidate)) ?? issues[0];
  return ({ PROGRAM_WITHOUT_DATES: "Faltan las fechas del programa.",
    MISSING_DIMENSIONS: "Faltan dimensiones.",
    DIMENSION_WITHOUT_SESSIONS: "Faltan sesiones.",
    SESSION_WITHOUT_ACTIVITIES: "Faltan actividades.",
    ACTIVITY_WITHOUT_SURVEY: "Faltan encuestas." } as Record<string, string>)[issue]
    ?? "Falta completar el contenido del programa.";
}
