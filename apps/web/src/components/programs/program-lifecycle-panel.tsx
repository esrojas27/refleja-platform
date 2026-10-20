"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Play, XCircle } from "lucide-react";
import { changeProgramStatus, getProgram, programErrorMessage, type Program } from "@/lib/programs/program-api";
import { isProgramClosed, programStatusLabels, type ProgramStatusTarget } from "@/lib/programs/program-lifecycle";
import { ProgramModal } from "./program-modal";
import { useProgramState } from "./program-state-context";

const actionLabels = { ACTIVE: "Activar programa", COMPLETED: "Finalizar programa", CANCELLED: "Cancelar programa" };

export function ProgramLifecyclePanel({ program, onChanged }: { program: Program; onChanged: (program: Program) => void }) {
  const workspace = useProgramState();
  const [target, setTarget] = useState<ProgramStatusTarget>();
  const [pending, setPending] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  function saved(value: Program) { onChanged(value); workspace?.update(value); }

  async function confirm() {
    if (!target || submitting.current || needsRefresh) return;
    submitting.current = true; setPending(true); setMessage("");
    try {
      const result = await changeProgramStatus(program.organizationId, program.id, target, program.version);
      saved(result); setTarget(undefined);
      setMessage(`Programa ${programStatusLabels[result.status].toLowerCase()}.`);
    } catch (error) {
      setNeedsRefresh(true);
      setTarget(undefined);
      setMessage(`${programErrorMessage(error)} Actualiza para comprobar el estado antes de repetir la acción.`);
    } finally { submitting.current = false; setPending(false); }
  }

  async function refresh() {
    if (submitting.current) return;
    submitting.current = true; setPending(true);
    try {
      saved(await getProgram(program.organizationId, program.id));
      setNeedsRefresh(false); setMessage("Estado del programa actualizado.");
    } catch (error) { setMessage(programErrorMessage(error)); }
    finally { submitting.current = false; setPending(false); }
  }

  return <section aria-labelledby="program-lifecycle-title" className="mt-7 rounded-2xl border border-border bg-background/70 p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="program-lifecycle-title" className="text-xl font-semibold">Ciclo de vida del programa</h2>
      <span className="rounded-full border border-border bg-muted px-3 py-1 text-sm font-semibold">{programStatusLabels[program.status]}</span>
    </div>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">{isProgramClosed(program.status)
      ? "El programa está cerrado. Su contenido, sus entregas y su progreso permanecen disponibles para consulta."
      : program.status === "ACTIVE" ? "Los colaboradores pueden realizar sus actividades y encuestas; puedes revisar las entregas."
        : "Prepara el contenido y las invitaciones. Activa el programa cuando los colaboradores puedan comenzar a realizar sus actividades."}</p>
    {!isProgramClosed(program.status) && <div className="mt-5 flex flex-wrap gap-3">
      {program.status !== "ACTIVE" ? <button type="button" disabled={pending || needsRefresh}
        className="rti-button-primary" onClick={() => setTarget("ACTIVE")}><Play aria-hidden="true" className="size-4" />Activar programa</button>
        : <button type="button" disabled={pending || needsRefresh} className="rti-button-primary" onClick={() => setTarget("COMPLETED")}>
          <CheckCircle2 aria-hidden="true" className="size-4" />Finalizar programa</button>}
      <button type="button" disabled={pending || needsRefresh} className="rti-button-secondary" onClick={() => setTarget("CANCELLED")}>
        <XCircle aria-hidden="true" className="size-4" />Cancelar programa</button>
    </div>}
    {message && <p role="status" className="mt-4 rounded-xl bg-muted/60 px-4 py-3 text-sm">{message}</p>}
    <button type="button" disabled={pending} className="rti-link mt-4 text-sm" onClick={() => void refresh()}>Actualizar estado</button>
    {target && <ProgramModal titleId="program-status-confirm-title" closeLabel="Cerrar confirmación"
      onClose={() => { if (!submitting.current) setTarget(undefined); }}>
      <p className="rti-kicker">Estado del programa</p>
      <h2 id="program-status-confirm-title" className="mt-2 text-2xl font-semibold">{actionLabels[target]}</h2>
      <p className="mt-3 break-words font-semibold">{program.name}</p>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">{target === "ACTIVE"
        ? "Los colaboradores inscritos podrán realizar las actividades asignadas y responder sus encuestas. La activación es inmediata y manual, independientemente de las fechas. Revisa el contenido antes de continuar."
        : target === "COMPLETED"
          ? "Puedes finalizar aunque existan actividades sin entregar, encuestas pendientes o entregas por revisar. Esos pendientes conservarán su estado y el progreso real: no se marcarán como completados."
          : "Se detendrá la participación en este programa. El contenido, las inscripciones, las respuestas y el progreso se conservarán."}</p>
      {target !== "ACTIVE" && <p className="mt-4 rounded-xl border border-border bg-accent p-4 text-sm font-medium">
        El programa quedará solo para consulta. No se podrán enviar actividades, responder encuestas, revisar entregas ni modificar su contenido o participantes. Esta acción no se puede deshacer desde la aplicación.
      </p>}
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" className="rti-button-primary" disabled={pending} onClick={() => void confirm()}>
          {pending ? "Guardando…" : `Confirmar: ${actionLabels[target].toLowerCase()}`}</button>
        <button type="button" className="rti-button-secondary" disabled={pending} onClick={() => setTarget(undefined)}>Volver</button>
      </div>
    </ProgramModal>}
  </section>;
}
