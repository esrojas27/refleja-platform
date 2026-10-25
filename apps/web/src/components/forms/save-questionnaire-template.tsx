"use client";

import { useEffect,useId,useRef,useState,type FormEvent } from "react";
import { BookmarkPlus } from "lucide-react";
import { ProgramModal } from "@/components/programs/program-modal";
import { createQuestionnaireTemplate,questionnaireTemplateError,QuestionnaireTemplateError } from "@/lib/forms/questionnaire-template-api";
import type { ActivityEvaluation } from "@/lib/participation/evaluation-api";

export function SaveQuestionnaireTemplate({organizationId,programId,evaluation}:{organizationId:string;programId:string;evaluation:ActivityEvaluation}){
  const [open,setOpen]=useState(false);const [message,setMessage]=useState("");const id=useId();
  return <div className="mt-3"><button type="button" className="rti-button-secondary gap-2" onClick={()=>{setMessage("");setOpen(true);}}>
    <BookmarkPlus aria-hidden="true" className="size-4"/>Guardar como plantilla</button>
    {message&&<p role="status" className="mt-2 text-sm">{message}</p>}
    {open&&<SaveForm key={evaluation.id} organizationId={organizationId} programId={programId} evaluation={evaluation} titleId={id}
      onClose={()=>setOpen(false)} onSaved={()=>{setOpen(false);setMessage("Plantilla global creada. Ya puedes usarla en actividades y cierres de sesión.");}}/>}
  </div>;
}
function SaveForm({organizationId,programId,evaluation,titleId,onClose,onSaved}:{organizationId:string;programId:string;evaluation:ActivityEvaluation;titleId:string;onClose:()=>void;onSaved:()=>void}){
  const [name,setName]=useState(evaluation.title);const [description,setDescription]=useState("");const [message,setMessage]=useState("");
  const [pending,setPending]=useState(false);const [invalid,setInvalid]=useState(false);const [blocked,setBlocked]=useState(false);
  const request=useRef<AbortController|null>(null);const writing=useRef(false);
  useEffect(()=>()=>request.current?.abort(),[]);
  async function submit(event:FormEvent){
    event.preventDefault();if(writing.current||blocked)return;
    if(!name.trim()||name.trim().length>255){setInvalid(true);setMessage("Escribe un nombre para la plantilla.");document.getElementById(`${titleId}-name`)?.focus();return;}
    writing.current=true;setPending(true);setMessage("Guardando plantilla…");const controller=new AbortController();request.current=controller;
    try{await createQuestionnaireTemplate(organizationId,{sourceProgramId:programId,sourceEvaluationId:evaluation.id,name,description},controller.signal);if(!controller.signal.aborted)onSaved();}
    catch(error){if(!controller.signal.aborted){setMessage(questionnaireTemplateError(error));setInvalid(error instanceof QuestionnaireTemplateError&&(error.fields.includes("name")||error.code==="QUESTIONNAIRE_TEMPLATE_NAME_EXISTS"));
      setBlocked(!(error instanceof QuestionnaireTemplateError)||error.status===0||error.status>=500||[401,403,404].includes(error.status));}}
    finally{writing.current=false;if(!controller.signal.aborted)setPending(false);}
  }
  return <ProgramModal titleId={titleId} closeLabel="Cerrar creación de plantilla" onClose={()=>{if(!pending)onClose();}}>
    <form aria-label="Guardar plantilla de formulario" onSubmit={submit} noValidate className="space-y-5">
      <div><p className="rti-kicker">Reutilizar preguntas</p><h2 id={titleId} className="mt-2 text-2xl font-semibold">Guardar plantilla global</h2></div>
      <p className="text-sm text-muted-foreground">Se copiarán las preguntas, sus tipos, opciones y orden, junto con el título e indicaciones guardados. No se copiarán respuestas, personas ni progreso.</p>
      <p className="rounded-xl bg-accent p-3 text-sm">Estará disponible para consultores de todas las organizaciones. Revisa que las preguntas e indicaciones no incluyan datos personales o confidenciales.</p>
      <div><label className="text-sm font-medium" htmlFor={`${titleId}-name`}>Nombre de la plantilla</label><input id={`${titleId}-name`} className="rti-field mt-2" value={name} maxLength={255}
        aria-invalid={invalid||undefined} aria-describedby={invalid?`${titleId}-message`:undefined} disabled={pending||blocked} onChange={event=>{setName(event.target.value);setInvalid(false);}}/></div>
      <div><label className="text-sm font-medium" htmlFor={`${titleId}-description`}>Descripción opcional</label><textarea id={`${titleId}-description`} className="rti-field mt-2 min-h-20" maxLength={2000}
        value={description} disabled={pending||blocked} onChange={event=>setDescription(event.target.value)}/></div>
      <details className="rounded-xl border border-border p-3"><summary className="cursor-pointer text-sm font-semibold">Revisar preguntas ({evaluation.questions.length})</summary>
        <ol className="mt-3 space-y-2">{[...evaluation.questions].sort((a,b)=>a.position-b.position).map(q=><li key={q.id} className="text-sm"><p>{q.position}. {q.prompt}</p>
          {!!q.options?.length&&<p className="mt-1 break-words text-xs text-muted-foreground">{q.options.join(" · ")}</p>}</li>)}</ol>
      </details>
      {message&&<p id={`${titleId}-message`} role="status" className="rounded-xl bg-muted p-3 text-sm">{message}</p>}
      <button type="submit" className="rti-button-primary" disabled={pending||blocked}>{pending?"Guardando…":"Crear plantilla global"}</button>
    </form>
  </ProgramModal>;
}
