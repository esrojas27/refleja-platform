"use client";

import { useEffect,useRef,useState } from "react";
import { LayoutTemplate,X } from "lucide-react";
import { QUESTION_TYPE_LABELS } from "@/lib/forms/question-catalog";
import { getQuestionnaireTemplate,listQuestionnaireTemplates,questionnaireTemplateError,
  type QuestionnaireTemplate,type QuestionnaireTemplatePage } from "@/lib/forms/questionnaire-template-api";
import type { EvaluationInput } from "@/lib/participation/evaluation-api";

export function QuestionnaireTemplatePicker({organizationId,disabled,onSelect}:{organizationId:string;disabled:boolean;onSelect:(definition:EvaluationInput)=>void}){
  const [open,setOpen]=useState(false);
  return <div>
    <button type="button" className="rti-button-secondary gap-2" disabled={disabled} aria-expanded={open} onClick={()=>setOpen(current=>!current)}>
      <LayoutTemplate aria-hidden="true" className="size-4"/>Usar plantilla</button>
    {open&&<TemplateCatalog key={organizationId} organizationId={organizationId} onClose={()=>setOpen(false)}
      onSelect={definition=>{onSelect(definition);setOpen(false);}}/>}
  </div>;
}
function TemplateCatalog({organizationId,onSelect,onClose}:{organizationId:string;onSelect:(definition:EvaluationInput)=>void;onClose:()=>void}){
  const [page,setPage]=useState(0);const [attempt,setAttempt]=useState(0);
  const [result,setResult]=useState<QuestionnaireTemplatePage>();const [selected,setSelected]=useState<QuestionnaireTemplate>();
  const [message,setMessage]=useState("Cargando plantillas…");const [loading,setLoading]=useState(false);
  const detailRequest=useRef<AbortController|null>(null);
  useEffect(()=>{
    const controller=new AbortController();
    listQuestionnaireTemplates(organizationId,page,controller.signal).then(data=>{if(!controller.signal.aborted){setResult(data);setMessage(data.items.length?"":"Aún no hay plantillas. Guarda una desde un formulario ya creado.");}})
      .catch(error=>{if(!controller.signal.aborted)setMessage(questionnaireTemplateError(error));});
    return()=>controller.abort();
  },[organizationId,page,attempt]);
  useEffect(()=>()=>detailRequest.current?.abort(),[]);
  async function preview(id:string){
    detailRequest.current?.abort();const controller=new AbortController();detailRequest.current=controller;setLoading(true);setMessage("");setSelected(undefined);
    try{const data=await getQuestionnaireTemplate(organizationId,id,controller.signal);if(!controller.signal.aborted)setSelected(data);}
    catch(error){if(!controller.signal.aborted)setMessage(questionnaireTemplateError(error));}
    finally{if(!controller.signal.aborted)setLoading(false);}
  }
  function navigate(next:number){detailRequest.current?.abort();setLoading(false);setSelected(undefined);setResult(undefined);setMessage("Cargando plantillas…");setPage(next);}
  return <section aria-label="Plantillas de formularios" className="mt-4 space-y-4 rounded-2xl border border-border bg-muted/30 p-4">
    <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">Plantillas globales de formularios</h3>
      <p className="mt-2 text-sm text-muted-foreground">Úsalas en actividades o cierres de sesión. Solo disponibles para consultores.</p></div>
      <button type="button" aria-label="Cerrar plantillas" className="rounded-lg border border-border p-2" onClick={onClose}><X aria-hidden="true" className="size-4"/></button></div>
    {message&&<p role="status" className="text-sm">{message}</p>}
    {loading&&<p role="status" className="text-sm">Consultando plantilla…</p>}
    {result&&<><ul className="space-y-2">{result.items.map(item=><li key={item.id} className="rounded-xl border border-border bg-card p-3">
      <p className="break-words font-medium">{item.name}</p>{item.description&&<p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.description}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{item.questionCount} {item.questionCount===1?"pregunta":"preguntas"}</span>
        <button type="button" className="rti-button-secondary text-sm" disabled={loading} aria-label={`Ver plantilla ${item.name}`} onClick={()=>void preview(item.id)}>Ver plantilla</button></div>
    </li>)}</ul>
    {result.totalPages>1&&<div className="flex flex-wrap items-center gap-3"><button type="button" className="rti-button-secondary" disabled={page===0||loading} onClick={()=>navigate(page-1)}>Anterior</button>
      <span className="text-xs">Página {page+1} de {result.totalPages}</span><button type="button" className="rti-button-secondary" disabled={page+1>=result.totalPages||loading} onClick={()=>navigate(page+1)}>Siguiente</button></div>}</>}
    {!result&&message&&!loading&&<button type="button" className="rti-button-secondary" onClick={()=>{setMessage("Cargando plantillas…");setAttempt(n=>n+1);}}>Actualizar plantillas</button>}
    {selected&&<div className="space-y-3 rounded-xl border border-primary/20 bg-card p-4"><p className="rti-kicker">Vista previa</p><h4 className="font-semibold">{selected.summary.name}</h4>
      <p className="text-sm">Título: {selected.definition.title}</p>{selected.definition.instructions&&<p className="whitespace-pre-wrap text-sm text-muted-foreground">{selected.definition.instructions}</p>}
      <ol className="max-h-72 space-y-3 overflow-y-auto pr-1">{selected.definition.questions.map(q=><li key={q.position} className="text-sm">
        <p className="font-medium">{q.position}. {q.prompt}</p><p className="mt-1 text-xs text-muted-foreground">{QUESTION_TYPE_LABELS[q.type]}</p>
        {!!q.options?.length&&<p className="mt-1 break-words text-xs text-muted-foreground">{q.options.join(" · ")}</p>}
      </li>)}</ol>
      <p className="rounded-xl bg-accent p-3 text-sm">Se reemplazarán el título, las indicaciones y las preguntas de este borrador. Podrás adaptarlos; no se guardarán hasta confirmar el formulario.</p>
      <button type="button" className="rti-button-primary" onClick={()=>onSelect(selected.definition)}>Usar esta plantilla</button>
    </div>}
  </section>;
}
