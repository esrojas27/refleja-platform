"use client";

import { BookOpenText, CircleUserRound, Mail } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { Brand } from "@/components/layout/brand";
import { fetchCurrentIdentity } from "@/lib/auth/authenticated-api";

const accountNavigationItem = { href: "/account", label: "Cuenta", icon: CircleUserRound };
const collaboratorNavigationItem = { href: "/my-programs", label: "Mis programas", icon: BookOpenText };
const invitationsNavigationItem = { href: "/invitations", label: "Invitaciones", icon: Mail };

export function AppShell({ children }: { children: ReactNode }) {
  const [showMyPrograms, setShowMyPrograms] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchCurrentIdentity(undefined, controller.signal).then(identity => {
      if (!controller.signal.aborted) {
        setShowMyPrograms(identity.organizations.some(organization => organization.roles.includes("COLLABORATOR")));
      }
    }).catch(() => {
      if (!controller.signal.aborted) setShowMyPrograms(false);
    });
    return () => controller.abort();
  }, []);

  const visibleNavigation = showMyPrograms
    ? [accountNavigationItem, collaboratorNavigationItem, invitationsNavigationItem]
    : [accountNavigationItem, invitationsNavigationItem];

  return (
    <div className="rti-app flex min-h-dvh flex-col">
      <a
        href="#contenido-principal"
        className="fixed left-4 top-3 z-50 -translate-y-24 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform focus:translate-y-0"
      >
        Ir al contenido
      </a>

      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[100rem] items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-6 lg:px-8">
          <Brand compact />
          <nav aria-label="Navegación principal" className="flex items-center gap-1 rounded-2xl border border-border/60 bg-muted/40 p-1 sm:gap-2">
            {visibleNavigation.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className="inline-flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:flex-row sm:gap-2 sm:px-4 sm:text-sm"
              >
                <Icon aria-hidden="true" className="size-4" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main id="contenido-principal" className="mx-auto flex w-full max-w-[100rem] flex-1 items-start px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
        {children}
      </main>

      <footer className="border-t border-border/70 bg-background/70">
        <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-1 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>Refleja Tu Interior</p>
          <p>Tu historia, tu mayor diferencial.</p>
        </div>
      </footer>
    </div>
  );
}
