"use client";
import Link from "next/link";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {fetchCurrentIdentity,IdentityRequestError} from "@/lib/auth/authenticated-api";
import {listProgramDiscProfiles,saveProgramDiscProfile,discErrorMessage,DiscRequestError,type ProgramDiscParticipant,type DiscProfileInput} from "@/lib/participation/disc-api";
import {useProgramState} from "./program-state-context";
import {DiscRadar,DISC_FIELDS,type DiscValues} from "./disc-radar";
import {DiscPdfVersions} from "./disc-pdf-versions";

export function ProgramDiscArea(props:{organizationId:string;programId:string}){
  return <DiscArea key={props.organizationId+"/"+props.programId} {...props}/>;
}
function DiscArea({organizationId,programId}:{organizationId:string;programId:string}){
  const canEditProgram=useProgramState()?.canEdit??true;
  const [items,setItems]=useState<ProgramDiscParticipant[]>([]),[selectedId,setSelectedId]=useState<string>();
  const [message,setMessage]=useState("Consultando fichas DISC…"),[loading,setLoading]=useState(true),[notice,setNotice]=useState("");
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    async function load(){try{
      const identity=await fetchCurrentIdentity(organizationId,controller.signal);if(controller.signal.aborted)return;
      if(identity.activeOrganizationId!==organizationId||!identity.roles.some(r=>["CONSULTANT","LEADER","COMPANY_ADMIN"].includes(r))){
        setMessage("Solo consultores, líderes y RRHH autorizados del programa pueden consultar las fichas DISC.");return;
      }
      const response=await listProgramDiscProfiles(organizationId,programId,controller.signal);
      if(!controller.signal.aborted){setItems(response.items);setMessage(response.items.length?"":identity.roles.includes("CONSULTANT")?"No hay colaboradores registrados disponibles en este programa.":"No hay colaboradores activos o completados disponibles en este programa.");}
    }catch(error){if(!controller.signal.aborted)setMessage(discErrorMessage(error instanceof IdentityRequestError?new DiscRequestError(error.status):error));}
      finally{if(!controller.signal.aborted)setLoading(false);}}
    void load();return()=>controller.abort();
  },[organizationId,programId,attempt]);
  const complete=(item:ProgramDiscParticipant)=>!!item.profile&&!item.profile.needsUpdate;
  const pending=items.filter(i=>!complete(i)),selected=items.find(i=>i.enrollmentId===selectedId);
  const canEdit=!!selected?.canEdit&&canEditProgram;
  const canEditAny=canEditProgram&&items.some(i=>i.canEdit);
  function saved(value:ProgramDiscParticipant){setItems(current=>current.map(p=>p.enrollmentId===value.enrollmentId?value:p));setNotice(`Ficha DISC de ${name(value)} guardada.`);}
  function refresh(){setItems([]);setSelectedId(undefined);setLoading(true);setNotice("");setMessage("Consultando fichas DISC…");setAttempt(v=>v+1);}
  return <main className="rti-surface min-w-0 p-6 sm:p-9">
    <p className="rti-kicker">Conocimiento del equipo</p><h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Ficha DISC</h1>
    <p className="mt-3 max-w-3xl text-muted-foreground">Consulta los porcentajes de Dominante, Influyente, Sereno y Concienzudo. Cada rasgo va de 0 a 100 y se representa en un eje del radar.</p>
    {notice&&<p role="status" className="mt-5 rounded-xl bg-accent p-3 text-sm">{notice}</p>}
    {message&&<p role="status" className="mt-5 rounded-xl bg-muted p-3 text-sm">{message}</p>}
    {!loading&&items.length>0&&<>
      <section aria-label="Estado de fichas DISC" className="mt-6 grid gap-3 sm:grid-cols-3">
        {[["Colaboradores",items.length],["Fichas completas",items.length-pending.length],["Pendientes",pending.length]].map(([label,value])=><div key={label} className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>)}
      </section>
      {canEditAny&&<p className="mt-4 text-sm text-muted-foreground">Puedes preparar el DISC de los colaboradores registrados, incluso antes de enviar o aceptar su invitación.</p>}
      {canEditAny&&pending.length>0&&<button type="button" className="rti-button-primary mt-5" onClick={()=>setSelectedId(pending[0].enrollmentId)}>Completar pendientes ({pending.length})</button>}
      {selected&&<section key={selected.enrollmentId} aria-label={`Detalle DISC de ${name(selected)}`} className="mt-6 min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="break-words text-xl font-semibold">{name(selected)}</h2><p className="break-all text-sm text-muted-foreground">{selected.email}</p></div>
          <button type="button" className="rti-button-secondary" onClick={()=>setSelectedId(undefined)}>Cerrar ficha</button></div>
        {selected.enrollmentStatus==="INVITED"&&<p className="mt-4 rounded-xl bg-muted p-3 text-sm">Invitación pendiente de aceptación. La ficha y los PDF quedan guardados; el colaborador podrá consultarlos al aceptar la invitación y completar su perfil.</p>}
        {selected.profile?.needsUpdate&&<p className="mt-4 rounded-xl bg-muted p-3 text-sm">Esta ficha fue registrada como texto. Está pendiente ingresar sus cuatro porcentajes; no se han calculado valores automáticamente.</p>}
        {canEdit?<DiscForm key={selected.profile?.version??"new"} organizationId={organizationId} programId={programId} participant={selected} onSaved={saved}/>
          :<div className="mx-auto mt-5 max-w-xl"><DiscRadar values={values(selected)}/></div>}
        <DiscPdfVersions organizationId={organizationId} programId={programId} enrollmentId={selected.enrollmentId} canEdit={canEdit}/>
      </section>}
      <section className="mt-7" aria-label="Integrantes del programa"><h2 className="text-xl font-semibold">Integrantes del programa</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">{items.map(item=><article key={item.enrollmentId} className="min-w-0 rounded-2xl border border-border p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 className="break-words font-semibold">{name(item)}</h3><p className="break-all text-sm text-muted-foreground">{item.email}</p></div>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">{complete(item)?"Completa":item.profile?"Actualizar":"Pendiente"}</span></div>
          <p className="mt-2 text-sm text-muted-foreground">{item.enrollmentStatus==="INVITED"?"Invitación pendiente de aceptación":item.enrollmentStatus==="COMPLETED"?"Inscripción completada":"Inscripción activa"}</p>
          {complete(item)&&<dl className="mt-3 grid grid-cols-4 gap-2 text-center text-sm">{DISC_FIELDS.map(f=><div key={f.key}><dt className="font-semibold">{f.code}</dt><dd>{item.profile![f.key]}%</dd></div>)}</dl>}
          <button type="button" className="rti-button-secondary mt-4" onClick={()=>setSelectedId(item.enrollmentId)} aria-label={`${item.canEdit&&canEditProgram?(complete(item)?"Editar ficha":"Completar ficha"):"Consultar ficha"} de ${name(item)}`}>
            {item.canEdit&&canEditProgram?(complete(item)?"Editar ficha":"Completar ficha"):"Consultar ficha"}
          </button>
        </article>)}</div>
      </section>
    </>}
    <button type="button" className="rti-button-secondary mt-5" disabled={loading} onClick={refresh}>Actualizar fichas</button>
    <nav aria-label="Navegación DISC" className="mt-8 flex flex-wrap gap-4 border-t border-border pt-6 text-sm">
      <Link href={`/organizations/${encodeURIComponent(organizationId)}/programs/${encodeURIComponent(programId)}`} className="rti-link">Volver al programa</Link>
      <Link href="/account" className="rti-link">Volver a Cuenta</Link>
    </nav>
  </main>;
}
type Draft=Record<keyof DiscValues,string>;
function DiscForm({organizationId,programId,participant,onSaved}:{organizationId:string;programId:string;participant:ProgramDiscParticipant;onSaved:(value:ProgramDiscParticipant)=>void}){
  const [draft,setDraft]=useState<Draft>(()=>Object.fromEntries(DISC_FIELDS.map(f=>[f.key,participant.profile?.[f.key]?.toString()??""])) as Draft);
  const [invalid,setInvalid]=useState<string[]>([]),[pending,setPending]=useState(false),[blocked,setBlocked]=useState(false),[message,setMessage]=useState("");
  const writing=useRef(false),request=useRef<AbortController|null>(null);
  useEffect(()=>()=>request.current?.abort(),[]);
  const valid=(value:string)=>/^\d{1,3}$/.test(value)&&Number(value)>=0&&Number(value)<=100;
  const preview=Object.fromEntries(DISC_FIELDS.map(f=>[f.key,valid(draft[f.key])?Number(draft[f.key]):null])) as DiscValues;
  async function submit(event:FormEvent){event.preventDefault();if(writing.current||blocked)return;
    const errors=DISC_FIELDS.filter(f=>!valid(draft[f.key])).map(f=>f.key);
    if(errors.length){setInvalid(errors);setMessage("Ingresa los cuatro porcentajes como números enteros entre 0 y 100.");document.getElementById("disc-"+errors[0])?.focus();return;}
    const input={...preview,version:participant.profile?.version??null} as DiscProfileInput;
    writing.current=true;setPending(true);setMessage("Guardando ficha DISC…");const controller=new AbortController();request.current=controller;
    try{const saved=await saveProgramDiscProfile(organizationId,programId,participant.enrollmentId,input,controller.signal);
      if(!controller.signal.aborted){setMessage("Ficha DISC guardada.");onSaved(saved);}
    }catch(error){if(!controller.signal.aborted){setMessage(discErrorMessage(error));setBlocked(!(error instanceof DiscRequestError)||error.status===0||error.status>=500||[401,403,404,409].includes(error.status));}}
    finally{writing.current=false;if(!controller.signal.aborted)setPending(false);}
  }
  const positions={dominant:"col-start-1 row-start-1",influential:"col-start-2 row-start-1 lg:col-start-3",
    serene:"col-start-2 row-start-3 lg:col-start-3",conscientious:"col-start-1 row-start-3"};
  return <form aria-label={`Ficha DISC de ${name(participant)}`} noValidate onSubmit={submit} className="mt-5">
    <p className="text-sm leading-6 text-muted-foreground">Ingresa valores enteros de 0 a 100. No tienen que sumar 100. El radar se actualiza mientras completas los campos.</p>
    <div className="mt-5 grid min-w-0 grid-cols-2 items-center gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,2fr)_minmax(0,1fr)]">
      {DISC_FIELDS.map(field=><div key={field.key} className={`min-w-0 rounded-xl border border-border bg-background p-3 ${positions[field.key]}`}>
        <label htmlFor={"disc-"+field.key} className="block text-sm font-semibold"><span style={{color:field.color}}>{field.code}</span> · {field.label} (%)</label>
        <input id={"disc-"+field.key} className="rti-field mt-2" type="number" inputMode="numeric" min={0} max={100} step={1} required
          value={draft[field.key]} disabled={pending||blocked} aria-invalid={invalid.includes(field.key)||undefined}
          onChange={event=>{setDraft(v=>({...v,[field.key]:event.target.value}));setInvalid(v=>v.filter(k=>k!==field.key));}}/>
      </div>)}
      <div className="col-span-2 col-start-1 row-start-2 min-w-0 lg:col-span-1 lg:col-start-2 lg:row-span-3 lg:row-start-1"><DiscRadar values={preview}/></div>
    </div>
    {message&&<p role="status" className="mt-4 rounded-xl bg-muted p-3 text-sm">{message}</p>}
    <button className="rti-button-primary mt-5" disabled={pending||blocked}>{pending?"Guardando…":"Guardar ficha"}</button>
    {blocked&&<p className="mt-3 text-sm">Actualiza las fichas antes de volver a guardar.</p>}
  </form>;
}
function name(p:ProgramDiscParticipant){return [p.firstName,p.lastName].filter(Boolean).join(" ")||p.email;}
function values(p:ProgramDiscParticipant):DiscValues{return {dominant:p.profile?.dominant??null,influential:p.profile?.influential??null,serene:p.profile?.serene??null,conscientious:p.profile?.conscientious??null};}
