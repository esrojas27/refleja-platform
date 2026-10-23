"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import type { InvitationBatch } from "@/lib/participation/participation-api";

export type InvitationFeedback = {
  id: number; tone: "success" | "warning" | "info"; title: string; message: string; hasFailures: boolean;
};

export function batchFeedback(result: InvitationBatch): Omit<InvitationFeedback, "id"> {
  const hasFailures = !!result.failures?.length;
  if (result.failed > 0) return {
    tone: "warning", title: "Hay invitaciones por revisar",
    message: `${result.sent} con envío confirmado · ${result.failed} sin confirmar${result.inProgress ? ` · ${result.inProgress} en curso` : ""}.`, hasFailures,
  };
  if (result.inProgress > 0) return {
    tone: "info", title: "Hay invitaciones en curso",
    message: `${result.sent} con envío confirmado · ${result.inProgress} todavía en curso. Actualiza el listado para consultar el resultado.`, hasFailures,
  };
  return result.sent > 0 ? {
    tone: "success", title: "Invitaciones enviadas",
    message: `Se solicitó correctamente el envío de ${result.sent} ${result.sent === 1 ? "invitación" : "invitaciones"}.`, hasFailures,
  } : {
    tone: "info", title: "Lista de invitaciones actualizada",
    message: "No hay invitaciones pendientes de envío. Las ya enviadas no se reenvían.", hasFailures,
  };
}

export function InvitationSendFeedback({ feedback, onDismiss }: { feedback: InvitationFeedback; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    // Only success disappears automatically. Warnings stay until deliberately dismissed.
    if (feedback.tone !== "success" || paused) return;
    const timer = window.setTimeout(onDismiss, 8_000);
    return () => window.clearTimeout(timer);
  }, [feedback.id, feedback.tone, paused, onDismiss]);
  const Icon = feedback.tone === "success" ? CheckCircle2 : feedback.tone === "warning" ? AlertTriangle : Info;
  const colors = feedback.tone === "success" ? "bg-emerald-50 text-emerald-800"
    : feedback.tone === "warning" ? "bg-amber-50 text-amber-900" : "bg-accent text-foreground";
  return <aside role={feedback.tone === "warning" ? "alert" : "status"} aria-atomic="true"
    aria-label="Resultado del envío de invitaciones"
    onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}
    className="fixed inset-x-4 bottom-4 z-50 max-h-[calc(100dvh-2rem)] animate-in overflow-y-auto fade-in slide-in-from-bottom-3 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-xl duration-300 motion-reduce:animate-none sm:left-auto sm:right-6 sm:bottom-6 sm:w-[25rem]">
    <div className="flex items-start gap-3">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${colors}`}><Icon aria-hidden="true" className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{feedback.title}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{feedback.message}</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">Un envío confirmado no garantiza la llegada a la bandeja de entrada.</p>
        {feedback.hasFailures && <a href="#invitation-delivery-failures" className="rti-link mt-3 inline-block text-sm font-medium" onClick={onDismiss}>Ver correos con envío no confirmado</a>}
      </div>
      <button type="button" aria-label="Cerrar aviso de invitaciones" onClick={onDismiss}
        className="-mr-1 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  </aside>;
}
