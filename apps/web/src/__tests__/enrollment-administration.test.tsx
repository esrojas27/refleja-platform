import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EnrollmentAdministration } from "@/components/participation/enrollment-administration";
import { ProgramStateContext } from "@/components/programs/program-state-context";
import { changeEnrollment,getEnrollmentHistory,EnrollmentAdministrationError } from "@/lib/participation/enrollment-administration-api";
import type { Enrollment } from "@/lib/participation/participation-api";
import type { Program } from "@/lib/programs/program-api";

vi.mock("@/lib/participation/enrollment-administration-api",async original=>({...await original<typeof import("@/lib/participation/enrollment-administration-api")>(),changeEnrollment:vi.fn(),getEnrollmentHistory:vi.fn()}));
const enrollment:Enrollment={id:"e",organizationId:"o",programId:"p",status:"ACTIVE",version:2,suspendedFromStatus:null,
  participant:{userId:"u",membershipId:"m",email:"ana@example.test",firstName:"Ana",lastName:"Prueba"},invitation:null,
  access:{roles:["COLLABORATOR"],version:3,membershipStatus:"ACTIVE",userStatus:"ACTIVE"}};
beforeEach(()=>{
  vi.mocked(changeEnrollment).mockResolvedValue({...enrollment,status:"SUSPENDED",version:3});
  vi.mocked(getEnrollmentHistory).mockResolvedValue({items:[],page:0,size:20,totalElements:0,totalPages:0});
});
afterEach(()=>{cleanup();vi.resetAllMocks();});
function confirm(){fireEvent.change(screen.getByLabelText("Motivo del cambio"),{target:{value:"Cambio solicitado"}});fireEvent.click(screen.getByLabelText("Entiendo el alcance y confirmo este cambio."));}
it("offers state-specific actions and requires reason and explicit confirmation",async()=>{
  const saved=vi.fn();render(<EnrollmentAdministration enrollment={enrollment} onSaved={saved}/>);
  expect(screen.queryByRole("button",{name:"Revocar invitación"})).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Suspender"}));fireEvent.submit(screen.getByRole("form"));
  expect(changeEnrollment).not.toHaveBeenCalled();expect(screen.getByLabelText("Motivo del cambio").getAttribute("aria-invalid")).toBe("true");
  confirm();fireEvent.submit(screen.getByRole("form"));
  await waitFor(()=>expect(saved).toHaveBeenCalled());
  expect(changeEnrollment).toHaveBeenCalledWith("o","p","e",{version:2,action:"SUSPEND",reason:"Cambio solicitado",confirmed:true},expect.any(AbortSignal));
});
it("warns that a role change affects other programs and sends both versions",async()=>{
  render(<EnrollmentAdministration enrollment={enrollment} onSaved={vi.fn()}/>);
  fireEvent.click(screen.getByRole("button",{name:"Cambiar rol"}));
  expect(screen.getByText(/Este cambio afecta todos sus programas/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Nuevo rol en la organización"),{target:{value:"COMPANY_ADMIN"}});confirm();fireEvent.submit(screen.getByRole("form"));
  await waitFor(()=>expect(changeEnrollment).toHaveBeenCalledWith("o","p","e",expect.objectContaining({role:"COMPANY_ADMIN",roleVersion:3,version:2}),expect.any(AbortSignal)));
});
it("warns that completing with pending work does not turn progress into one hundred percent",()=>{
  render(<EnrollmentAdministration enrollment={enrollment} onSaved={vi.fn()}/>);
  fireEvent.click(screen.getByRole("button",{name:"Completar participación"}));
  expect(screen.getByText(/Puede haber actividades o encuestas pendientes/)).toBeTruthy();
  expect(screen.getByText(/No se aprueban actividades ni se convierte su progreso en 100%/)).toBeTruthy();
});
it("reinstatement of an unaccepted revoked invitation explains new consent and link",()=>{
  render(<EnrollmentAdministration enrollment={{...enrollment,status:"WITHDRAWN",invitation:{id:"i",role:"COLLABORATOR",status:"REVOKED",expiresAt:"2026-10-20T00:00:00Z",deliveryStatus:"SENT"}}} onSaved={vi.fn()}/>);
  fireEvent.click(screen.getByRole("button",{name:"Reincorporar"}));
  expect(screen.getByText(/invitación nueva sin enviar correos/)).toBeTruthy();expect(changeEnrollment).not.toHaveBeenCalled();
});
it("protects consultant access and never reactivates disabled global membership",()=>{
  const view=render(<EnrollmentAdministration enrollment={{...enrollment,access:{...enrollment.access!,roles:["CONSULTANT"]}}} onSaved={vi.fn()}/>);
  expect(screen.queryByRole("button",{name:"Retirar"})).toBeNull();expect(screen.getByRole("button",{name:"Historial"})).toBeTruthy();
  view.rerender(<EnrollmentAdministration enrollment={{...enrollment,status:"WITHDRAWN",access:{...enrollment.access!,membershipStatus:"SUSPENDED"}}} onSaved={vi.fn()}/>);
  expect((screen.getByRole("button",{name:"Reincorporar"}) as HTMLButtonElement).disabled).toBe(true);
});
it("allows restricting access after closure but not reinstatement or role change",()=>{
  render(<ProgramStateContext.Provider value={{program:{status:"COMPLETED"} as Program,canEdit:false,canExecute:false,update:vi.fn()}}>
    <EnrollmentAdministration enrollment={enrollment} onSaved={vi.fn()}/></ProgramStateContext.Provider>);
  expect(screen.getByRole("button",{name:"Suspender"})).toBeTruthy();expect(screen.getByRole("button",{name:"Retirar"})).toBeTruthy();
  expect(screen.queryByRole("button",{name:"Cambiar rol"})).toBeNull();expect(screen.queryByRole("button",{name:"Reincorporar"})).toBeNull();
});
it("blocks duplicate submission and unsafe retry after a conflict",async()=>{
  let reject!:(reason:unknown)=>void;vi.mocked(changeEnrollment).mockReturnValue(new Promise((_,fail)=>{reject=fail;}));
  render(<EnrollmentAdministration enrollment={enrollment} onSaved={vi.fn()}/>);fireEvent.click(screen.getByRole("button",{name:"Suspender"}));confirm();
  fireEvent.submit(screen.getByRole("form"));fireEvent.submit(screen.getByRole("form"));expect(changeEnrollment).toHaveBeenCalledTimes(1);
  await act(async()=>reject(new EnrollmentAdministrationError(409,"ENROLLMENT_VERSION_CONFLICT")));
  expect((screen.getByRole("button",{name:"Confirmar cambio"}) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole("status").textContent).toMatch(/Actualiza el listado/);
});
it("shows history actor, reason, transitions and organization-wide role changes",async()=>{
  vi.mocked(getEnrollmentHistory).mockResolvedValue({page:0,size:20,totalElements:1,totalPages:1,items:[{id:"h",programId:"another",action:"CHANGE_ROLE",previousStatus:"ACTIVE",status:"ACTIVE",previousRoles:["COLLABORATOR"],roles:["LEADER"],previousInvitationId:null,invitationId:null,actorId:"a",actorLabel:"Consultora",reason:"Responsable de equipo",requestId:"r",version:1,recordedAt:"2026-10-20T00:00:00Z"}]});
  render(<EnrollmentAdministration enrollment={enrollment} onSaved={vi.fn()}/>);fireEvent.click(screen.getByRole("button",{name:"Historial"}));
  await screen.findByText("Responsable de equipo");expect(screen.getByText(/Colaborador → Líder/)).toBeTruthy();
  expect(screen.getByText(/originado en otro programa/)).toBeTruthy();expect(screen.getByText(/Consultora/)).toBeTruthy();
});
