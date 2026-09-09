"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { fetchCurrentIdentity, IdentityRequestError } from "@/lib/auth/authenticated-api";
import { createOrganization, OrganizationRequestError, type Organization } from "@/lib/organizations/create-organization";

export function CreateOrganizationForm() {
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [name, setName] = useState("");
  const [zone, setZone] = useState("America/Bogota");
  const [message, setMessage] = useState("Comprobando permiso de creación…");
  const [fields, setFields] = useState<string[]>([]);
  const [created, setCreated] = useState<Organization>();
  const active = useRef<AbortController | null>(null);
  const submitting = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    active.current = controller;
    fetchCurrentIdentity(undefined, controller.signal).then(identity => {
      if (controller.signal.aborted) return;
      setAllowed(identity.canCreateOrganizations === true);
      setMessage(identity.canCreateOrganizations ? "" : "No tienes permiso para crear organizaciones.");
    }).catch(error => {
      if (controller.signal.aborted) return;
      setMessage(error instanceof IdentityRequestError && error.status === 401
        ? "Inicia sesión para continuar." : "No se pudo comprobar el permiso. Vuelve a Cuenta y comprueba tu sesión.");
    }).finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => active.current?.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!allowed || submitting.current || uncertain) return;
    const invalid = [];
    if (!name.trim() || name.length > 255 || /[\u0000-\u001f\u007f]/.test(name)) invalid.push("name");
    try { new Intl.DateTimeFormat("es", { timeZone: zone }).format(); } catch { invalid.push("defaultTimeZone"); }
    if (!zone || zone.length > 255) invalid.push("defaultTimeZone");
    setFields(invalid);
    if (invalid.length) { setMessage("Revisa los campos indicados."); return; }
    submitting.current = true;
    setPending(true);
    setMessage("Creando organización…");
    const controller = new AbortController();
    active.current = controller;
    try {
      const result = await createOrganization({ name: name.trim(), defaultTimeZone: zone }, controller.signal);
      if (controller.signal.aborted) return;
      setCreated(result);
      setMessage("Organización creada.");
    } catch (error) {
      if (controller.signal.aborted) return;
      const failure = error instanceof OrganizationRequestError ? error : new OrganizationRequestError(0);
      setFields(failure.fields);
      if (failure.status === 401 || failure.status === 403) setAllowed(false);
      const unknownOutcome = failure.status === 0 || failure.status >= 500;
      setUncertain(unknownOutcome);
      const detail = failure.status === 400 ? "Revisa el nombre y la zona horaria."
        : failure.status === 401 ? "Tu sesión venció. Inicia sesión de nuevo."
        : failure.status === 403 ? "Ya no tienes permiso para crear organizaciones."
        : failure.status === 409 ? "No se pudo crear por un conflicto. Comprueba tu cuenta antes de reintentar."
        : "No se pudo confirmar el resultado. Revisa las organizaciones de tu cuenta antes de repetir la creación.";
      setMessage(detail + (failure.requestId ? ` Referencia: ${failure.requestId}` : ""));
    } finally {
      submitting.current = false;
      if (!controller.signal.aborted) setPending(false);
    }
  }

  return (
    <section className="w-full max-w-xl rounded-xl border bg-background p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-semibold">Crear organización</h1>
      <p className="mt-2 text-sm text-muted-foreground">Datos básicos de la empresa. Tu acceso como consultor se asignará al crearla.</p>
      <p className="mt-4 text-sm" role="status" aria-live="polite">{message}</p>
      {created ? (
        <dl className="mt-4 space-y-2 break-words">
          <dt className="font-medium">Organización</dt><dd>{created.name}</dd>
          <dt className="font-medium">Estado</dt><dd>{created.status}</dd>
          <dt className="font-medium">Zona horaria</dt><dd>{created.defaultTimeZone}</dd>
          <dt className="font-medium">Versión</dt><dd>{created.version}</dd>
        </dl>
      ) : allowed && !checking ? (
        <form className="mt-4 space-y-4" onSubmit={submit} aria-label="Crear organización" noValidate>
          <div>
            <label htmlFor="organization-name" className="block text-sm font-medium">Nombre</label>
            <input id="organization-name" value={name} onChange={e => setName(e.target.value)} required maxLength={255}
              disabled={pending || uncertain} aria-invalid={fields.includes("name")} aria-describedby={fields.includes("name") ? "name-error" : undefined}
              className="mt-1 min-h-10 w-full rounded-md border px-3 py-2" />
            {fields.includes("name") && <p id="name-error" className="text-sm text-destructive">Escribe un nombre válido de hasta 255 caracteres.</p>}
          </div>
          <div>
            <label htmlFor="organization-zone" className="block text-sm font-medium">Zona horaria</label>
            <input id="organization-zone" value={zone} onChange={e => setZone(e.target.value)} required maxLength={255}
              disabled={pending || uncertain} aria-invalid={fields.includes("defaultTimeZone")}
              aria-describedby="zone-help" className="mt-1 min-h-10 w-full rounded-md border px-3 py-2" />
            <p id="zone-help" className="mt-1 text-sm text-muted-foreground">{fields.includes("defaultTimeZone")
              ? "Introduce una zona horaria válida, por ejemplo America/Bogota."
              : "Identificador IANA, por ejemplo America/Bogota o Europe/Madrid."}</p>
          </div>
          <button disabled={pending || uncertain} className="min-h-10 rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">
            {pending ? "Creando…" : "Crear organización"}
          </button>
        </form>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        <Link href="/account" className="underline">Volver a Cuenta</Link>
        {!checking && !allowed && <Link href="/login" className="underline">Ir a iniciar sesión</Link>}
      </div>
    </section>
  );
}
