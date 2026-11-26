"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {Upload} from "lucide-react";
import {ParticipantFileEntry} from "@/components/participation/participant-files";
import {listParticipantFiles,MAX_PARTICIPANT_FILE_BYTES,participantFileError,type ParticipantFileList} from "@/lib/participation/participant-files-api";
import {uploadDiscPdf,DiscRequestError} from "@/lib/participation/disc-api";
type DiscPdfProps={organizationId?:string;programId:string;enrollmentId?:string;canEdit:boolean;personal?:boolean};
export function DiscPdfVersions(props:DiscPdfProps){
  return <DiscPdfContent key={props.personal?"own/"+props.programId:props.organizationId+"/"+props.programId+"/"+props.enrollmentId} {...props}/>;
}
function DiscPdfContent({organizationId,programId,enrollmentId,canEdit,personal=false}:DiscPdfProps){
  const [attempt,setAttempt]=useState(0),[result,setResult]=useState<ParticipantFileList>();
  const [file,setFile]=useState<File>(),[pending,setPending]=useState(false),[blocked,setBlocked]=useState(false);
  const [message,setMessage]=useState("Cargando versiones del PDF…"),[notice,setNotice]=useState("");
  const request=useRef<AbortController|null>(null),writing=useRef(false),input=useRef<HTMLInputElement>(null);
  useEffect(()=>()=>request.current?.abort(),[]);
  useEffect(()=>{
    const controller=new AbortController();
    listParticipantFiles(personal?{programId}:{organizationId,programId,enrollmentId},controller.signal).then(data=>{if(!controller.signal.aborted){setResult(data);setMessage("");}})
      .catch(error=>{if(!controller.signal.aborted)setMessage(participantFileError(error));});
    return()=>controller.abort();
  },[organizationId,programId,enrollmentId,personal,attempt]);
  function refresh(text=""){setResult(undefined);setMessage("Cargando versiones del PDF…");setNotice(text);setBlocked(false);setAttempt(v=>v+1);}
  async function submit(event:FormEvent){
    event.preventDefault();if(writing.current||blocked||personal||!organizationId||!enrollmentId||!canEdit||!result?.canManage)return;
    if(result.items.length>=result.maxFiles){setMessage("Se alcanzó el límite de 10 archivos.");return;}
    if(!file||!file.size||file.size>MAX_PARTICIPANT_FILE_BYTES||(file.type && file.type!=="application/pdf")||(!file.type&&!/\.pdf$/i.test(file.name))){
      setMessage("Selecciona un PDF de hasta 10 MB.");return;
    }
    writing.current=true;setPending(true);setMessage("Subiendo nueva versión del PDF DISC…");
    const controller=new AbortController();request.current=controller;
    try{const saved=await uploadDiscPdf(organizationId,programId,enrollmentId,file,controller.signal);
      if(!controller.signal.aborted){setFile(undefined);if(input.current)input.current.value="";refresh(`PDF DISC versión ${saved.documentVersion} cargado. Ya está disponible en Archivos.`);}
    }catch(error){if(!controller.signal.aborted){
      const failure=error instanceof DiscRequestError?error:undefined;
      setBlocked(!failure||failure.status===0||failure.status>=500);
      setMessage(failure?.code==="FILE_LIMIT_REACHED"?"Se alcanzó el límite de 10 archivos de esta persona en el programa. Elimina uno en Archivos para cargar una nueva versión."
        :failure?.status===400||failure?.status===413?"Selecciona un PDF válido de hasta 10 MB.":failure?.status===403?"No tienes permiso para cargar PDF DISC.":failure?.status===409?"Actualiza la ficha: el programa o los archivos cambiaron.":"No se pudo confirmar la carga. Actualiza las versiones antes de reintentar.");
    }}finally{writing.current=false;if(!controller.signal.aborted)setPending(false);}
  }
  const versions=result?.items.filter(f=>f.documentType==="DISC").sort((a,b)=>(b.documentVersion??0)-(a.documentVersion??0))??[];
  return <section aria-label="PDF DISC y versiones" className="mt-6 space-y-4 border-t border-border pt-6">
    <h3 className="text-xl font-semibold">PDF DISC y versiones</h3>
    <p className="text-sm leading-6 text-muted-foreground">{personal?"Consulta y descarga las versiones de tu PDF DISC de este programa. También las encontrarás en Archivos.":"Cada carga guarda una nueva versión con el nombre DISC en los Archivos de esta persona y este programa. Los PDF anteriores se conservan."}</p>
    {notice&&<p role="status" className="rounded-xl bg-accent p-3 text-sm">{notice}</p>}
    {result&&!personal&&canEdit&&result.canManage&&<form aria-label="Cargar PDF DISC" noValidate onSubmit={submit} className="space-y-3 rounded-xl border border-border p-4">
      <label className="block text-sm font-medium">Nuevo PDF DISC<input ref={input} type="file" className="rti-field" accept="application/pdf" disabled={pending||blocked||result.items.length>=result.maxFiles}
        onChange={event=>setFile(event.target.files?.[0])}/></label>
      <p className="text-xs text-muted-foreground">Hasta 10 MB. Cada versión cuenta dentro del límite de {result.maxFiles} archivos por persona/programa ({result.items.length} usados).</p>
      <button className="rti-button-primary gap-2" disabled={pending||blocked||result.items.length>=result.maxFiles}><Upload aria-hidden="true" className="size-4"/>{pending?"Subiendo…":"Cargar nueva versión"}</button>
      {result.items.length>=result.maxFiles&&<p className="text-sm">Se alcanzó el límite. Elimina un archivo para liberar un cupo.</p>}
    </form>}
    {message&&<p role="status" className="text-sm">{message}</p>}
    {result&&(!versions.length?<p className="rounded-xl bg-muted/40 p-4 text-sm">Todavía no hay PDF DISC cargados.</p>
      :<ul className="space-y-3">{versions.map(file=><li key={file.id}><ParticipantFileEntry file={file}
        scope={personal?{programId}:{organizationId,programId,enrollmentId}} canManage={!personal&&canEdit&&result.canManage} onDeleted={()=>refresh("Versión eliminada. Las demás versiones se conservan.")}/></li>)}</ul>)}
    <button type="button" className="rti-button-secondary" disabled={pending} onClick={()=>refresh()}>Actualizar versiones</button>
  </section>;
}
