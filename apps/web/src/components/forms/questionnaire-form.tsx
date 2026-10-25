"use client";
import { useRef,useState,type FormEvent } from "react";
import { SurveyQuestionInput } from "./survey-question-input";
import type { FormQuestion } from "@/lib/forms/question-catalog";
import type { ActivitySurveyAnswerInput } from "@/lib/participation/activity-api";
export function QuestionnaireForm({title,instructions,questions,initialAnswers=[],submitLabel,onSend}:{
  title:string;instructions:string|null;questions:FormQuestion[];initialAnswers?:ActivitySurveyAnswerInput[];
  submitLabel:string;onSend:(answers:ActivitySurveyAnswerInput[])=>Promise<void>;
}){
 const [answers,setAnswers]=useState<Record<string,string[]>>(()=>Object.fromEntries(initialAnswers.map(a=>[a.questionId,a.values])));
 const [invalid,setInvalid]=useState<string[]>([]);const [pending,setPending]=useState(false);const [message,setMessage]=useState("");const writing=useRef(false);
 async function submit(event:FormEvent){event.preventDefault();if(writing.current)return;
  const missing=questions.filter(q=>!answers[q.id]?.length||answers[q.id].some(v=>!v.trim())).map(q=>q.id);
  if(missing.length){setInvalid(missing);setMessage("Responde todas las preguntas antes de enviar.");window.setTimeout(()=>document.getElementById(`survey-question-${missing[0]}`)?.focus(),0);return;}
  writing.current=true;setPending(true);setMessage("Enviando respuestas…");
  try{await onSend(questions.map(q=>({questionId:q.id,values:answers[q.id].map(v=>v.trim())})));setMessage("Respuestas enviadas.");}
  catch(error){setMessage(error instanceof Error?error.message:"No fue posible enviar. Inténtalo de nuevo.");}
  finally{writing.current=false;setPending(false);}
 }
 return <form aria-label={title} noValidate onSubmit={submit} className="mt-5 rounded-2xl border border-border bg-card p-4 sm:p-5">
  <h4 className="text-lg font-semibold">{title}</h4>{instructions&&<p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{instructions}</p>}
  <ol className="mt-5 space-y-5">{questions.map((q,index)=><li key={q.id} className="rounded-xl border border-border p-4">
   <fieldset aria-invalid={invalid.includes(q.id)||undefined} aria-describedby={invalid.includes(q.id)?`survey-error-${q.id}`:undefined}>
    <legend className="font-medium">{index+1}. {q.prompt}</legend><SurveyQuestionInput question={q} selected={answers[q.id]??[]} disabled={pending}
     onChange={values=>{setAnswers(current=>({...current,[q.id]:values}));setInvalid(current=>current.filter(id=>id!==q.id));}}/>
    {invalid.includes(q.id)&&<p id={`survey-error-${q.id}`} className="mt-2 text-sm text-destructive">Esta pregunta es obligatoria.</p>}
   </fieldset></li>)}</ol>
  {message&&<p role="status" className="mt-4 rounded-xl bg-muted p-3 text-sm">{message}</p>}
  <button className="rti-button-primary mt-5" disabled={pending||!questions.length}>{pending?"Enviando…":submitLabel}</button>
 </form>;
}
export function QuestionnaireAnswers({questions,answers}:{questions:FormQuestion[];answers:ActivitySurveyAnswerInput[]}){
 return <ol className="mt-4 space-y-3">{questions.map(q=><li key={q.id} className="rounded-xl border border-border p-3 text-sm">
  <p className="font-semibold">{q.position}. {q.prompt}</p><p className="mt-2 whitespace-pre-wrap break-words">{answers.find(a=>a.questionId===q.id)?.values.join(" · ")??"Sin respuesta"}</p>
 </li>)}</ol>;
}
