import { activityRequest, type ActivitySurveyAnswerInput } from "./activity-api";
import type { ActivityEvaluation } from "./evaluation-api";
export type SessionClosure = {sessionId:string;sessionName:string;dimensionName:string;status:"LOCKED"|"COMMENT"|"PENDING"|"COMPLETED";
  closingComment:string|null;activityCount:number;submittedCount:number;completionPercentage:number;survey:ActivityEvaluation|null;answers:ActivitySurveyAnswerInput[]};
const path=(program:string)=>`/me/programs/${encodeURIComponent(program)}`;
export const listMySessionClosures=(program:string,signal?:AbortSignal)=>activityRequest<{items:SessionClosure[]}>(`${path(program)}/session-closures`,"GET",200,undefined,signal);
export const acknowledgeSessionClosure=(program:string,session:string)=>activityRequest<SessionClosure>(`${path(program)}/sessions/${encodeURIComponent(session)}/closure-acknowledgement`,"POST",200);
export const sendSessionClosure=(program:string,session:string,answers:ActivitySurveyAnswerInput[])=>activityRequest<SessionClosure>(`${path(program)}/sessions/${encodeURIComponent(session)}/closure-response`,"POST",200,{answers});
