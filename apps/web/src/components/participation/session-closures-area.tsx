"use client";
import {useEffect,useRef,useState} from "react";
import { ProgramModal } from "@/components/programs/program-modal";
import { QuestionnaireForm,QuestionnaireAnswers } from "@/components/forms/questionnaire-form";
import { activityErrorMessage } from "@/lib/participation/activity-api";
import {listMySessionClosures,acknowledgeSessionClosure,sendSessionClosure,type SessionClosure} from "@/lib/participation/session-closure-api";
export function SessionClosuresArea({programId,readOnly}:{programId:string;readOnly:boolean}){
 const [items,setItems]=useState<SessionClosure[]>();const [message,setMessage]=useState("");const [pending,setPending]=useState(false);const acknowledging=useRef(false);
 useEffect(()=>{let controller:AbortController|undefined;
  function load(){controller?.abort();controller=new AbortController();const signal=controller.signal;
   listMySessionClosures(programId,signal).then(r=>{if(!signal.aborted){setItems(r.items);setMessage("");}}).catch(e=>{if(!signal.aborted){setItems(undefined);setMessage(activityErrorMessage(e));}});
  }load();window.addEventListener("rti:session-work-changed",load);return()=>{controller?.abort();window.removeEventListener("rti:session-work-changed",load);};
 },[programId]);
 const popup=!readOnly?items?.find(s=>s.status==="COMMENT"):undefined;
 function replace(saved:SessionClosure){setItems(current=>current?.map(s=>s.sessionId===saved.sessionId?saved:s));}
 async function acknowledge(){if(!popup||acknowledging.current)return;acknowledging.current=true;setPending(true);
  try{replace(await acknowledgeSessionClosure(programId,popup.sessionId));setMessage("");}catch(e){setMessage(activityErrorMessage(e));}finally{acknowledging.current=false;setPending(false);}
 }
 return <section className="space-y-4" aria-label="Cierre de tus sesiones"><div><h2 className="text-xl font-semibold">Cierre de sesiones</h2>
  <p className="mt-2 text-sm text-muted-foreground">Los formularios de actividades aportan el 80% de cada sesión. Su encuesta de cierre completa el 20% restante.</p></div>
  {message&&<p role="status" className="rounded-xl bg-muted p-3 text-sm">{message}</p>}
  {items?.map(s=><article key={s.sessionId} id={`session-closure-${s.sessionId}`} className="rounded-2xl border border-border p-4 sm:p-5">
   <p className="rti-kicker">{s.dimensionName}</p><h3 className="mt-2 font-semibold">{s.sessionName}</h3>
   <p className="mt-2 text-sm">{s.completionPercentage}% · {s.submittedCount}/{s.activityCount} actividades enviadas</p>
   <div role="progressbar" aria-label={`Progreso de ${s.sessionName}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.completionPercentage}
    className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{width:`${s.completionPercentage}%`}}/></div>
   {s.status==="LOCKED"&&<p className="mt-3 text-sm text-muted-foreground">Envía todas las actividades para habilitar la encuesta de cierre.</p>}
   {s.status==="COMMENT"&&<p className="mt-3 text-sm font-medium">Las actividades están enviadas. Continúa con el cierre de la sesión.</p>}
   {s.status==="PENDING"&&<p className="mt-3 text-sm font-medium">Tienes pendiente la encuesta de cierre de esta sesión.</p>}
   {!readOnly&&s.status==="PENDING"&&s.survey&&<QuestionnaireForm key={s.survey.id} title={s.survey.title} instructions={s.survey.instructions}
    questions={s.survey.questions} submitLabel="Enviar encuesta de cierre" onSend={async answers=>{try{replace(await sendSessionClosure(programId,s.sessionId,answers));}catch(e){throw new Error(activityErrorMessage(e));}}}/>}
   {s.status==="COMPLETED"&&<p className="mt-3 rounded-xl bg-accent p-3 text-sm font-semibold">Sesión completada al 100%.</p>}
   {s.status==="COMPLETED"&&s.survey&&<details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">Consultar mis respuestas de cierre</summary><QuestionnaireAnswers questions={s.survey.questions} answers={s.answers}/></details>}
  </article>)}
  {popup&&<ProgramModal titleId="session-closure-popup-title" closeLabel="Continuar al cierre de sesión" onClose={()=>void acknowledge()}>
   <div className="space-y-5 p-2 text-center"><p className="rti-kicker">Un paso más en tu recorrido</p><h2 id="session-closure-popup-title" className="text-3xl font-semibold">¡Completaste las actividades!</h2>
    <p className="text-sm text-muted-foreground">{popup.sessionName}</p><p className="whitespace-pre-wrap rounded-2xl bg-accent p-6 text-lg leading-8">{popup.closingComment}</p>
    <p className="text-sm text-muted-foreground">Responde la encuesta de cierre para completar tu sesión al 100%.</p>
    <button className="rti-button-primary" disabled={pending} onClick={()=>void acknowledge()}>{pending?"Guardando…":"Continuar a la encuesta de cierre"}</button>
    {message&&<p role="status" className="text-sm text-destructive">{message}</p>}
   </div></ProgramModal>}
 </section>;
}
