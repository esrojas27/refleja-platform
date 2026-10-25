"use client";

import { BookOpenText, CheckSquare2, ChevronLeft, CalendarDays } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { CollaboratorActivitiesContext } from "@/components/participation/collaborator-activities-state";
import { activityErrorMessage, listMyProgramActivities, pendingAssignedActivities,
  type AssignedActivity } from "@/lib/participation/activity-api";
import { getMyProgram, myProgramsPath, type MyProgram } from "@/lib/participation/participation-api";
import { listMySessionClosures } from "@/lib/participation/session-closure-api";

export function CollaboratorProgramWorkspace({ programId, children }: { programId: string; children: ReactNode }) {
  const pathname = usePathname();
  const summaryPath = myProgramsPath(programId);
  const [result, setResult] = useState<{ programId: string; activities?: AssignedActivity[]; message: string; status?: MyProgram["status"]; enrollmentStatus?: MyProgram["enrollmentStatus"];closingPending?:number }>();
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{const reload=()=>setAttempt(a=>a+1);window.addEventListener("rti:session-work-changed",reload);return()=>window.removeEventListener("rti:session-work-changed",reload);},[]);
  const currentResult = result?.programId === programId ? result : undefined;
  const activities = currentResult?.activities;
  const message = currentResult?.message ?? "Cargando actividades asignadas…";
  const pendingCount = activities && currentResult?.status === "ACTIVE" && currentResult.enrollmentStatus !== "COMPLETED" ? pendingAssignedActivities(activities).length+(currentResult.closingPending??0) : 0;
  const items = [
    { href: summaryPath, label: "Resumen", icon: BookOpenText },
    { href: `${summaryPath}/agenda`, label: "Mi agenda", icon: CalendarDays },
    { href: `${summaryPath}/activities`, label: "Actividades", icon: CheckSquare2 },
  ];

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([listMyProgramActivities(programId, controller.signal), getMyProgram(programId, controller.signal),listMySessionClosures(programId,controller.signal)]).then(([result, program,closures]) => {
      if (controller.signal.aborted) return;
      setResult({ programId, activities: result.items, status: program.status, enrollmentStatus: program.enrollmentStatus,closingPending:closures.items.filter(s=>s.status==="COMMENT"||s.status==="PENDING").length,
        message: result.items.length ? "" : "Todavía no tienes actividades asignadas en este programa." });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ programId, message: activityErrorMessage(error) });
    });
    return () => controller.abort();
  }, [programId,attempt]);

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
              aria-label={`${pendingCount} ${pendingCount === 1 ? "pendiente entre actividades y cierres" : "pendientes entre actividades y cierres"}`}
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
