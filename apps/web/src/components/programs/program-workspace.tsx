"use client";

import Link from "next/link";
import { BarChart3, BookOpenText, BrainCircuit, CheckSquare2, ChevronLeft, ListTree, UsersRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { fetchCurrentIdentity } from "@/lib/auth/authenticated-api";
import { programsPath } from "@/lib/programs/program-api";

type WorkspaceItem = {
  href: string;
  label: string;
  icon: typeof BookOpenText;
  active: (pathname: string) => boolean;
};

export function ProgramWorkspace({
  organizationId,
  programId,
  children,
}: {
  organizationId: string;
  programId: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [canManageDisc, setCanManageDisc] = useState(false);
  const programPath = `${programsPath(organizationId)}/${encodeURIComponent(programId)}`;

  useEffect(() => {
    const controller = new AbortController();
    fetchCurrentIdentity(organizationId, controller.signal)
      .then(identity => setCanManageDisc(identity.roles.some(role => role === "CONSULTANT" || role === "LEADER")))
      .catch(() => setCanManageDisc(false));
    return () => controller.abort();
  }, [organizationId]);

  const items: WorkspaceItem[] = [
    {
      href: programPath,
      label: "Resumen",
      icon: BookOpenText,
      active: current => current === programPath,
    },
    {
      href: `${programPath}/content`,
      label: "Contenido",
      icon: ListTree,
      active: current => current === `${programPath}/content`,
    },
    {
      href: `${programPath}/enrollments`,
      label: "Colaboradores",
      icon: UsersRound,
      active: current => current === `${programPath}/enrollments`,
    },
    {
      href: `${programPath}/activities`,
      label: "Actividades",
      icon: CheckSquare2,
      active: current => current === `${programPath}/activities`,
    },
    {
      href: `${programPath}/progress`,
      label: "Progreso",
      icon: BarChart3,
      active: current => current === `${programPath}/progress`,
    },
    ...(canManageDisc ? [{
      href: `${programPath}/disc`,
      label: "DISC",
      icon: BrainCircuit,
      active: (current: string) => current === `${programPath}/disc`,
    }] : []),
  ];

  return (
    <div className="mx-auto grid w-full max-w-[90rem] gap-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
      <aside className="rti-surface overflow-hidden p-3 lg:sticky lg:top-24" aria-label="Espacio de trabajo del programa">
        <div className="px-3 pb-3 pt-2">
          <p className="rti-kicker">Espacio de trabajo</p>
          <p className="mt-2 text-lg font-semibold">Programa</p>
        </div>
        <nav aria-label="Secciones del programa" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          {items.map(item => {
            const Icon = item.icon;
            const selected = item.active(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={selected ? "page" : undefined}
                className={`inline-flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                  selected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon aria-hidden="true" className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-3 border-t border-border/70 px-3 pt-4">
          <Link href={programsPath(organizationId)} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            <ChevronLeft aria-hidden="true" className="size-4" />
            Todos los programas
          </Link>
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
