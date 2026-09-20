"use client";

import { BookOpenText, CheckSquare2, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { myProgramsPath } from "@/lib/participation/participation-api";

export function CollaboratorProgramWorkspace({ programId, children }: { programId: string; children: ReactNode }) {
  const pathname = usePathname();
  const summaryPath = myProgramsPath(programId);
  const items = [
    { href: summaryPath, label: "Resumen", icon: BookOpenText },
    { href: `${summaryPath}/activities`, label: "Actividades", icon: CheckSquare2 },
  ];

  return <div className="mx-auto grid w-full max-w-[90rem] gap-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
    <aside className="rti-surface overflow-hidden p-3 lg:sticky lg:top-24" aria-label="Espacio del colaborador">
      <div className="px-3 pb-3 pt-2">
        <p className="rti-kicker">Tu participación</p>
        <p className="mt-2 text-lg font-semibold">Programa</p>
      </div>
      <nav aria-label="Secciones de tu programa" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        {items.map(item => {
          const Icon = item.icon;
          const selected = pathname === item.href;
          return <Link key={item.href} href={item.href} aria-current={selected ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${selected
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
            <Icon aria-hidden="true" className="size-4" />{item.label}
          </Link>;
        })}
      </nav>
      <div className="mt-3 border-t border-border/70 px-3 pt-4">
        <Link href={myProgramsPath()} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
          <ChevronLeft aria-hidden="true" className="size-4" />Mis programas
        </Link>
      </div>
    </aside>
    <div className="min-w-0">{children}</div>
  </div>;
}
