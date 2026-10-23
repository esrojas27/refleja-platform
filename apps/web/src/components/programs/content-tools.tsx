"use client";

import { Archive, ArrowDown, ArrowUp, Copy, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { archiveContent, deleteContent, duplicateActivity, moveContent, type ContentKind } from "@/lib/programs/content-administration-api";
import { programContentErrorMessage } from "@/lib/programs/program-content-api";
import { ProgramModal } from "./program-modal";

export function ContentTools({ organizationId, programId, kind, item, parentArchived = false, hasAssignments,
  hasSubmissions, first, last, onEdit, onSaved }: {
  organizationId: string; programId: string; kind: ContentKind;
  item: { id: string; version: number; archived?: boolean; name?: string; title?: string };
  parentArchived?: boolean; hasAssignments: boolean; hasSubmissions: boolean; first: boolean; last: boolean;
  onEdit: () => void; onSaved: (message: string) => void;
}) {
  const name = item.name ?? item.title ?? "";
  const [dialog, setDialog] = useState<"archive" | "delete" | "duplicate" | null>(null);
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  const unavailable = pending || blocked;
  const visible = !item.archived && !parentArchived;
  async function perform(action: () => Promise<unknown>, notice: string) {
    if (submitting.current || blocked) return;
    submitting.current = true; setPending(true); setMessage("Guardando…");
    try { await action(); setDialog(null); onSaved(notice); }
    catch (error) { setBlocked(true); setMessage(programContentErrorMessage(error) + " Actualiza el contenido antes de repetir la operación."); }
    finally { submitting.current = false; setPending(false); }
  }
  const buttonClass = "inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-medium hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-45";
  return <div className="px-4 py-3">
    {(item.archived || parentArchived) && <p className="mb-2 text-xs font-semibold text-muted-foreground">Archivado{parentArchived ? " por su dimensión o sesión" : ""}</p>}
    <div className="flex flex-wrap gap-2" role="group" aria-label={`Administrar ${name}`}>
      <button type="button" className={buttonClass} disabled={unavailable || !visible} onClick={onEdit}><Pencil aria-hidden="true" className="size-3.5" />Editar</button>
      <button type="button" className={buttonClass} aria-label={`Subir ${name}`} disabled={unavailable || !visible || first}
        onClick={() => void perform(() => moveContent(organizationId, programId, kind, item.id, item.version, "UP"), "Orden actualizado.")}><ArrowUp aria-hidden="true" className="size-3.5" /></button>
      <button type="button" className={buttonClass} aria-label={`Bajar ${name}`} disabled={unavailable || !visible || last}
        onClick={() => void perform(() => moveContent(organizationId, programId, kind, item.id, item.version, "DOWN"), "Orden actualizado.")}><ArrowDown aria-hidden="true" className="size-3.5" /></button>
      {kind === "activities" && <button type="button" className={buttonClass} disabled={unavailable || !visible} onClick={() => setDialog("duplicate")}><Copy aria-hidden="true" className="size-3.5" />Duplicar</button>}
      <button type="button" className={buttonClass} disabled={unavailable || parentArchived || (!item.archived && hasSubmissions)}
        onClick={() => item.archived ? void perform(() => archiveContent(organizationId, programId, kind, item.id, item.version, false), "Contenido restaurado.") : setDialog("archive")}>
        {item.archived ? <RotateCcw aria-hidden="true" className="size-3.5" /> : <Archive aria-hidden="true" className="size-3.5" />}{item.archived ? "Restaurar" : "Archivar"}
      </button>
      <button type="button" className={buttonClass} disabled={unavailable || hasAssignments || hasSubmissions || parentArchived}
        onClick={() => setDialog("delete")}><Trash2 aria-hidden="true" className="size-3.5" />Eliminar</button>
    </div>
    {hasSubmissions ? <p className="mt-2 text-xs text-muted-foreground">Hay entregas: no se puede archivar ni eliminar. Las instrucciones y encuestas de las actividades quedan protegidas.</p>
      : hasAssignments && <p className="mt-2 text-xs text-muted-foreground">Tiene asignaciones: puedes archivar, pero no eliminar.</p>}
    {message && !dialog && <p role="status" className="mt-2 text-sm">{message}</p>}
    {dialog && <ProgramModal titleId={`content-action-${item.id}`} closeLabel="Cerrar administración" onClose={() => { if (!pending) setDialog(null); }}>
      <h2 id={`content-action-${item.id}`} className="text-2xl font-semibold">{dialog === "delete" ? "Eliminar definitivamente" : dialog === "archive" ? "Archivar contenido" : "Duplicar actividad"}</h2>
      <p className="mt-3 break-words font-medium">{name}</p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{dialog === "delete"
        ? "Se eliminará este elemento y su contenido descendiente, incluidas las encuestas. Solo está permitido sin asignaciones ni respuestas. Esta acción no se puede deshacer."
        : dialog === "archive"
          ? "Este elemento y su contenido descendiente dejarán de aparecer en las tareas y el progreso vigente del colaborador y en nuevas plantillas. Las asignaciones se conservan y volverán a estar disponibles al restaurarlo."
          : "La copia incluye instrucciones, video y encuesta con nuevos identificadores. Se asignará según la agenda de esta sesión. No copia entregas, respuestas, revisiones ni progreso."}</p>
      {message && <p role="status" className="mt-4 text-sm">{message}</p>}
      <button type="button" className="rti-button-primary mt-6" disabled={unavailable}
        onClick={() => void perform(() => dialog === "delete" ? deleteContent(organizationId, programId, kind, item.id, item.version)
          : dialog === "archive" ? archiveContent(organizationId, programId, kind, item.id, item.version, true)
            : duplicateActivity(organizationId, programId, item.id, item.version),
          dialog === "delete" ? "Contenido eliminado." : dialog === "archive" ? "Contenido archivado." : "Actividad duplicada.")}>
        {pending ? "Guardando…" : dialog === "delete" ? "Confirmar eliminación" : dialog === "archive" ? "Confirmar archivado" : "Crear copia"}
      </button>
    </ProgramModal>}
  </div>;
}
