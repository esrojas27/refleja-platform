"use client";

import { useEffect,useRef,useState,type FormEvent } from "react";
import { Ban,CheckCircle2,History,Pause,RotateCcw,ShieldCheck,UserMinus } from "lucide-react";
import { changeEnrollment,getEnrollmentHistory,enrollmentActionLabels,enrollmentAdministrationMessage,enrollmentStatusLabels,
  type EnrollmentAction,type EnrollmentChange } from "@/lib/participation/enrollment-administration-api";
import { inviteeRoleLabel,type Enrollment,type InviteeRole,type PageResult } from "@/lib/participation/participation-api";
import { useProgramState } from "@/components/programs/program-state-context";
import { ProgramModal } from "@/components/programs/program-modal";

export function EnrollmentAdministration({ enrollment,onSaved }: { enrollment:Enrollment;onSaved:(saved:Enrollment)=>void }) {
  const state=useProgramState();
  const canEdit=state?.canEdit??true;
  const canComplete=state?state.program?.status==="ACTIVE"||state.program?.status==="COMPLETED":true;
  const [dialog,setDialog]=useState<EnrollmentAction|"HISTORY"|null>(null);
  const protectedAccess=enrollment.access?.roles.some(role=>role==="CONSULTANT"||role==="SUPER_ADMIN");
  const enabled=enrollment.access&&["ACTIVE","PENDING"].includes(enrollment.access.membershipStatus)&&["ACTIVE","INVITED"].includes(enrollment.access.userStatus);
  const available=enrollment.version!==undefined&&enrollment.access!==undefined&&!protectedAccess;
  const expired=enrollment.status==="INVITED"&&enrollment.invitation?.status==="EXPIRED";
  const button="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-secondary disabled:opacity-45";
  return <div className="border-t border-border/70 pt-3">
    <div className="flex flex-wrap gap-2" role="group" aria-label={`Administrar ${enrollment.participant.email}`}>
      {available&&enrollment.status==="INVITED"&&enrollment.invitation&&enrollment.invitation.status!=="ACCEPTED"&&enrollment.invitation.status!=="REVOKED"&&
        <button type="button" className={button} onClick={()=>setDialog("REVOKE")}><Ban aria-hidden="true" className="size-3.5" />Revocar invitación</button>}
      {available&&["ACTIVE","COMPLETED","SUSPENDED"].includes(enrollment.status)&&
        <button type="button" className={button} onClick={()=>setDialog("WITHDRAW")}><UserMinus aria-hidden="true" className="size-3.5" />Retirar</button>}
      {available&&["ACTIVE","COMPLETED"].includes(enrollment.status)&&
        <button type="button" className={button} onClick={()=>setDialog("SUSPEND")}><Pause aria-hidden="true" className="size-3.5" />Suspender</button>}
      {available&&enrollment.status==="ACTIVE"&&canComplete&&
        <button type="button" className={button} onClick={()=>setDialog("COMPLETE")}><CheckCircle2 aria-hidden="true" className="size-3.5" />Completar participación</button>}
      {available&&(["WITHDRAWN","SUSPENDED","COMPLETED"].includes(enrollment.status)||expired)&&canEdit&&
        <button type="button" className={button} disabled={!enabled} onClick={()=>setDialog("REINSTATE")}><RotateCcw aria-hidden="true" className="size-3.5" />{expired?"Renovar invitación":"Reincorporar"}</button>}
      {available&&canEdit&&<button type="button" className={button} disabled={!enabled} onClick={()=>setDialog("CHANGE_ROLE")}><ShieldCheck aria-hidden="true" className="size-3.5" />Cambiar rol</button>}
      <button type="button" className={button} onClick={()=>setDialog("HISTORY")}><History aria-hidden="true" className="size-3.5" />Historial</button>
    </div>
    {protectedAccess&&<p className="mt-2 text-xs text-muted-foreground">Acceso administrativo protegido: no se retira ni modifica desde esta inscripción.</p>}
    {available&&!enabled&&<p className="mt-2 text-xs text-muted-foreground">Cuenta o membresía deshabilitada: esta pantalla no puede reactivarla.</p>}
    {dialog&&<ProgramModal titleId={`enrollment-action-${enrollment.id}`} closeLabel="Cerrar administración de participante" onClose={()=>setDialog(null)}>
      {dialog==="HISTORY"?<EnrollmentHistory enrollment={enrollment} />:<ChangeForm key={dialog} action={dialog} enrollment={enrollment}
        onSaved={saved=>{setDialog(null);onSaved(saved);}} />}
    </ProgramModal>}
  </div>;
}
function ChangeForm({ action,enrollment,onSaved }: {action:EnrollmentAction;enrollment:Enrollment;onSaved:(saved:Enrollment)=>void}) {
  const [reason,setReason]=useState("");
  const [confirmed,setConfirmed]=useState(false);
  const currentRoles=enrollment.access?.roles??[];
  const [role,setRole]=useState<InviteeRole>((currentRoles.find(r=>["COLLABORATOR","LEADER","COMPANY_ADMIN"].includes(r)) as InviteeRole)??"COLLABORATOR");
  const [pending,setPending]=useState(false);
  const [blocked,setBlocked]=useState(false);
  const [invalid,setInvalid]=useState(false);
  const [message,setMessage]=useState("");
  const submitting=useRef(false); const request=useRef<AbortController|null>(null);
  useEffect(()=>()=>request.current?.abort(),[]);
  const descriptions:Record<EnrollmentAction,string>={
    REVOKE:"El enlace de invitación dejará de funcionar. Un correo ya enviado no se puede retirar. No se borra la cuenta ni se afectan otros programas.",
    WITHDRAW:"La persona dejará de acceder a este programa, incluso por enlaces directos. Sus entregas, respuestas y progreso se conservan. No se retira de otras organizaciones o programas.",
    SUSPEND:"Se pausa temporalmente el acceso a este programa. No podrá ver el contenido ni enviar actividades o encuestas. Su progreso se conserva.",
    COMPLETE:"Puede haber actividades o encuestas pendientes. La participación quedará en solo consulta, sin nuevas entregas. No se aprueban actividades ni se convierte su progreso en 100%.",
    REINSTATE:enrollment.invitation&&enrollment.invitation.status!=="ACCEPTED"
      ?"Se generará una invitación nueva de siete días. La persona deberá aceptarla para recuperar el acceso; el enlace anterior seguirá inválido."
      :enrollment.suspendedFromStatus==="COMPLETED"?"Se restaurará su participación completada en solo consulta, conservando todo su progreso."
        :"Se restablecerá la inscripción activa conservando entregas y progreso. No se asignan automáticamente actividades nuevas.",
    CHANGE_ROLE:"Este cambio afecta todos sus programas en esta organización y sus invitaciones no aceptadas. Reemplaza los roles Colaborador, Líder y RRHH por el seleccionado; no modifica sus otras organizaciones.",
  };
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(submitting.current||blocked) return;
    const clean=reason.trim();
    if(!clean||clean.length>1000||!confirmed) {setInvalid(true);setMessage("Escribe el motivo y confirma el alcance antes de continuar.");document.getElementById("participant-change-reason")?.focus();return;}
    submitting.current=true;setPending(true);setMessage("Guardando cambio…");
    const controller=new AbortController();request.current=controller;
    try {
      const saved=await changeEnrollment(enrollment.organizationId,enrollment.programId,enrollment.id,{
        version:enrollment.version!,action,reason:clean,confirmed,
        ...(action==="CHANGE_ROLE"?{role,roleVersion:enrollment.access!.version}:{})},controller.signal);
      if(!controller.signal.aborted) onSaved(saved);
    } catch(error) {if(!controller.signal.aborted) {setBlocked(true);setMessage(enrollmentAdministrationMessage(error)+" Cierra este modal y actualiza el listado.");}}
    finally {submitting.current=false;if(!controller.signal.aborted)setPending(false);}
  }
  return <form aria-label={enrollmentActionLabels[action]} onSubmit={submit} noValidate className="space-y-5">
    <div><p className="rti-kicker">Administrar participación</p><h2 id={`enrollment-action-${enrollment.id}`} className="mt-2 text-2xl font-semibold">{enrollmentActionLabels[action]}</h2>
      <p className="mt-2 break-all text-sm text-muted-foreground">{enrollment.participant.email}</p></div>
    <p className="rounded-xl border border-border bg-accent/35 p-4 text-sm leading-6">{descriptions[action]}</p>
    {action==="CHANGE_ROLE"&&<label className="block text-sm font-medium">Nuevo rol en la organización<select className="rti-field" value={role}
      disabled={pending||blocked} onChange={event=>setRole(event.target.value as InviteeRole)}>
      <option value="COLLABORATOR">Colaborador</option><option value="LEADER">Líder</option><option value="COMPANY_ADMIN">RRHH</option></select></label>}
    <div><label htmlFor="participant-change-reason" className="block text-sm font-medium">Motivo del cambio</label>
      <textarea id="participant-change-reason" className="rti-field min-h-24 resize-y" maxLength={1000} required value={reason}
        aria-invalid={invalid&&!reason.trim()||undefined} disabled={pending||blocked} onChange={event=>{setReason(event.target.value);setInvalid(false);}} />
      {invalid&&!reason.trim()&&<p className="mt-1 text-sm text-destructive">Escribe un motivo para el historial.</p>}</div>
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={confirmed} disabled={pending||blocked} onChange={event=>setConfirmed(event.target.checked)} />
      Entiendo el alcance y confirmo este cambio.</label>
    {message&&<p role="status" className="rounded-xl bg-muted/60 p-3 text-sm">{message}</p>}
    <button className="rti-button-primary" disabled={pending||blocked||(action==="CHANGE_ROLE"&&currentRoles.length===1&&currentRoles[0]===role)}>
      {pending?"Guardando…":"Confirmar cambio"}</button>
  </form>;
}
function EnrollmentHistory({enrollment}:{enrollment:Enrollment}) {
  const [page,setPage]=useState(0); const [result,setResult]=useState<PageResult<EnrollmentChange>>();
  const [message,setMessage]=useState("Consultando historial…"); const [pending,setPending]=useState(true);
  useEffect(()=>{
    const controller=new AbortController();
    getEnrollmentHistory(enrollment.organizationId,enrollment.programId,enrollment.id,page,controller.signal).then(data=>{
      if(!controller.signal.aborted){setResult(data);setMessage(data.items.length?"":"No hay cambios registrados desde que se habilitó el historial.");}
    }).catch(error=>{if(!controller.signal.aborted)setMessage(enrollmentAdministrationMessage(error));})
      .finally(()=>{if(!controller.signal.aborted)setPending(false);});
    return()=>controller.abort();
  },[enrollment.organizationId,enrollment.programId,enrollment.id,page]);
  function navigate(next:number){setResult(undefined);setPending(true);setMessage("Consultando historial…");setPage(next);}
  return <div><h2 id={`enrollment-action-${enrollment.id}`} className="text-2xl font-semibold">Historial de cambios</h2>
    <p className="mt-2 break-all text-sm text-muted-foreground">{enrollment.participant.email}</p>
    {message&&<p role="status" className="mt-4 text-sm">{message}</p>}
    {result&&<><ol className="mt-5 space-y-4">{result.items.map(entry=><li key={entry.id} className="rounded-xl border border-border p-4">
      <p className="font-semibold">{enrollmentActionLabels[entry.action]}</p>
      <p className="mt-1 text-xs text-muted-foreground">{new Date(entry.recordedAt).toLocaleString("es-CO")} · {entry.actorLabel}</p>
      {entry.action==="CHANGE_ROLE"?<p className="mt-2 text-sm">Roles de organización: {entry.previousRoles.map(role=>roleLabel(role)).join(", ")||"Sin rol"} → {entry.roles.map(role=>roleLabel(role)).join(", ")||"Sin rol"}</p>
        :<p className="mt-2 text-sm">{entry.previousStatus?enrollmentStatusLabels[entry.previousStatus]:"Sin inscripción"} → {enrollmentStatusLabels[entry.status]}</p>}
      {entry.programId!==enrollment.programId&&<p className="mt-2 text-xs text-muted-foreground">Cambio de rol originado en otro programa de la misma organización.</p>}
      <p className="mt-2 whitespace-pre-wrap break-words text-sm">{entry.reason}</p>
    </li>)}</ol><p className="mt-4 text-xs text-muted-foreground">{result.totalElements} cambios · Página {page+1} de {Math.max(1,result.totalPages)}</p></>}
    <div className="mt-4 flex gap-3"><button type="button" className="rti-button-secondary" disabled={pending||page===0} onClick={()=>navigate(page-1)}>Anterior</button>
      <button type="button" className="rti-button-secondary" disabled={pending||!result||page+1>=result.totalPages} onClick={()=>navigate(page+1)}>Siguiente</button></div>
  </div>;
}
export function roleLabel(role:string) {return ["COLLABORATOR","LEADER","COMPANY_ADMIN"].includes(role)?inviteeRoleLabel(role as InviteeRole):role==="CONSULTANT"?"Consultor":role==="SUPER_ADMIN"?"Administrador":role;}
