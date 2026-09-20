"use client";

import { signOut } from "aws-amplify/auth";
import { BookOpenText, Building2, CirclePlus, IdCard, LogOut, Mail, RefreshCw, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { fetchCurrentIdentity, IdentityRequestError, type CurrentIdentity } from "@/lib/auth/authenticated-api";

type AccountWorkspaceState = {
  identity?: CurrentIdentity;
  pending: boolean;
  message: string;
  refreshIdentity: (organizationId?: string) => Promise<void>;
};

const AccountWorkspaceContext = createContext<AccountWorkspaceState | null>(null);
const menuItemClass = "inline-flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const inactiveMenuItemClass = "text-muted-foreground hover:bg-secondary hover:text-foreground";

export function AccountWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const request = useRef<AbortController | null>(null);
  const [identity, setIdentity] = useState<CurrentIdentity>();
  const visible = pathname === "/account" || pathname === "/profile"
    || pathname === "/invitations" || pathname === "/my-programs";
  const [pending, setPending] = useState(visible);
  const [message, setMessage] = useState(visible
    ? "Comprobando la sesión…" : "Comprueba la sesión después de volver de Cognito.");

  const refreshIdentity = useCallback(async (organizationId?: string) => {
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
      const active = currentIdentity.organizations.find(item => item.id === currentIdentity.activeOrganizationId);
      if (pathname === "/account" && active?.roles.includes("COLLABORATOR") && active.profileStatus === "PENDING") {
        router.replace(`/profile?organizationId=${encodeURIComponent(active.id)}`);
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      setIdentity(undefined);
      setMessage(identityErrorMessage(error));
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }, [pathname, router]);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    request.current = controller;
    fetchCurrentIdentity(undefined, controller.signal).then(currentIdentity => {
      if (controller.signal.aborted) return;
      setIdentity(currentIdentity);
      setMessage("Sesión autenticada.");
      const active = currentIdentity.organizations.find(item => item.id === currentIdentity.activeOrganizationId);
      if (pathname === "/account" && active?.roles.includes("COLLABORATOR") && active.profileStatus === "PENDING") {
        router.replace(`/profile?organizationId=${encodeURIComponent(active.id)}`);
      }
    }).catch(error => {
      if (!controller.signal.aborted) {
        setIdentity(undefined);
        setMessage(identityErrorMessage(error));
      }
    }).finally(() => { if (!controller.signal.aborted) setPending(false); });
    return () => controller.abort();
  }, [visible, pathname, router]);

  async function endSession() {
    request.current?.abort();
    setIdentity(undefined);
    setPending(true);
    try {
      await signOut();
      setMessage("Sesión cerrada.");
      router.replace("/login");
    } catch {
      setMessage("No se pudo cerrar la sesión. Inténtalo de nuevo.");
    } finally {
      setPending(false);
    }
  }

  const value = useMemo(() => ({ identity, pending, message, refreshIdentity }),
    [identity, pending, message, refreshIdentity]);
  if (!visible) return children;

  const active = identity?.organizations.find(item => item.id === identity.activeOrganizationId);
  const itemClass = (selected: boolean) => `${menuItemClass} ${selected
    ? "bg-primary text-primary-foreground shadow-sm" : inactiveMenuItemClass}`;

  return <AccountWorkspaceContext.Provider value={value}>
    <div className="mx-auto grid w-full max-w-[90rem] gap-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
      <aside className="rti-surface overflow-hidden p-3 lg:sticky lg:top-24" aria-label="Navegación de la cuenta">
        <div className="px-3 pb-3 pt-2">
          <p className="rti-kicker">Tu espacio</p>
          <p className="mt-2 text-lg font-semibold">Cuenta</p>
        </div>
        <nav aria-label="Secciones de la cuenta" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          <Link href="/account" aria-current={pathname === "/account" ? "page" : undefined} className={itemClass(pathname === "/account")}>
            <UserRound aria-hidden="true" className="size-4" />Cuenta
          </Link>
          <Link href="/invitations" aria-current={pathname === "/invitations" ? "page" : undefined} className={itemClass(pathname === "/invitations")}>
            <Mail aria-hidden="true" className="size-4" />Invitaciones
          </Link>
          <Link href="/my-programs" aria-current={pathname === "/my-programs" ? "page" : undefined} className={itemClass(pathname === "/my-programs")}>
            <BookOpenText aria-hidden="true" className="size-4" />Mis programas
          </Link>
          {active?.roles.includes("COLLABORATOR") && <Link
            href={`/profile?organizationId=${encodeURIComponent(active.id)}`}
            aria-current={pathname === "/profile" ? "page" : undefined}
            className={itemClass(pathname === "/profile")}>
            <IdCard aria-hidden="true" className="size-4" />Mi perfil
          </Link>}
          {identity?.activeOrganizationId && identity.roles.some(role => ["CONSULTANT", "COMPANY_ADMIN", "LEADER"].includes(role)) && <Link
            href={`/organizations/${encodeURIComponent(identity.activeOrganizationId)}/programs`} className={`${menuItemClass} ${inactiveMenuItemClass}`}>
            <Building2 aria-hidden="true" className="size-4" />Ver programas
          </Link>}
          {identity?.canCreateOrganizations === true && <Link href="/organizations/new" className={`${menuItemClass} ${inactiveMenuItemClass}`}>
            <CirclePlus aria-hidden="true" className="size-4" />Crear organización
          </Link>}
        </nav>
        <div className="mt-3 flex gap-2 overflow-x-auto border-t border-border/70 px-1 pt-3 lg:flex-col lg:overflow-visible">
          <button type="button" disabled={pending} onClick={() => void refreshIdentity(identity?.activeOrganizationId ?? undefined)}
            className={`${menuItemClass} ${inactiveMenuItemClass} disabled:cursor-not-allowed disabled:opacity-60`}>
            <RefreshCw aria-hidden="true" className={`size-4 ${pending ? "animate-spin" : ""}`} />Comprobar sesión
          </button>
          <button type="button" onClick={() => void endSession()} className={`${menuItemClass} ${inactiveMenuItemClass}`}>
            <LogOut aria-hidden="true" className="size-4" />Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  </AccountWorkspaceContext.Provider>;
}

export function useAccountWorkspace() {
  const state = useContext(AccountWorkspaceContext);
  if (!state) throw new Error("AccountSession must be rendered inside AccountWorkspace");
  return state;
}

function identityErrorMessage(error: unknown) {
  const status = error instanceof IdentityRequestError ? error.status : undefined;
  return status === 401 ? "No hay una sesión autenticada disponible."
    : status === 403 ? "Tu sesión de Cognito es válida, pero no tienes acceso interno habilitado."
      : status === 404 ? "La organización ya no está disponible. Comprueba de nuevo la sesión."
        : "No se pudo consultar el acceso. Inténtalo de nuevo.";
}
