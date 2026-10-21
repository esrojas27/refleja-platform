import { fetchAuthSession } from "aws-amplify/auth";
import { enrollmentsPath, type Enrollment, type EnrollmentStatus, type InviteeRole, type PageResult } from "./participation-api";

export type EnrollmentAction = "REVOKE" | "WITHDRAW" | "SUSPEND" | "COMPLETE" | "REINSTATE" | "CHANGE_ROLE";
export type EnrollmentChangeInput = { version: number; action: EnrollmentAction; reason: string; confirmed: boolean; role?: InviteeRole; roleVersion?: number };
export type EnrollmentChange = {
  id: string; programId: string; action: EnrollmentAction | "INVITED" | "ACCEPTED"; previousStatus: EnrollmentStatus | null;
  status: EnrollmentStatus; previousRoles: string[]; roles: string[]; previousInvitationId: string | null; invitationId: string | null;
  actorId: string; actorLabel: string; reason: string; requestId: string; version: number; recordedAt: string;
};
export class EnrollmentAdministrationError extends Error {
  constructor(public readonly status: number, public readonly code?: string, public readonly requestId?: string) {
    super("Enrollment administration failed"); this.name="EnrollmentAdministrationError";
  }
}
async function request<T>(org: string,program: string,enrollment: string,suffix: string,input?: EnrollmentChangeInput,signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  const session=await fetchAuthSession(); signal?.throwIfAborted();
  if(!session.tokens?.accessToken) throw new EnrollmentAdministrationError(401);
  const base=process.env.NEXT_PUBLIC_API_BASE_URL;
  if(!base) throw new EnrollmentAdministrationError(0);
  const response=await fetch(`${base.replace(/\/$/,"")}/api/v1${enrollmentsPath(org,program)}/${encodeURIComponent(enrollment)}/${suffix}`, {
    method:input?"POST":"GET",signal,cache:"no-store",
    headers:{Authorization:`Bearer ${session.tokens.accessToken.toString()}`,...(input?{"Content-Type":"application/json"}:{})},
    body:input?JSON.stringify({version:input.version,action:input.action,reason:input.reason,confirmed:input.confirmed,
      ...(input.action==="CHANGE_ROLE"?{role:input.role,roleVersion:input.roleVersion}:{})}):undefined,
  });
  if(response.status!==200) {
    const body=await response.json().catch(()=>null);
    const rid=typeof body?.requestId==="string"&&/^[a-f0-9-]{36}$/i.test(body.requestId)?body.requestId:undefined;
    throw new EnrollmentAdministrationError(response.status,typeof body?.code==="string"?body.code:undefined,rid);
  }
  return response.json() as Promise<T>;
}
export const changeEnrollment=(org:string,program:string,enrollment:string,input:EnrollmentChangeInput,signal?:AbortSignal)=>
  request<Enrollment>(org,program,enrollment,"administration",input,signal);
export const getEnrollmentHistory=(org:string,program:string,enrollment:string,page=0,signal?:AbortSignal)=>
  request<PageResult<EnrollmentChange>>(org,program,enrollment,`history?page=${page}&size=20`,undefined,signal);
export const enrollmentStatusLabels:Record<EnrollmentStatus,string>={
  PENDING_APPROVAL:"Pendiente de aprobación",INVITED:"Invitada",ACTIVE:"Activa",SUSPENDED:"Suspendida",COMPLETED:"Completada",WITHDRAWN:"Retirada",
};
export const enrollmentActionLabels:Record<EnrollmentChange["action"],string>={
  INVITED:"Invitación creada",ACCEPTED:"Invitación aceptada",REVOKE:"Revocar invitación",WITHDRAW:"Retirar participante",
  SUSPEND:"Suspender inscripción",COMPLETE:"Completar participación",REINSTATE:"Reincorporar",CHANGE_ROLE:"Cambiar rol",
};
export function enrollmentAdministrationMessage(error:unknown) {
  const failure=error instanceof EnrollmentAdministrationError?error:undefined;
  const codes:Record<string,string>={
    ENROLLMENT_VERSION_CONFLICT:"La inscripción cambió. Actualiza el listado antes de volver a actuar.",
    MEMBERSHIP_VERSION_CONFLICT:"El acceso de la organización cambió desde otra vista o programa. Actualiza el listado.",
    ENROLLMENT_TRANSITION_NOT_ALLOWED:"Esta acción ya no está disponible para el estado actual.",
    ENROLLMENT_CONFIRMATION_REQUIRED:"Confirma que entiendes el alcance de la acción.",
    PARTICIPANT_ADMINISTRATIVE_ACCESS:"El acceso administrativo de consultores no se modifica desde una inscripción.",
    PARTICIPANT_IDENTITY_DISABLED:"La cuenta o la membresía está deshabilitada. Reincorporar no reactiva accesos globales.",
    PARTICIPANT_ROLE_UNCHANGED:"La persona ya tiene ese rol en la organización.",
    PARTICIPANT_ROLE_INVALID:"Selecciona Colaborador, Líder o RRHH.",
    INVITATION_ALREADY_ACCEPTED:"La invitación ya fue aceptada. Usa retirar o suspender la inscripción.",
    INVITATION_ALREADY_REVOKED:"La invitación ya está revocada. Actualiza el listado.",
    INVITATION_RENEWAL_NOT_ALLOWED:"La invitación vigente aún se puede aceptar. Revisa su estado antes de renovarla.",
    PARTICIPATION_COMPLETION_NOT_AVAILABLE:"La participación se completa desde un programa activo o finalizado.",
    PROGRAM_READ_ONLY:"El programa está cerrado. Solo puedes restringir accesos o consultar el historial.",
    PARTICIPATION_READ_ONLY:"Tu participación está completada y solo permite consulta.",
  };
  const message=(failure?.code&&codes[failure.code])||(failure?.status===401?"Tu sesión no está disponible. Inicia sesión de nuevo."
    :failure?.status===403?"Sólo un consultor autorizado puede administrar participantes."
      :failure?.status===404?"La inscripción no está disponible en esta organización y programa."
        :failure?.status===400?"Revisa el motivo y los datos de la acción."
          :failure?.status===409?"El registro cambió. Actualiza el listado antes de volver a actuar."
            :"No se pudo confirmar la operación. Actualiza el listado antes de repetirla.");
  return message+(failure?.requestId?` Referencia: ${failure.requestId}`:"");
}
