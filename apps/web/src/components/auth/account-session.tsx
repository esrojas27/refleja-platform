"use client";

import { Select } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
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
    <section className="rti-surface mx-auto w-full max-w-5xl p-6 sm:p-8 lg:p-10">
      <p className="rti-kicker">
        Tu espacio
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Cuenta</h1>
      <p className="mt-5 rounded-2xl border border-border/70 bg-muted/60 px-4 py-3 text-sm text-muted-foreground" aria-live="polite">
        {message}
      </p>
      {identity ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <dl className="rounded-2xl border border-border/70 bg-background/70 p-5">
            <dt className="rti-kicker">Perfil</dt>
            <dd className="mt-3 break-words text-lg font-semibold">{[identity.user.firstName, identity.user.lastName].filter(Boolean).join(" ") || identity.user.email}</dd>
            <dd className="mt-1 break-all text-sm text-muted-foreground">{identity.user.email}</dd>
            <dt className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Identificador Cognito</dt>
            <dd className="mt-1 break-all font-mono text-xs text-muted-foreground">
              {identity.cognitoSubject}
            </dd>
          </dl>
          <div className="rounded-2xl border border-border/70 bg-background/70 p-5">
            <p className="rti-kicker">Contexto de trabajo</p>
            {identity.organizations.length === 0 ? (
              <p className="mt-3 text-sm">No tienes organizaciones disponibles.</p>
            ) : identity.organizations.length > 1 ? (
              <div className="mt-3">
                <Select.Root
                  items={identity.organizations.map(organization => ({
                    label: organization.name,
                    value: organization.id,
                  }))}
                  value={identity.activeOrganizationId}
                  disabled={pending}
                  onValueChange={(organizationId) => {
                    if (organizationId) void refreshIdentity(organizationId);
                  }}
                >
                  <Select.Label className="block text-sm font-medium">
                    Organización activa
                  </Select.Label>
                  <Select.Trigger
                    id="active-organization"
                    className="rti-field flex cursor-pointer items-center justify-between gap-3 text-left data-[popup-open]:border-primary/60 data-[popup-open]:ring-3 data-[popup-open]:ring-ring/15"
                  >
                    <Select.Value
                      className="min-w-0 flex-1 truncate data-placeholder:text-muted-foreground"
                      placeholder="Selecciona una organización"
                    />
                    <Select.Icon className="text-muted-foreground transition-transform data-[popup-open]:rotate-180">
                      <ChevronDown aria-hidden="true" className="size-4" />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Positioner
                      className="z-50 outline-none"
                      sideOffset={6}
                      alignItemWithTrigger={false}
                    >
                      <Select.Popup className="min-w-[var(--anchor-width)] origin-[var(--transform-origin)] overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl shadow-primary/10 transition-[transform,opacity] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
                        <Select.List className="max-h-[min(18rem,var(--available-height))] overflow-y-auto py-1">
                          {identity.organizations.map((organization) => (
                            <Select.Item
                              key={organization.id}
                              value={organization.id}
                              className="grid cursor-pointer grid-cols-[1rem_1fr] items-center gap-2 rounded-lg px-3 py-2.5 text-sm outline-none data-highlighted:bg-secondary data-highlighted:text-secondary-foreground"
                            >
                              <Select.ItemIndicator className="col-start-1 text-primary">
                                <Check aria-hidden="true" className="size-4" />
                              </Select.ItemIndicator>
                              <Select.ItemText className="col-start-2 min-w-0 truncate">
                                {organization.name}
                              </Select.ItemText>
                            </Select.Item>
                          ))}
                        </Select.List>
                      </Select.Popup>
                    </Select.Positioner>
                  </Select.Portal>
                </Select.Root>
              </div>
            ) : <p className="mt-3 text-base font-semibold">Organización activa: {identity.organizations[0].name}</p>}
            {identity.activeOrganizationId ? (
              <p className="mt-4 text-sm font-medium">Roles activos: {identity.roles.length ? identity.roles.join(", ") : "Sin roles asignados"}</p>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="mt-7 flex flex-wrap gap-3 border-t border-border/70 pt-6">
        <Link href="/invitations" className="rti-button-secondary">
          Invitaciones
        </Link>
        {identity?.organizations.some(organization => organization.roles.includes("COLLABORATOR")) && (
          <Link href="/my-programs" className="rti-button-primary">
            Mis programas
          </Link>
        )}
        {identity?.activeOrganizationId && identity.roles.some(role => ["CONSULTANT", "COMPANY_ADMIN", "LEADER"].includes(role)) && (
          <Link href={`/organizations/${encodeURIComponent(identity.activeOrganizationId)}/programs`} className="rti-button-primary">
            Ver programas
          </Link>
        )}
        {identity?.canCreateOrganizations === true && (
          <Link href="/organizations/new" className="rti-button-secondary">
            Crear organización
          </Link>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => void refreshIdentity(identity?.activeOrganizationId ?? undefined)}
          className="rti-button-secondary"
        >
          Comprobar sesión
        </button>
        <button
          type="button"
          onClick={endSession}
          className="rti-button-secondary"
        >
          Cerrar sesión
        </button>
      </div>
    </section>
  );
}
