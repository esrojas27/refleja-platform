"use client";

/* eslint-disable @next/next/no-img-element -- files are private authenticated blob URLs */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Download, Eye, FileText, FolderOpen, Trash2, Upload, X } from "lucide-react";
import { ProgramModal } from "@/components/programs/program-modal";
import { deleteParticipantFile, fetchParticipantFile, listParticipantFiles, uploadParticipantFile,
  MAX_PARTICIPANT_FILE_BYTES, PARTICIPANT_FILE_TYPES, participantFilesPath, ParticipantFileError, participantFileError, participantFileName,
  type FileScope, type ParticipantFile, type ParticipantFileList } from "@/lib/participation/participant-files-api";

export function ParticipantFilesAction({ organizationId, programId, enrollmentId, name }: {
  organizationId:string;programId:string;enrollmentId:string;name:string;
}){
  const [open,setOpen]=useState(false);
  return <div className="pt-2"><button type="button" className="rti-button-secondary gap-2" onClick={()=>setOpen(true)}>
    <FolderOpen className="size-4" aria-hidden="true"/>Archivos</button>
    {open&&<ProgramModal onClose={()=>setOpen(false)} titleId="participant-files-title" closeLabel="Cerrar archivos">
      <h2 id="participant-files-title" className="break-words text-2xl font-semibold">Archivos de {name}</h2>
      <ParticipantFilesPanel programId={programId} organizationId={organizationId} enrollmentId={enrollmentId}/>
    </ProgramModal>}
  </div>;
}
export function MyParticipantFiles({programId}:{programId:string}){
  return <section className="rti-surface p-6 sm:p-9"><p className="rti-kicker">Tu participación</p>
    <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Archivos</h1>
    <p className="mt-3 text-muted-foreground">Consulta y descarga los documentos e imágenes que tu consultor ha compartido contigo en este programa.</p>
    <ParticipantFilesPanel programId={programId}/>
  </section>;
}
export function ParticipantFilesPanel(scope:FileScope){
  return <ParticipantFilesContent key={participantFilesPath(scope)} {...scope}/>;
}
function ParticipantFilesContent({programId,organizationId,enrollmentId}:FileScope){
  const [attempt,setAttempt]=useState(0);
  const [result,setResult]=useState<ParticipantFileList>();
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("Cargando archivos…");
  const [notice,setNotice]=useState("");
  useEffect(()=>{
    const controller=new AbortController();
    listParticipantFiles({programId,organizationId,enrollmentId},controller.signal).then(data=>{
      if(!controller.signal.aborted){setResult(data);setMessage("");}
    }).catch(error=>{if(!controller.signal.aborted)setMessage(participantFileError(error));})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[programId,organizationId,enrollmentId,attempt]);
  function refresh(text=""){setResult(undefined);setLoading(true);setMessage("Cargando archivos…");setNotice(text);setAttempt(v=>v+1);}
  const scope={programId,organizationId,enrollmentId};
  return <div className="mt-5 space-y-5">
    {notice&&<p role="status" className="rounded-xl bg-accent p-3 text-sm">{notice}</p>}
    {message&&<p role="status" className="rounded-xl bg-muted p-3 text-sm">{message}</p>}
    {result&&<>
      {result.canManage&&<FileUpload scope={scope} full={result.items.length>=result.maxFiles} onSaved={()=>refresh("Archivo cargado y disponible para la persona en este programa.")}/>}
      <div><p className="text-sm text-muted-foreground">{result.items.length}/{result.maxFiles} archivos · Hasta 10 MB por archivo</p>
        {!result.items.length?<p className="mt-3 rounded-xl border border-dashed border-border p-5 text-sm">Todavía no hay archivos para esta persona en este programa.</p>
          :<ul className="mt-3 space-y-3">{result.items.map(file=><li key={file.id}>
            <FileRow scope={scope} file={file} canManage={result.canManage} onDeleted={()=>refresh("Archivo eliminado.")}/>
          </li>)}</ul>}
      </div>
    </>}
    <button type="button" className="rti-button-secondary" disabled={loading} onClick={()=>refresh()}>Actualizar archivos</button>
  </div>;
}
function FileUpload({scope,full,onSaved}:{scope:FileScope;full:boolean;onSaved:()=>void}){
  const [name,setName]=useState("");const [file,setFile]=useState<File>();const [pending,setPending]=useState(false);
  const [blocked,setBlocked]=useState(false);const [message,setMessage]=useState("");const writing=useRef(false);
  const request=useRef<AbortController|null>(null);
  useEffect(()=>()=>request.current?.abort(),[]);
  async function submit(event:FormEvent){
    event.preventDefault();if(writing.current||blocked||full)return;
    if(!name.trim()||name.trim().length>160||!file||!file.size||file.size>MAX_PARTICIPANT_FILE_BYTES||
      (!PARTICIPANT_FILE_TYPES.includes(file.type)&&(file.type||!/\.(pdf|jpe?g|png|webp)$/i.test(file.name)))){
      setMessage("Escribe un nombre y selecciona un PDF, JPG, PNG o WebP de hasta 10 MB.");return;
    }
    writing.current=true;setPending(true);setMessage("Cargando archivo…");
    const controller=new AbortController();request.current=controller;
    try{await uploadParticipantFile(scope,name,file,controller.signal);if(!controller.signal.aborted)onSaved();}
    catch(error){if(!controller.signal.aborted){setBlocked(!(error instanceof ParticipantFileError)||error.status===0||error.status>=500);
      setMessage(participantFileError(error));}}
    finally{writing.current=false;if(!controller.signal.aborted)setPending(false);}
  }
  return <form aria-label="Cargar archivo" onSubmit={submit} noValidate className="space-y-4 rounded-2xl border border-border bg-muted/25 p-4">
    <h3 className="font-semibold">Cargar archivo</h3>
    <p className="text-sm text-muted-foreground">El nombre será visible para la persona. PDF, JPG, PNG o WebP; máximo 10 MB y 10 archivos por persona en este programa.</p>
    {full?<p role="status" className="text-sm">Se alcanzó el límite de 10 archivos. Elimina uno para cargar otro.</p>:<>
      <label className="block text-sm font-medium">Nombre del archivo<input className="rti-field" required maxLength={160} value={name}
        disabled={pending||blocked} onChange={e=>setName(e.target.value)}/></label>
      <label className="block text-sm font-medium">Archivo<input className="rti-field" type="file" required accept={PARTICIPANT_FILE_TYPES.join(",")}
        disabled={pending||blocked} onChange={e=>setFile(e.target.files?.[0])}/></label>
      {message&&<p role="status" className="text-sm">{message}</p>}
      <button className="rti-button-primary gap-2" disabled={pending||blocked}><Upload aria-hidden="true" className="size-4"/>{pending?"Cargando…":"Cargar archivo"}</button>
      {blocked&&<p className="text-sm">No se pudo confirmar el resultado. Pulsa Actualizar archivos antes de repetir la carga.</p>}
    </>}
  </form>;
}
function FileRow({scope,file,canManage,onDeleted}:{scope:FileScope;file:ParticipantFile;canManage:boolean;onDeleted:()=>void}){
  const [confirming,setConfirming]=useState(false);const [pending,setPending]=useState(false);const [message,setMessage]=useState("");
  const [preview,setPreview]=useState<string>();const previewUrl=useRef<string|undefined>(undefined);
  const request=useRef<AbortController|null>(null);const writing=useRef(false);
  useEffect(()=>()=>{request.current?.abort();if(previewUrl.current)URL.revokeObjectURL(previewUrl.current);},[]);
  async function open(download:boolean){
    if(writing.current)return;writing.current=true;setPending(true);setMessage("");
    const controller=new AbortController();request.current=controller;
    try{
      const blob=await fetchParticipantFile(scope,file.id,controller.signal,download);if(controller.signal.aborted)return;
      const url=URL.createObjectURL(blob);
      if(download){const link=document.createElement("a");link.href=url;link.download=participantFileName(file);document.body.append(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),30000);}
      else{if(previewUrl.current)URL.revokeObjectURL(previewUrl.current);previewUrl.current=url;setPreview(url);}
    }catch(error){if(!controller.signal.aborted)setMessage(participantFileError(error));}
    finally{writing.current=false;if(!controller.signal.aborted)setPending(false);}
  }
  function closePreview(){if(previewUrl.current)URL.revokeObjectURL(previewUrl.current);previewUrl.current=undefined;setPreview(undefined);}
  async function remove(){
    if(writing.current)return;writing.current=true;setPending(true);setMessage("");
    const controller=new AbortController();request.current=controller;
    try{await deleteParticipantFile(scope,file.id,controller.signal);if(!controller.signal.aborted)onDeleted();}
    catch(error){if(!controller.signal.aborted){setConfirming(false);setMessage(participantFileError(error));}}
    finally{writing.current=false;if(!controller.signal.aborted)setPending(false);}
  }
  const sizeLabel=file.sizeBytes<1024 ? `${file.sizeBytes} B`
    :file.sizeBytes<1024*1024 ? `${(file.sizeBytes/1024).toLocaleString("es-CO",{maximumFractionDigits:1})} KB`
    :`${(file.sizeBytes/1024/1024).toLocaleString("es-CO",{maximumFractionDigits:2})} MB`;
  return <article className="min-w-0 space-y-3 rounded-2xl border border-border bg-background p-4">
    <div className="flex items-start gap-3"><FileText aria-hidden="true" className="mt-1 size-5 shrink-0 text-muted-foreground"/>
      <div className="min-w-0"><h3 className="break-words font-semibold">{file.title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{file.contentType==="application/pdf"?"PDF":"Imagen"} · {sizeLabel} · {new Date(file.createdAt).toLocaleDateString("es-CO")}</p></div></div>
    <div className="flex flex-wrap gap-2"><button type="button" className="rti-button-secondary gap-2" disabled={pending} onClick={()=>void open(false)} aria-label={`Ver ${file.title}`}><Eye aria-hidden="true" className="size-4"/>Ver archivo</button>
      <button type="button" className="rti-button-secondary gap-2" disabled={pending} onClick={()=>void open(true)} aria-label={`Descargar ${file.title}`}><Download aria-hidden="true" className="size-4"/>Descargar</button>
      {canManage&&<button type="button" className="rti-button-secondary gap-2" disabled={pending} onClick={()=>setConfirming(true)} aria-label={`Eliminar ${file.title}`}><Trash2 aria-hidden="true" className="size-4"/>Eliminar</button>}
    </div>
    {pending&&<p role="status" className="text-sm">Procesando archivo…</p>}
    {message&&<p role="status" className="text-sm">{message}</p>}
    {confirming&&<div className="rounded-xl border border-border bg-muted/40 p-3"><p className="text-sm">¿Eliminar «{file.title}»? Dejará de estar disponible para esta persona en este programa. Esta acción no se puede deshacer.</p>
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="rti-button-primary" disabled={pending} onClick={()=>void remove()}>Confirmar eliminación</button>
        <button type="button" className="rti-button-secondary" disabled={pending} onClick={()=>setConfirming(false)}>Cancelar</button></div></div>}
    {preview&&<div className="rounded-xl border border-border bg-muted/30 p-3">
      {file.contentType==="application/pdf"?<a href={preview} target="_blank" rel="noopener noreferrer" className="rti-button-secondary">Abrir PDF en otra pestaña</a>
        :<a href={preview} target="_blank" rel="noopener noreferrer"><img src={preview} alt={file.title} className="max-h-96 max-w-full rounded-lg object-contain"/></a>}
      <button type="button" className="rti-button-secondary mt-3 gap-2" onClick={closePreview}><X aria-hidden="true" className="size-4"/>Cerrar vista previa</button>
    </div>}
  </article>;
}
