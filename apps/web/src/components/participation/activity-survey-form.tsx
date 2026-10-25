"use client";
import { QuestionnaireForm } from "@/components/forms/questionnaire-form";
import { activityErrorMessage,submitMyActivitySurvey,type ActivitySurvey,type ActivitySurveySubmission,type ActivitySurveyAnswerInput } from "@/lib/participation/activity-api";
export function ActivitySurveyForm({programId,activityId,survey,version,initialAnswers,onCompleted}:{
 programId:string;activityId:string;survey:ActivitySurvey;version:number;initialAnswers?:ActivitySurveyAnswerInput[];onCompleted:(submission:ActivitySurveySubmission)=>void;
}){
 return <QuestionnaireForm title={`Formulario de ${survey.title}`} instructions={survey.instructions} questions={survey.questions}
  initialAnswers={initialAnswers} submitLabel="Enviar actividad" onSend={async answers=>{
   try{const result=await submitMyActivitySurvey(programId,activityId,answers,version);onCompleted({...result,answers});}
   catch(error){throw new Error(activityErrorMessage(error));}
  }}/>;
}
