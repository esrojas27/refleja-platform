import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ScheduleForm, SessionAgendaArea } from "@/components/programs/session-agenda";
import { listSessionAgenda, scheduleSession, type SessionAgenda } from "@/lib/participation/session-schedule-api";
vi.mock("@/lib/participation/session-schedule-api", async original => ({ ...await original<typeof import("@/lib/participation/session-schedule-api")>(), listSessionAgenda: vi.fn(), scheduleSession: vi.fn(), sessionHistory: vi.fn() }));
const first={enrollmentId:"one",email:"ana@example.test",name:"Ana",status:"ACTIVE",enabled:true,scheduledDate:null,version:null};
const agenda:SessionAgenda={canEdit:true,today:"2026-10-23",startDate:"2026-10-23",endDate:"2026-11-23",items:[{
  session:{id:"session",moduleId:"dimension",dimensionName:"Interior",name:"Sesión inicial",objective:"Objetivo",dimensionPosition:1,position:1},
  participants:[first,{...first,enrollmentId:"two",name:"Bea",email:"bea@example.test"}]}]};
beforeEach(()=>{vi.mocked(listSessionAgenda).mockResolvedValue(agenda);vi.mocked(scheduleSession).mockResolvedValue(agenda);});
afterEach(()=>{cleanup();vi.resetAllMocks();});
it.each([
 ["SESSION_MISSING_ACTIVITIES","Faltan actividades"],
 ["SESSION_MISSING_ACTIVITY_FORM","Falta configurar el formulario"],
 ["SESSION_MISSING_CLOSING_COMMENT","Falta el comentario"],
 ["SESSION_MISSING_CLOSING_SURVEY","Falta la encuesta"],
])("blocks scheduling and explains the missing prerequisite %s",async(code,message)=>{
 vi.mocked(listSessionAgenda).mockResolvedValue({...agenda,items:[{...agenda.items[0],missingRequirement:code}]});
 render(<SessionAgendaArea organizationId="org" programId="program"/>);
 await screen.findByText("Sesión inicial");
 expect(screen.getByText(new RegExp(message))).toBeTruthy();
 expect(screen.getByRole<HTMLButtonElement>("button",{name:"Agendar participantes"}).disabled).toBe(true);
});
it("shows dates and unscheduled people and gives staff read-only access when appropriate",async()=>{
  vi.mocked(listSessionAgenda).mockResolvedValue({...agenda,canEdit:false});
  render(<SessionAgendaArea organizationId="org" programId="program"/>);
  await screen.findByText("Sesión inicial");
  expect(screen.getAllByText(/Sin agendar · Oculta/)).toHaveLength(2);
  expect(screen.queryByRole("button",{name:"Agendar participantes"})).toBeNull();
});
it("assigns a date to a chosen subgroup without changing the others",async()=>{
  const saved=vi.fn();render(<ScheduleForm organizationId="org" programId="program" agenda={agenda} sessionId="session" onSaved={saved}/>);
  fireEvent.click(screen.getByRole("checkbox",{name:/Ana/}));
  fireEvent.change(screen.getByLabelText("Fecha de la sesión"),{target:{value:"2026-10-25"}});
  fireEvent.submit(screen.getByRole("form"));
  await waitFor(()=>expect(scheduleSession).toHaveBeenCalledWith("org","program","session","2026-10-25",[first],"",expect.any(AbortSignal)));
  expect(saved).toHaveBeenCalledWith(agenda);
});
it("requires a reason when reprogramming a person",async()=>{
  const dated={...agenda,items:[{...agenda.items[0],participants:[{...first,scheduledDate:"2026-10-24",version:0}]}]};
  render(<ScheduleForm organizationId="org" programId="program" agenda={dated} sessionId="session" onSaved={vi.fn()}/>);
  fireEvent.click(screen.getByRole("checkbox",{name:/Ana/}));
  fireEvent.change(screen.getByLabelText("Fecha de la sesión"),{target:{value:"2026-10-26"}});
  fireEvent.submit(screen.getByRole("form"));
  expect(screen.getByText("Escribe el motivo de la reprogramación.")).toBeTruthy();expect(scheduleSession).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Motivo de la reprogramación"),{target:{value:"Cambio acordado"}});
  fireEvent.submit(screen.getByRole("form"));
  await waitFor(()=>expect(scheduleSession).toHaveBeenCalledOnce());
});
it("warns without blocking a session after the program end, even when the planned end has passed",async()=>{
  const saved=vi.fn();
  render(<ScheduleForm organizationId="org" programId="program" agenda={{...agenda,endDate:"2026-10-22"}} sessionId="session" onSaved={saved}/>);
  fireEvent.click(screen.getByRole("checkbox",{name:/Ana/}));
  const input=screen.getByLabelText("Fecha de la sesión");
  expect(input.getAttribute("max")).toBe("9999-12-28");
  fireEvent.change(input,{target:{value:"2026-12-10"}});
  expect(screen.getByText(/La sesión queda después del fin previsto del programa \(2026-10-22\)/)).toBeTruthy();
  fireEvent.submit(screen.getByRole("form"));
  await waitFor(()=>expect(scheduleSession).toHaveBeenCalledWith("org","program","session","2026-12-10",[first],"",expect.any(AbortSignal)));
  expect(saved).toHaveBeenCalledWith(agenda);
});
it("allows rescheduling after the program end but still requires a reason",async()=>{
  const person={...first,scheduledDate:"2026-11-23",version:0};
  const dated={...agenda,items:[{...agenda.items[0],participants:[person]}]};
  render(<ScheduleForm organizationId="org" programId="program" agenda={dated} sessionId="session" onSaved={vi.fn()}/>);
  fireEvent.click(screen.getByRole("checkbox",{name:/Ana/}));
  fireEvent.change(screen.getByLabelText("Fecha de la sesión"),{target:{value:"2026-12-10"}});
  fireEvent.submit(screen.getByRole("form"));
  expect(scheduleSession).not.toHaveBeenCalled();
  expect(screen.getByText("Escribe el motivo de la reprogramación.")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Motivo de la reprogramación"),{target:{value:"Nueva fecha acordada"}});
  fireEvent.submit(screen.getByRole("form"));
  await waitFor(()=>expect(scheduleSession).toHaveBeenCalledWith("org","program","session","2026-12-10",[person],"Nueva fecha acordada",expect.any(AbortSignal)));
});
it("still blocks future dates before the program start",()=>{
  render(<ScheduleForm organizationId="org" programId="program" agenda={{...agenda,startDate:"2026-11-01"}} sessionId="session" onSaved={vi.fn()}/>);
  fireEvent.click(screen.getByRole("checkbox",{name:/Ana/}));
  fireEvent.change(screen.getByLabelText("Fecha de la sesión"),{target:{value:"2026-10-30"}});
  fireEvent.submit(screen.getByRole("form"));
  expect(scheduleSession).not.toHaveBeenCalled();
  expect(screen.getByText("Selecciona una fecha válida, que no sea pasada ni anterior al inicio del programa.")).toBeTruthy();
});
it("blocks past dates and double submission",async()=>{
  vi.mocked(scheduleSession).mockReturnValue(new Promise(()=>{}));
  render(<ScheduleForm organizationId="org" programId="program" agenda={agenda} sessionId="session" onSaved={vi.fn()}/>);
  fireEvent.click(screen.getByRole("checkbox",{name:/Ana/}));
  fireEvent.change(screen.getByLabelText("Fecha de la sesión"),{target:{value:"2026-10-22"}});
  fireEvent.submit(screen.getByRole("form"));expect(scheduleSession).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Fecha de la sesión"),{target:{value:"2026-10-25"}});
  fireEvent.submit(screen.getByRole("form"));fireEvent.submit(screen.getByRole("form"));expect(scheduleSession).toHaveBeenCalledOnce();
});
