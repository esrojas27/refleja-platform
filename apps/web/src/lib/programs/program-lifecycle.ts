import type { Program } from "./program-api";

export type ProgramStatus = Program["status"];
export type ProgramStatusTarget = "ACTIVE" | "COMPLETED" | "CANCELLED";

export const programStatusLabels: Record<ProgramStatus, string> = {
  DRAFT: "Borrador", SCHEDULED: "Programado", ACTIVE: "Activo", COMPLETED: "Finalizado", CANCELLED: "Cancelado",
};

export const isProgramClosed = (status: ProgramStatus) => status === "COMPLETED" || status === "CANCELLED";

export function programStateMessage(status: ProgramStatus) {
  return status === "DRAFT" || status === "SCHEDULED"
    ? "Este programa está en preparación. Podrás realizar sus actividades cuando el consultor lo active."
    : status === "COMPLETED" ? "Este programa ha finalizado. Puedes consultar tu avance y tus entregas; ya no se reciben respuestas ni encuestas."
      : status === "CANCELLED" ? "Este programa fue cancelado. Tus entregas y tu avance se conservan para consulta."
        : "El programa está activo. Los colaboradores pueden realizar sus actividades y encuestas.";
}
