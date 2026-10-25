import { act,cleanup,fireEvent,render,screen,waitFor,within } from "@testing-library/react";
import { afterEach,beforeEach,expect,it,vi } from "vitest";
import { ActivityEvaluationForm } from "@/components/programs/activity-evaluation-form";
import { SaveQuestionnaireTemplate } from "@/components/forms/save-questionnaire-template";
import { QuestionnaireTemplatePicker } from "@/components/forms/questionnaire-template-picker";
import { createQuestionnaireTemplate,getQuestionnaireTemplate,listQuestionnaireTemplates,QuestionnaireTemplateError,type QuestionnaireTemplate } from "@/lib/forms/questionnaire-template-api";
import { createActivityEvaluation,saveSessionEvaluation,type ActivityEvaluation } from "@/lib/participation/evaluation-api";
vi.mock("@/lib/forms/questionnaire-template-api",async original=>({...await original<typeof import("@/lib/forms/questionnaire-template-api")>(),
 createQuestionnaireTemplate:vi.fn(),getQuestionnaireTemplate:vi.fn(),listQuestionnaireTemplates:vi.fn()}));
vi.mock("@/lib/participation/evaluation-api",async original=>({...await original<typeof import("@/lib/participation/evaluation-api")>(),createActivityEvaluation:vi.fn(),saveSessionEvaluation:vi.fn()}));
const template:QuestionnaireTemplate={summary:{id:"template",name:"Fortalezas",description:"Para cualquier sesión",questionCount:2,createdAt:"2026-10-25T12:00:00Z"},
 definition:{title:"Reconoce tus fortalezas",instructions:"Elige desde tu experiencia",questions:[
  {prompt:"¿Qué fortaleza te representa?",type:"SINGLE_CHOICE_WORDS",position:1,options:["Claridad","Autenticidad","Empatía"]},
  {prompt:"¿Qué quieres aplicar?",type:"OPEN_TEXT",position:2}]}};
const source:ActivityEvaluation={id:"evaluation",organizationId:"org",programId:"program",activityId:"activity",title:"Formulario guardado",instructions:null,
 version:0,questions:[{id:"q",prompt:"Reflexiona",type:"OPEN_TEXT",position:1,version:0}]};
const page={items:[template.summary],page:0,size:20,totalElements:1,totalPages:1};
beforeEach(()=>{
 vi.mocked(listQuestionnaireTemplates).mockResolvedValue(page);vi.mocked(getQuestionnaireTemplate).mockResolvedValue(template);
 vi.mocked(createQuestionnaireTemplate).mockResolvedValue(template);vi.mocked(createActivityEvaluation).mockResolvedValue(source);
 vi.mocked(saveSessionEvaluation).mockResolvedValue({...source,activityId:null,sessionId:"session"});
});
afterEach(()=>{cleanup();vi.resetAllMocks();});

it("keeps focus in both template metadata fields while each character updates the modal",()=>{
 render(<SaveQuestionnaireTemplate organizationId="org" programId="program" evaluation={source}/>);
 fireEvent.click(screen.getByRole("button",{name:"Guardar como plantilla"}));
 const name=screen.getByLabelText<HTMLInputElement>("Nombre de la plantilla");
 const description=screen.getByLabelText<HTMLTextAreaElement>("Descripción opcional");
 for(const [field,text] of [[name,"Plantilla de fortalezas"],[description,"Descripción escrita de corrido"]] as const){
  field.focus();let value="";
  for(const character of text){value+=character;fireEvent.change(field,{target:{value}});expect(document.activeElement).toBe(field);}
  expect(field.value).toBe(text);
 }
});
async function chooseTemplate(){fireEvent.click(screen.getByRole("button",{name:"Usar plantilla"}));fireEvent.click(await screen.findByRole("button",{name:"Ver plantilla Fortalezas"}));
 await screen.findByText(/Se reemplazarán el título/);fireEvent.click(screen.getByRole("button",{name:"Usar esta plantilla"}));}

it("loads an editable activity form only after explicit selection and saves with fresh question positions",async()=>{
 render(<ActivityEvaluationForm organizationId="org" programId="program" activityId="activity" activityTitle="Actividad" onSaved={vi.fn()}/>);
 await chooseTemplate();expect(createActivityEvaluation).not.toHaveBeenCalled();
 expect((screen.getByLabelText("Nombre de la encuesta") as HTMLInputElement).value).toBe(template.definition.title);
 expect(screen.getAllByLabelText("Enunciado")).toHaveLength(2);
 fireEvent.change(screen.getAllByLabelText("Enunciado")[1],{target:{value:"Mi pregunta adaptada"}});
 fireEvent.submit(screen.getByRole("form",{name:"Crear formulario"}));
 await waitFor(()=>expect(createActivityEvaluation).toHaveBeenCalledWith("org","program","activity",expect.objectContaining({questions:[
   template.definition.questions[0],{prompt:"Mi pregunta adaptada",type:"OPEN_TEXT",position:2}]}),expect.any(AbortSignal)));
 expect(template.definition.questions[1].prompt).toBe("¿Qué quieres aplicar?");
});
it("uses the same catalog to configure a session closure without creating an activity form",async()=>{
 render(<ActivityEvaluationForm organizationId="org" programId="program" sessionId="session" activityTitle="Sesión" onSaved={vi.fn()}/>);
 await chooseTemplate();fireEvent.submit(screen.getByRole("form",{name:"Crear encuesta de cierre"}));
 await waitFor(()=>expect(saveSessionEvaluation).toHaveBeenCalledWith("org","program","session",template.definition,expect.any(AbortSignal)));
 expect(createActivityEvaluation).not.toHaveBeenCalled();
});
it("previews custom options and leaves the original draft unchanged when dismissed",async()=>{
 render(<ActivityEvaluationForm organizationId="org" programId="program" activityId="activity" activityTitle="Actividad" onSaved={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText("Enunciado"),{target:{value:"Pregunta sin guardar"}});
 fireEvent.click(screen.getByRole("button",{name:"Usar plantilla"}));fireEvent.click(await screen.findByRole("button",{name:"Ver plantilla Fortalezas"}));
 expect(await screen.findByText("Claridad · Autenticidad · Empatía")).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:"Cerrar plantillas"}));
 expect((screen.getByLabelText("Enunciado") as HTMLTextAreaElement).value).toBe("Pregunta sin guardar");expect(createActivityEvaluation).not.toHaveBeenCalled();
});
it("creates a global snapshot from a persisted definition and explains what is and is not shared",async()=>{
 render(<SaveQuestionnaireTemplate organizationId="org" programId="program" evaluation={source}/>);
 fireEvent.click(screen.getByRole("button",{name:"Guardar como plantilla"}));
 const form=screen.getByRole("form",{name:"Guardar plantilla de formulario"});
 expect(within(form).getByText(/No se copiarán respuestas, personas ni progreso/)).toBeTruthy();
 expect(within(form).getByText(/consultores de todas las organizaciones/)).toBeTruthy();
 fireEvent.change(within(form).getByLabelText("Nombre de la plantilla"),{target:{value:" Plantilla propia "}});fireEvent.submit(form);
 await waitFor(()=>expect(createQuestionnaireTemplate).toHaveBeenCalledWith("org",{sourceProgramId:"program",sourceEvaluationId:"evaluation",name:" Plantilla propia ",description:""},expect.any(AbortSignal)));
 expect(await screen.findByText(/Plantilla global creada/)).toBeTruthy();expect(screen.queryByRole("dialog")).toBeNull();
});
it("requires a name and lets the consultant correct a globally duplicated name",async()=>{
 vi.mocked(createQuestionnaireTemplate).mockRejectedValueOnce(new QuestionnaireTemplateError(409,[],"QUESTIONNAIRE_TEMPLATE_NAME_EXISTS"));
 render(<SaveQuestionnaireTemplate organizationId="org" programId="program" evaluation={{...source,activityId:null,sessionId:"session"}}/>);
 fireEvent.click(screen.getByRole("button",{name:"Guardar como plantilla"}));const form=screen.getByRole("form");
 fireEvent.change(screen.getByLabelText("Nombre de la plantilla"),{target:{value:" "}});fireEvent.submit(form);expect(createQuestionnaireTemplate).not.toHaveBeenCalled();
 expect(screen.getByText("Escribe un nombre para la plantilla.")).toBeTruthy();
 fireEvent.change(screen.getByLabelText("Nombre de la plantilla"),{target:{value:"Repetido"}});fireEvent.submit(form);
 expect(await screen.findByText(/Usa otro nombre/)).toBeTruthy();expect(screen.getByLabelText("Nombre de la plantilla").getAttribute("aria-invalid")).toBe("true");
 fireEvent.change(screen.getByLabelText("Nombre de la plantilla"),{target:{value:"Nombre diferente"}});fireEvent.submit(form);
 expect(await screen.findByText(/Plantilla global creada/)).toBeTruthy();
});
it("paginates the global catalog without loading definitions until requested",async()=>{
 vi.mocked(listQuestionnaireTemplates).mockResolvedValueOnce({...page,totalElements:21,totalPages:2}).mockResolvedValueOnce({...page,page:1,totalElements:21,totalPages:2});
 render(<QuestionnaireTemplatePicker organizationId="org" disabled={false} onSelect={vi.fn()}/>);
 expect(listQuestionnaireTemplates).not.toHaveBeenCalled();fireEvent.click(screen.getByRole("button",{name:"Usar plantilla"}));
 fireEvent.click(await screen.findByRole("button",{name:"Siguiente"}));await waitFor(()=>expect(listQuestionnaireTemplates).toHaveBeenLastCalledWith("org",1,expect.any(AbortSignal)));
 expect(getQuestionnaireTemplate).not.toHaveBeenCalled();
});
it("shows an empty catalog clearly and does not alter the editor",async()=>{
 vi.mocked(listQuestionnaireTemplates).mockResolvedValue({...page,items:[],totalElements:0,totalPages:0});const select=vi.fn();
 render(<QuestionnaireTemplatePicker organizationId="org" disabled={false} onSelect={select}/>);fireEvent.click(screen.getByRole("button",{name:"Usar plantilla"}));
 expect(await screen.findByText(/Aún no hay plantillas/)).toBeTruthy();expect(select).not.toHaveBeenCalled();
});
it("discards a late preview after the picker is closed",async()=>{
 let resolve!:(value:QuestionnaireTemplate)=>void;vi.mocked(getQuestionnaireTemplate).mockReturnValue(new Promise(done=>{resolve=done;}));const select=vi.fn();
 render(<QuestionnaireTemplatePicker organizationId="org" disabled={false} onSelect={select}/>);fireEvent.click(screen.getByRole("button",{name:"Usar plantilla"}));
 fireEvent.click(await screen.findByRole("button",{name:"Ver plantilla Fortalezas"}));const signal=vi.mocked(getQuestionnaireTemplate).mock.calls[0][2]!;
 fireEvent.click(screen.getByRole("button",{name:"Cerrar plantillas"}));await act(async()=>resolve(template));
 expect(signal.aborted).toBe(true);expect(select).not.toHaveBeenCalled();expect(screen.queryByRole("button",{name:"Usar esta plantilla"})).toBeNull();
});
