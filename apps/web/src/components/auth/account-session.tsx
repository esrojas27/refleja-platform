"use client";

import { Select } from "@base-ui/react/select";
import { BadgeCheck, Check, ChevronDown, CircleAlert } from "lucide-react";

import { useAccountWorkspace } from "@/components/auth/account-workspace";

export function AccountSession() {
  const { identity, pending, message, refreshIdentity } = useAccountWorkspace();

  const activeOrganization = identity?.organizations.find(
    organization => organization.id === identity.activeOrganizationId);

  return (
    <section className="rti-surface min-w-0 p-6 sm:p-8 lg:p-10">
        <p className="rti-kicker">Tu espacio</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Cuenta</h1>
        <p className="mt-5 rounded-2xl border border-border/70 bg-muted/60 px-4 py-3 text-sm text-muted-foreground" aria-live="polite">
          {message}
        </p>
        {identity ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <dl className="rounded-2xl border border-border/70 bg-background/70 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <dt className="rti-kicker">Perfil</dt>
                {activeOrganization?.roles.includes("COLLABORATOR") && (
                  <dd className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                    activeOrganization.profileStatus === "COMPLETE"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}>
                    {activeOrganization.profileStatus === "COMPLETE"
                      ? <BadgeCheck aria-hidden="true" className="size-4" />
                      : <CircleAlert aria-hidden="true" className="size-4" />}
                    {activeOrganization.profileStatus === "COMPLETE" ? "Perfil verificado" : "Perfil pendiente"}
                  </dd>
                )}
              </div>
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
                    items={identity.organizations.map(organization => ({ label: organization.name, value: organization.id }))}
                    value={identity.activeOrganizationId}
                    disabled={pending}
                    onValueChange={(organizationId) => { if (organizationId) void refreshIdentity(organizationId); }}
                  >
                    <Select.Label className="block text-sm font-medium">Organización activa</Select.Label>
                    <Select.Trigger id="active-organization"
                      className="rti-field flex cursor-pointer items-center justify-between gap-3 text-left data-[popup-open]:border-primary/60 data-[popup-open]:ring-3 data-[popup-open]:ring-ring/15">
                      <Select.Value className="min-w-0 flex-1 truncate data-placeholder:text-muted-foreground" placeholder="Selecciona una organización" />
                      <Select.Icon className="text-muted-foreground transition-transform data-[popup-open]:rotate-180">
                        <ChevronDown aria-hidden="true" className="size-4" />
                      </Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Positioner className="z-50 outline-none" sideOffset={6} alignItemWithTrigger={false}>
                        <Select.Popup className="min-w-[var(--anchor-width)] origin-[var(--transform-origin)] overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl shadow-primary/10 transition-[transform,opacity] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
                          <Select.List className="max-h-[min(18rem,var(--available-height))] overflow-y-auto py-1">
                            {identity.organizations.map((organization) => (
                              <Select.Item key={organization.id} value={organization.id}
                                className="grid cursor-pointer grid-cols-[1rem_1fr] items-center gap-2 rounded-lg px-3 py-2.5 text-sm outline-none data-highlighted:bg-secondary data-highlighted:text-secondary-foreground">
                                <Select.ItemIndicator className="col-start-1 text-primary"><Check aria-hidden="true" className="size-4" /></Select.ItemIndicator>
                                <Select.ItemText className="col-start-2 min-w-0 truncate">{organization.name}</Select.ItemText>
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
                <p className="mt-4 text-sm font-medium">Roles activos: {identity.roles.length ? identity.roles.map(roleLabel).join(", ") : "Sin roles asignados"}</p>
              ) : null}
            </div>
          </div>
        ) : null}
    </section>
  );
}

function roleLabel(role: string) {
  return role === "COMPANY_ADMIN" ? "RRHH"
    : role === "LEADER" ? "Líder"
    : role === "COLLABORATOR" ? "Colaborador"
    : role === "CONSULTANT" ? "Consultor"
    : role === "SUPER_ADMIN" ? "Superadministrador"
    : role;
}
