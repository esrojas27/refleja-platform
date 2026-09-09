"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "aws-amplify/auth";
import Link from "next/link";

import {
  fetchCurrentIdentity,
  IdentityRequestError,
  type CurrentIdentity,
} from "@/lib/auth/authenticated-api";

export function AccountSession() {
  const [identity, setIdentity] = useState<CurrentIdentity>();
  const request = useRef<AbortController | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => () => request.current?.abort(), []);
  const [message, setMessage] = useState(
    "Comprueba la sesión después de volver de Cognito.",
  );

  async function refreshIdentity(organizationId?: string) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setIdentity(undefined);
    setPending(true);
    setMessage("Comprobando la sesión…");
    try {
      const currentIdentity = await fetchCurrentIdentity(organizationId, controller.signal);
      if (controller.signal.aborted) return;
      setIdentity(currentIdentity);
      setMessage("Sesión autenticada.");
    } catch (error) {
      if (controller.signal.aborted) return;
      setIdentity(undefined);
      const status = error instanceof IdentityRequestError ? error.status : undefined;
      setMessage(status === 401
        ? "No hay una sesión autenticada disponible."
        : status === 403
          ? "Tu sesión de Cognito es válida, pero no tienes acceso interno habilitado."
          : status === 404
            ? "La organización ya no está disponible. Comprueba de nuevo la sesión."
            : "No se pudo consultar el acceso. Inténtalo de nuevo.");
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }

  async function endSession() {
    request.current?.abort();
    setIdentity(undefined);
    setPending(true);
    try {
      await signOut();
      setMessage("Sesión cerrada.");
    } catch {
      setMessage("No se pudo cerrar la sesión. Inténtalo de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="w-full rounded-xl border bg-background p-6 shadow-sm sm:p-8">
      <p className="text-sm font-medium text-muted-foreground">
        Área autenticada mínima
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Cuenta</h1>
      <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">
        {message}
      </p>
      {identity ? (
        <div className="mt-4 space-y-4">
        <dl>
          <dt className="text-sm font-medium">Usuario interno</dt>
          <dd className="break-words text-sm">{[identity.user.firstName, identity.user.lastName].filter(Boolean).join(" ") || identity.user.email}</dd>
          <dd className="break-all text-sm text-muted-foreground">{identity.user.email}</dd>
          <dt className="text-sm font-medium">Identificador Cognito</dt>
          <dd className="mt-1 break-all text-sm text-muted-foreground">
            {identity.cognitoSubject}
          </dd>
        </dl>
        {identity.organizations.length === 0 ? (
          <p className="text-sm">No tienes organizaciones disponibles.</p>
        ) : identity.organizations.length > 1 ? (
          <div>
            <label htmlFor="active-organization" className="block text-sm font-medium">Organización activa</label>
            <select id="active-organization" className="mt-1 min-h-10 w-full rounded-md border bg-background p-2 text-sm"
              value={identity.activeOrganizationId ?? ""}
              onChange={(event) => void refreshIdentity(event.target.value || undefined)}>
              <option value="" disabled>Selecciona una organización</option>
              {identity.organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>{organization.name}</option>
              ))}
            </select>
          </div>
        ) : <p className="text-sm">Organización activa: {identity.organizations[0].name}</p>}
        {identity.activeOrganizationId ? (
          <p className="text-sm">Roles activos: {identity.roles.length ? identity.roles.join(", ") : "Sin roles asignados"}</p>
        ) : null}
        </div>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        {identity?.activeOrganizationId && identity.roles.some(role => ["CONSULTANT", "COMPANY_ADMIN", "LEADER"].includes(role)) && (
          <Link href={`/organizations/${encodeURIComponent(identity.activeOrganizationId)}/programs`} className="min-h-10 rounded-md border px-4 py-2 text-sm font-medium">
            Ver programas
          </Link>
        )}
        {identity?.canCreateOrganizations === true && (
          <Link href="/organizations/new" className="min-h-10 rounded-md border px-4 py-2 text-sm font-medium">
            Crear organización
          </Link>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => void refreshIdentity(identity?.activeOrganizationId ?? undefined)}
          className="min-h-10 rounded-md border px-4 py-2 text-sm font-medium"
        >
          Comprobar sesión
        </button>
        <button
          type="button"
          onClick={endSession}
          className="min-h-10 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Cerrar sesión
        </button>
      </div>
    </section>
  );
}
