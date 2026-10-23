"use client";
import { useEffect, useState } from "react";
import { listOwnedSessions, scheduleError, type OwnedSession } from "@/lib/participation/session-schedule-api";

export function MySessionAgenda({ programId }: { programId: string }) {
  const [items,setItems]=useState<OwnedSession[]>(); const [message,setMessage]=useState("Consultando sesiones…");
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    listOwnedSessions(programId,controller.signal).then(data=>{if(!controller.signal.aborted){setItems(data);setMessage(data.length?"":"Aún no tienes sesiones agendadas.");}})
      .catch(error=>{if(!controller.signal.aborted){setItems(undefined);setMessage(scheduleError(error));}});
    return()=>controller.abort();
  },[programId,attempt]);
  return <section className="rti-surface p-6 sm:p-8 lg:p-10"><p className="rti-kicker">Tu participación</p><h1 className="mt-2 text-3xl font-semibold">Mi agenda</h1>
    <p className="mt-3 text-sm text-muted-foreground">Estas son las fechas que tu consultor ha asignado a tus sesiones. Las sesiones sin fecha todavía no están disponibles.</p>
    {message&&<p role="status" className="mt-4 rounded-xl bg-muted p-4 text-sm">{message}</p>}
    <ol className="mt-5 space-y-4">{items?.map(item=><li id={`session-${item.session.id}`} key={item.session.id} className="scroll-mt-24 rounded-2xl border border-border p-5">
      <p className="rti-kicker">{item.session.dimensionName}</p><h2 className="mt-2 text-xl font-semibold">{item.session.name}</h2>
      <p className="mt-2 font-medium">Fecha de tu sesión: <time dateTime={item.scheduledDate}>{item.scheduledDate}</time></p>
      {item.session.objective&&<p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{item.session.objective}</p>}
    </li>)}</ol>
    <button className="rti-button-secondary mt-5" onClick={()=>{setItems(undefined);setMessage("Consultando sesiones…");setAttempt(a=>a+1);}}>Actualizar agenda</button>
  </section>;
}
