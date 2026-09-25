"use client";

import { BookOpenText, CheckSquare2, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { CollaboratorActivitiesContext } from "@/components/participation/collaborator-activities-state";
import { activityErrorMessage, listMyProgramActivities, pendingAssignedActivities,
  type AssignedActivity } from "@/lib/participation/activity-api";
import { myProgramsPath } from "@/lib/participation/participation-api";

export function CollaboratorProgramWorkspace({ programId, children }: { programId: string; children: ReactNode }) {
  const pathname = usePathname();
  const summaryPath = myProgramsPath(programId);
  const [result, setResult] = useState<{ programId: string; activities?: AssignedActivity[]; message: string }>();
  const currentResult = result?.programId === programId ? result : undefined;
  const activities = currentResult?.activities;
  const message = currentResult?.message ?? "Cargando actividades asignadas…";
  const pendingCount = activities ? pendingAssignedActivities(activities).length : 0;
  const items = [
    { href: summaryPath, label: "Resumen", icon: BookOpenText },
    { href: `${summaryPath}/activities`, label: "Actividades", icon: CheckSquare2 },
  ];

  useEffect(() => {
    const controller = new AbortController();
    listMyProgramActivities(programId, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setResult({ programId, activities: result.items,
        message: result.items.length ? "" : "Todavía no tienes actividades asignadas en este programa." });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ programId, message: activityErrorMessage(error) });
    });
    return () => controller.abort();
  }, [programId]);

  const activityState = useMemo(() => ({ activities, message, updateActivity: (updated: AssignedActivity) => {
    setResult(current => current?.programId === programId ? { ...current,
      activities: current.activities?.map(activity => activity.id === updated.id ? updated : activity) } : current);
  } }), [activities, message, programId]);

  return <CollaboratorActivitiesContext.Provider value={activityState}><div className="rti-workspace">
    <aside className="rti-workspace-sidebar" aria-label="Espacio del colaborador">
      <div className="px-3 pb-3 pt-2">
        <p className="rti-kicker">Tu participación</p>
        <p className="mt-2 text-lg font-semibold">Programa</p>
      </div>
      <nav aria-label="Secciones de tu programa" className="rti-workspace-nav">
        {items.map(item => {
          const Icon = item.icon;
          const selected = pathname === item.href;
          return <Link key={item.href} href={item.href} aria-current={selected ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${selected
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
            <Icon aria-hidden="true" className="size-4" />
            <span>{item.label}</span>
            {item.label === "Actividades" && pendingCount > 0 && <span
              aria-label={`${pendingCount} ${pendingCount === 1 ? "actividad pendiente" : "actividades pendientes"}`}
              className={`ml-auto inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-bold ${selected
                ? "bg-white text-primary" : "bg-[var(--brand-pink)] text-[var(--brand-black)]"}`}>
              {pendingCount > 99 ? "99+" : pendingCount}
            </span>}
          </Link>;
        })}
      </nav>
      <div className="mt-3 border-t border-border/70 px-3 pt-4">
        <Link href={myProgramsPath()} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
          <ChevronLeft aria-hidden="true" className="size-4" />Mis programas
        </Link>
      </div>
    </aside>
    <div className="rti-workspace-content">{children}</div>
  </div></CollaboratorActivitiesContext.Provider>;
}
