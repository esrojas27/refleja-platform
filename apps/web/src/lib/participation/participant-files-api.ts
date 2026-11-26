import { fetchAuthSession } from "aws-amplify/auth";
export const MAX_PARTICIPANT_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_PARTICIPANT_FILES = 10;
export const PARTICIPANT_FILE_TYPES = ["application/pdf","image/jpeg","image/png","image/webp"];
export type FileScope = { programId: string; organizationId?: string; enrollmentId?: string };
export type ParticipantFile = { id: string; title: string; contentType: string; sizeBytes: number; createdAt: string; documentType?: "DISC" | null; documentVersion?: number | null };
export type ParticipantFileList = { items: ParticipantFile[]; canManage: boolean; maxFileBytes: number; maxFiles: number };
export type FileParticipant = { enrollmentId: string; email: string; firstName: string | null; lastName: string | null; enrollmentStatus: string };
export type FileParticipants = { items: FileParticipant[]; page: number; size: number; totalElements: number; totalPages: number; canManage: boolean };
export class ParticipantFileError extends Error {
  constructor(public status: number, public code?: string, public requestId?: string) { super("Participant file request failed"); }
}
export function participantFilesPath(scope: FileScope) {
  const program=encodeURIComponent(scope.programId);
  if (!scope.organizationId) return `/me/programs/${program}/files`;
  if (!scope.enrollmentId) throw new ParticipantFileError(0);
  return `/organizations/${encodeURIComponent(scope.organizationId)}/programs/${program}/enrollments/${encodeURIComponent(scope.enrollmentId)}/files`;
}
async function request(path: string, method: string, expected: number, signal?: AbortSignal, body?: FormData) {
  signal?.throwIfAborted();
  const session=await fetchAuthSession();
  signal?.throwIfAborted();
  if(!session.tokens?.accessToken)throw new ParticipantFileError(401);
  const base=process.env.NEXT_PUBLIC_API_BASE_URL;
  if(!base)throw new ParticipantFileError(0);
  const response=await fetch(`${base.replace(/\/$/,"")}/api/v1${path}`,{
    method,signal,body,cache:"no-store",headers:{Authorization:`Bearer ${session.tokens.accessToken.toString()}`},
  });
  if(response.status!==expected){
    const error=await response.json().catch(()=>null);
    throw new ParticipantFileError(response.status,typeof error?.code==="string"?error.code:undefined,
      typeof error?.requestId==="string" && /^[a-f0-9-]{36}$/i.test(error.requestId)?error.requestId:undefined);
  }
  return response;
}
export const listParticipantFiles=async(scope:FileScope,signal?:AbortSignal)=>
  (await request(participantFilesPath(scope),"GET",200,signal)).json() as Promise<ParticipantFileList>;
export async function uploadParticipantFile(scope:FileScope,name:string,file:File,signal?:AbortSignal){
  const body=new FormData();body.append("name",name.trim());body.append("file",file);
  return (await request(participantFilesPath(scope),"POST",201,signal,body)).json() as Promise<ParticipantFile>;
}
export async function deleteParticipantFile(scope:FileScope,id:string,signal?:AbortSignal){
  await request(`${participantFilesPath(scope)}/${encodeURIComponent(id)}`,"DELETE",204,signal);
}
export async function fetchParticipantFile(scope:FileScope,id:string,signal?:AbortSignal,download=false){
  const response=await request(`${participantFilesPath(scope)}/${encodeURIComponent(id)}/content${download?"?download=true":""}`,"GET",200,signal);
  const type=response.headers.get("Content-Type")?.split(";")[0];
  if(!type || !PARTICIPANT_FILE_TYPES.includes(type))throw new ParticipantFileError(0);
  const blob=await response.blob();
  if(!blob.size || blob.size>MAX_PARTICIPANT_FILE_BYTES)throw new ParticipantFileError(0);
  return blob;
}
export const listFileParticipants=async(org:string,program:string,page:number,signal?:AbortSignal)=>
  (await request(`/organizations/${encodeURIComponent(org)}/programs/${encodeURIComponent(program)}/files/participants?page=${page}&size=20`,"GET",200,signal)).json() as Promise<FileParticipants>;
export function participantFileError(error:unknown){
  const status=error instanceof ParticipantFileError?error.status:0;
  const message=error instanceof ParticipantFileError && error.code==="FILE_LIMIT_REACHED" ? "Esta persona ya tiene 10 archivos en este programa. Elimina uno antes de cargar otro."
    : error instanceof ParticipantFileError && error.code==="PROGRAM_READ_ONLY" ? "Este programa está cerrado y sus archivos solo se pueden consultar."
    : status===401?"Tu sesión no está disponible. Inicia sesión de nuevo."
    : status===403?"No tienes permiso para consultar o administrar estos archivos."
    : status===404?"El programa, la persona o el archivo ya no están disponibles."
    : status===413?"El archivo supera el máximo de 10 MB."
    : status===400?"Revisa el nombre y el archivo: PDF, JPG, PNG o WebP válido, de hasta 10 MB."
    : status===409?"La información cambió. Actualiza los archivos antes de volver a intentarlo."
    : "No se pudo completar la operación. Actualiza los archivos y vuelve a intentarlo.";
  return message+(error instanceof ParticipantFileError && error.requestId?` Referencia: ${error.requestId}`:"");
}
export function participantFileName(file:ParticipantFile){
  const extension:Record<string,string>={"application/pdf":"pdf","image/jpeg":"jpg","image/png":"png","image/webp":"webp"};
  return (file.title+(file.documentVersion ? "-v"+file.documentVersion : "")).replace(/[\\/:*?"<>|]/g,"_")+"."+(extension[file.contentType]??"bin");
}
