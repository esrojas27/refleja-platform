"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchCurrentIdentity, IdentityRequestError } from "@/lib/auth/authenticated-api";
import { ActivityRequestError, activityErrorMessage, listProgramActivities,
  type ProgramActivity } from "@/lib/participation/activity-api";
import { ConsultantProgressOverview } from "@/components/participation/progress-overview";

export function ProgramProgressArea({ organizationId, programId }: { organizationId: string; programId: string }) {
  const [activities, setActivities] = useState<ProgramActivity[]>();
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(true);
  const [message, setMessage] = useState("Comprobando acceso y calculando progreso…");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const identity = await fetchCurrentIdentity(organizationId, controller.signal);
        if (identity.activeOrganizationId !== organizationId || !identity.roles.includes("CONSULTANT")) {
          setMessage("Sólo un consultor autorizado puede consultar el progreso del programa."); return;
        }
        const result = await listProgramActivities(organizationId, programId, controller.signal);
        if (!controller.signal.aborted) {
          setActivities(result.items);
          setMessage(result.items.length ? "" : "Aún no hay actividades asignadas para calcular progreso.");
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        const normalized = error instanceof IdentityRequestError ? new ActivityRequestError(error.status) : error;
        setMessage(activityErrorMessage(normalized));
      } finally { if (!controller.signal.aborted) setPending(false); }
    }
    void load();
    return () => controller.abort();
  }, [organizationId, programId, attempt]);

  function refresh() {
    setActivities(undefined); setPending(true); setMessage("Actualizando progreso…");
    setAttempt(value => value + 1);
  }

  return <section className="rti-surface w-full p-6 sm:p-8 lg:p-10">
    <p className="rti-kicker">Seguimiento</p>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Progreso</h1>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
      Detecta avances, entregas por revisar y personas que necesitan acompañamiento.
    </p>
    {message && <p role="status" className="mt-5 rounded-2xl bg-muted/60 px-4 py-3 text-sm">{message}</p>}
    {activities && activities.length > 0 && <div className="mt-7"><ConsultantProgressOverview activities={activities} /></div>}
    <button className="rti-button-secondary mt-7" disabled={pending} onClick={refresh}>Actualizar progreso</button>
    <nav aria-label="Navegación de progreso" className="mt-8 flex flex-wrap gap-4 border-t border-border/70 pt-6 text-sm">
      <Link href={`/organizations/${encodeURIComponent(organizationId)}/programs/${encodeURIComponent(programId)}`}
        className="rti-link">Volver al programa</Link>
      <Link href="/account" className="rti-link">Volver a Cuenta</Link>
    </nav>
  </section>;
}
