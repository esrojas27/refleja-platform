"use client";
import { useEffect,useState } from "react";
import { FolderOpen } from "lucide-react";
import { ProgramModal } from "./program-modal";
import { ParticipantFilesPanel } from "@/components/participation/participant-files";
import { listFileParticipants,participantFileError,type FileParticipant,type FileParticipants } from "@/lib/participation/participant-files-api";
export function ProgramFilesArea(props:{organizationId:string;programId:string}){
  return <ProgramFilesContent key={`${props.organizationId}/${props.programId}`} {...props}/>;
}
function ProgramFilesContent({organizationId,programId}:{organizationId:string;programId:string}){
  const [page,setPage]=useState(0);const [attempt,setAttempt]=useState(0);const [result,setResult]=useState<FileParticipants>();
  const [message,setMessage]=useState("Cargando personas…");const [selected,setSelected]=useState<FileParticipant>();
  useEffect(()=>{const controller=new AbortController();
    listFileParticipants(organizationId,programId,page,controller.signal).then(data=>{if(!controller.signal.aborted){setResult(data);setMessage("");}})
      .catch(error=>{if(!controller.signal.aborted)setMessage(participantFileError(error));});
    return()=>controller.abort();
  },[organizationId,programId,page,attempt]);
  function refresh(next=page){setSelected(undefined);setResult(undefined);setMessage("Cargando personas…");setPage(next);setAttempt(v=>v+1);}
  const name=(p:FileParticipant)=>[p.firstName,p.lastName].filter(Boolean).join(" ")||p.email;
  return <section className="rti-surface p-6 sm:p-9"><p className="rti-kicker">Documentos del programa</p>
    <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Archivos</h1>
    <p className="mt-3 max-w-3xl text-muted-foreground">Selecciona una persona para consultar sus archivos de este programa. Solo el consultor puede cargar y eliminar archivos.</p>
    {message&&<p role="status" className="mt-5 rounded-xl bg-muted p-3 text-sm">{message}</p>}
    {result&&<><ul className="mt-6 grid gap-3 sm:grid-cols-2">{result.items.map(p=><li key={p.enrollmentId} className="min-w-0 rounded-2xl border border-border p-4">
      <p className="break-words font-semibold">{name(p)}</p><p className="mt-1 break-all text-sm text-muted-foreground">{p.email}</p>
      <button type="button" className="rti-button-secondary mt-3 gap-2" onClick={()=>setSelected(p)} aria-label={`Archivos de ${name(p)}`}><FolderOpen aria-hidden="true" className="size-4"/>Ver archivos</button>
    </li>)}</ul>
      {!result.items.length&&<p className="mt-5 text-sm">Todavía no hay personas registradas en este programa.</p>}
      <p className="mt-5 text-sm text-muted-foreground">{result.totalElements} personas · Página {page+1} de {Math.max(1,result.totalPages)}</p>
      <div className="mt-3 flex gap-3"><button type="button" className="rti-button-secondary" disabled={!page} onClick={()=>refresh(page-1)}>Anterior</button>
        <button type="button" className="rti-button-secondary" disabled={page+1>=result.totalPages} onClick={()=>refresh(page+1)}>Siguiente</button></div>
    </>}
    <button type="button" className="rti-button-secondary mt-4" onClick={()=>refresh()}>Actualizar personas</button>
    {selected&&<ProgramModal titleId="program-files-title" closeLabel="Cerrar archivos" onClose={()=>setSelected(undefined)}>
      <h2 id="program-files-title" className="break-words text-2xl font-semibold">Archivos de {name(selected)}</h2>
      <ParticipantFilesPanel organizationId={organizationId} programId={programId} enrollmentId={selected.enrollmentId}/>
    </ProgramModal>}
  </section>;
}
