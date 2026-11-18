"use client";
import { useRef,useState,type FormEvent } from "react";
import { ActivityAnswerImage, ActivityImageInput } from "./activity-answer-image";
import { SurveyQuestionInput } from "./survey-question-input";
import { MIN_WORD_SELECTIONS, MAX_WORD_SELECTIONS, WORD_SELECTION_HELP, type FormQuestion } from "@/lib/forms/question-catalog";
import type { ActivitySurveyAnswerInput } from "@/lib/participation/activity-api";
export function QuestionnaireForm({title,instructions,questions,initialAnswers=[],submitLabel,onSend,programId}:{
  title:string;instructions:string|null;questions:FormQuestion[];initialAnswers?:ActivitySurveyAnswerInput[];
  submitLabel:string;programId?:string;onSend:(answers:ActivitySurveyAnswerInput[])=>Promise<void>;
}){
 const [answers,setAnswers]=useState<Record<string,string[]>>(()=>Object.fromEntries(initialAnswers.map(a=>[a.questionId,a.values])));
 const [images,setImages]=useState<Record<string,File | undefined>>({});
 const [invalid,setInvalid]=useState<string[]>([]);const [pending,setPending]=useState(false);const [message,setMessage]=useState("");const writing=useRef(false);
 async function submit(event:FormEvent){event.preventDefault();if(writing.current)return;
  const missing=questions.filter(q=>!images[q.id] && (!answers[q.id]?.length||answers[q.id].some(v=>!v.trim()))).map(q=>q.id);
  const outsideRange=questions.filter(q=>q.type==="MULTIPLE_CHOICE_WORDS" &&
    ((answers[q.id]?.length??0)<MIN_WORD_SELECTIONS || (answers[q.id]?.length??0)>MAX_WORD_SELECTIONS)).map(q=>q.id);
  const invalidQuestions=[...new Set([...missing,...outsideRange])];
  if(invalidQuestions.length){setInvalid(invalidQuestions);setMessage(outsideRange.length ? "Revisa las preguntas resaltadas antes de enviar." : "Responde todas las preguntas antes de enviar.");window.setTimeout(()=>document.getElementById(`survey-question-${invalidQuestions[0]}`)?.focus(),0);return;}
  const imageFiles = Object.values(images).filter((file): file is File => !!file);
  if (imageFiles.reduce((total, file) => total + file.size, 0) > 40 * 1024 * 1024) {
    setMessage("Las imágenes de una entrega pueden pesar hasta 40 MB en total.");
    return;
  }
  writing.current=true;setPending(true);setMessage(imageFiles.length ? "Subiendo imágenes y enviando respuestas…" : "Enviando respuestas…");
  try{await onSend(questions.map(q=>({questionId:q.id,values:(answers[q.id]??[]).map(v=>v.trim()),...(images[q.id] ? {image:images[q.id]} : {})})));setMessage("Respuestas enviadas.");}
  catch(error){setMessage(error instanceof Error?error.message:"No fue posible enviar. Inténtalo de nuevo.");}
  finally{writing.current=false;setPending(false);}
 }
 return <form aria-label={title} noValidate onSubmit={submit} className="mt-5 rounded-2xl border border-border bg-card p-4 sm:p-5">
  <h4 className="text-lg font-semibold">{title}</h4>{instructions&&<p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{instructions}</p>}
  <ol className="mt-5 space-y-5">{questions.map((q,index)=><li key={q.id} className="rounded-xl border border-border p-4">
   <fieldset aria-invalid={invalid.includes(q.id)||undefined} aria-describedby={invalid.includes(q.id)?`survey-error-${q.id}`:undefined}>
    <legend className="font-medium">{index+1}. {q.prompt}</legend>{q.type === "IMAGE" ? <ActivityImageInput
     id={`survey-question-${q.id}`} prompt={q.prompt} file={images[q.id]} imageId={answers[q.id]?.[0]} programId={programId} disabled={pending}
     onChange={image=>{setImages(current=>({...current,[q.id]:image}));setAnswers(current=>({...current,[q.id]:[]}));setInvalid(current=>current.filter(id=>id!==q.id));}}/>
     : <SurveyQuestionInput question={q} selected={answers[q.id]??[]} disabled={pending}
     onChange={values=>{setAnswers(current=>({...current,[q.id]:values}));setInvalid(current=>current.filter(id=>id!==q.id));}}/>}
    {invalid.includes(q.id)&&<p id={`survey-error-${q.id}`} className="mt-2 text-sm text-destructive">{q.type === "MULTIPLE_CHOICE_WORDS" ? WORD_SELECTION_HELP : "Esta pregunta es obligatoria."}</p>}
   </fieldset></li>)}</ol>
  {message&&<p role="status" className="mt-4 rounded-xl bg-muted p-3 text-sm">{message}</p>}
  <button className="rti-button-primary mt-5" disabled={pending||!questions.length}>{pending?"Enviando…":submitLabel}</button>
 </form>;
}
export function QuestionnaireAnswers({questions,answers,programId}:{questions:FormQuestion[];answers:ActivitySurveyAnswerInput[];programId?:string}){
 return <ol className="mt-4 space-y-3">{questions.map(q=>{
  const values = answers.find(a=>a.questionId===q.id)?.values;
  return <li key={q.id} className="rounded-xl border border-border p-3 text-sm">
  <p className="font-semibold">{q.position}. {q.prompt}</p>
  {q.type === "IMAGE" && values?.[0] && programId
    ? <ActivityAnswerImage key={values[0]} programId={programId} imageId={values[0]} />
    : <p className="mt-2 whitespace-pre-wrap break-words">{q.type !== "IMAGE" && values?.join(" · ") || "Sin respuesta"}</p>}
 </li>;})}</ol>;
}
