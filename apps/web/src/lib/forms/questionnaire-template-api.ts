import { fetchAuthSession } from "aws-amplify/auth";
import type { EvaluationInput } from "@/lib/participation/evaluation-api";

export type QuestionnaireTemplateSummary = { id:string;name:string;description:string|null;questionCount:number;createdAt:string };
export type QuestionnaireTemplate = { summary:QuestionnaireTemplateSummary;definition:EvaluationInput };
export type QuestionnaireTemplatePage = { items:QuestionnaireTemplateSummary[];page:number;size:number;totalElements:number;totalPages:number };
export class QuestionnaireTemplateError extends Error {
  constructor(public readonly status:number,public readonly fields:string[]=[],public readonly code?:string,public readonly requestId?:string){
    super("Questionnaire template request failed");this.name="QuestionnaireTemplateError";
  }
}
const base=(org:string)=>`/organizations/${encodeURIComponent(org)}/questionnaire-templates`;
async function request<T>(path:string,method:"GET"|"POST",expected:number,body?:unknown,signal?:AbortSignal):Promise<T>{
  signal?.throwIfAborted();const session=await fetchAuthSession();signal?.throwIfAborted();
  if(!session.tokens?.accessToken)throw new QuestionnaireTemplateError(401);
  const api=process.env.NEXT_PUBLIC_API_BASE_URL;if(!api)throw new QuestionnaireTemplateError(0);
  const response=await fetch(`${api.replace(/\/$/,"")}/api/v1${path}`,{method,signal,cache:"no-store",
    headers:{Authorization:`Bearer ${session.tokens.accessToken.toString()}`,...(body?{"Content-Type":"application/json"}:{})},
    body:body?JSON.stringify(body):undefined});
  if(response.status!==expected){
    const data=await response.json().catch(()=>null);
    const fields=data?.code==="VALIDATION_ERROR"&&Array.isArray(data.errors)?data.errors.map((e:{field?:unknown})=>e?.field)
      .filter((f:unknown):f is string=>typeof f==="string"&&["name","description","sourceProgramId","sourceEvaluationId","page"].includes(f)):[];
    const code=data?.code==="QUESTIONNAIRE_TEMPLATE_NAME_EXISTS"?data.code:undefined;
    const requestId=typeof data?.requestId==="string"&&/^[a-f0-9-]{36}$/i.test(data.requestId)?data.requestId:undefined;
    throw new QuestionnaireTemplateError(response.status,fields,code,requestId);
  }
  return response.json() as Promise<T>;
}
export const listQuestionnaireTemplates=(org:string,page=0,signal?:AbortSignal)=>
  request<QuestionnaireTemplatePage>(`${base(org)}?${new URLSearchParams({page:String(page),size:"20"})}`,"GET",200,undefined,signal);
export const getQuestionnaireTemplate=(org:string,id:string,signal?:AbortSignal)=>
  request<QuestionnaireTemplate>(`${base(org)}/${encodeURIComponent(id)}`,"GET",200,undefined,signal);
export const createQuestionnaireTemplate=(org:string,input:{sourceProgramId:string;sourceEvaluationId:string;name:string;description:string},signal?:AbortSignal)=>
  request<QuestionnaireTemplate>(base(org),"POST",201,{sourceProgramId:input.sourceProgramId,sourceEvaluationId:input.sourceEvaluationId,
    name:input.name.trim(),description:input.description.trim()||null},signal);
export function questionnaireTemplateError(error:unknown){
  const e=error instanceof QuestionnaireTemplateError?error:undefined;
  const message=e?.code==="QUESTIONNAIRE_TEMPLATE_NAME_EXISTS"?"Ya existe una plantilla global con ese nombre. Usa otro nombre."
    :e?.status===401?"Tu sesión no está disponible. Inicia sesión de nuevo."
    :e?.status===403?"Solo un consultor autorizado puede administrar plantillas de formularios."
    :e?.status===404?"La plantilla o el formulario de origen ya no está disponible para esta cuenta."
    :e?.status===400?"Revisa el nombre y la descripción de la plantilla."
    :"No se pudo confirmar la operación. Actualiza antes de volver a intentarlo.";
  return message+(e?.requestId?` Referencia: ${e.requestId}`:"");
}
