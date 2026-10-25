import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SessionClosuresArea } from "@/components/participation/session-closures-area";
import { listMySessionClosures, acknowledgeSessionClosure, sendSessionClosure, type SessionClosure } from "@/lib/participation/session-closure-api";
vi.mock("@/lib/participation/session-closure-api", () => ({ listMySessionClosures: vi.fn(), acknowledgeSessionClosure: vi.fn(), sendSessionClosure: vi.fn() }));
const closure: SessionClosure = { sessionId:"session",sessionName:"Autoconocimiento",dimensionName:"Interior",status:"COMMENT",
 closingComment:"Reconoce tus logros y celebra este avance.",activityCount:2,submittedCount:2,completionPercentage:80,survey:null,answers:[] };
const pending: SessionClosure = { ...closure,status:"PENDING",survey:{id:"closing",organizationId:"org",programId:"program",activityId:null,sessionId:"session",
 title:"Cierre de mi sesión",instructions:null,version:0,questions:[{id:"q",prompt:"¿Qué te llevas?",type:"OPEN_TEXT",position:1,version:0}]} };
beforeEach(()=>{
 vi.mocked(listMySessionClosures).mockResolvedValue({items:[closure]});
 vi.mocked(acknowledgeSessionClosure).mockResolvedValue(pending);
 vi.mocked(sendSessionClosure).mockResolvedValue({...pending,status:"COMPLETED",completionPercentage:100,answers:[{questionId:"q",values:["Claridad"]}]});
});
afterEach(()=>{cleanup();vi.resetAllMocks();});

it("shows the closing comment once and only exposes the survey after acknowledgment",async()=>{
 render(<SessionClosuresArea programId="program" readOnly={false}/>);
 expect(await screen.findByRole("dialog")).toBeTruthy();
 expect(screen.getByText(closure.closingComment!)).toBeTruthy();expect(screen.queryByRole("form")).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"Continuar a la encuesta de cierre"}));
 expect(await screen.findByRole("form",{name:"Cierre de mi sesión"})).toBeTruthy();expect(screen.queryByRole("dialog")).toBeNull();
 expect(acknowledgeSessionClosure).toHaveBeenCalledWith("program","session");
 fireEvent.change(screen.getByLabelText("Respuesta a ¿Qué te llevas?"),{target:{value:"Claridad"}});
 fireEvent.click(screen.getByRole("button",{name:"Enviar encuesta de cierre"}));
 await waitFor(()=>expect(sendSessionClosure).toHaveBeenCalledWith("program","session",[{questionId:"q",values:["Claridad"]}]));
 expect(await screen.findByText("Sesión completada al 100%.")).toBeTruthy();expect(screen.queryByRole("form")).toBeNull();
});
it("resumes a pending closing survey without showing the popup again",async()=>{
 vi.mocked(listMySessionClosures).mockResolvedValue({items:[pending]});
 render(<SessionClosuresArea programId="program" readOnly={false}/>);
 await screen.findByRole("form",{name:"Cierre de mi sesión"});expect(screen.queryByRole("dialog")).toBeNull();expect(acknowledgeSessionClosure).not.toHaveBeenCalled();
});
it("keeps the popup open when acknowledgment fails and allows retrying",async()=>{
 vi.mocked(acknowledgeSessionClosure).mockRejectedValueOnce(new Error("offline"));
 render(<SessionClosuresArea programId="program" readOnly={false}/>);
 fireEvent.click(await screen.findByRole("button",{name:"Continuar a la encuesta de cierre"}));
 await waitFor(()=>expect(acknowledgeSessionClosure).toHaveBeenCalledTimes(1));
 expect(screen.getByRole("dialog")).toBeTruthy();expect(screen.queryByRole("form")).toBeNull();
 await waitFor(()=>expect(screen.getByRole<HTMLButtonElement>("button",{name:"Continuar a la encuesta de cierre"}).disabled).toBe(false));
 fireEvent.click(screen.getByRole("button",{name:"Continuar a la encuesta de cierre"}));await screen.findByRole("form");
});
it("does not expose a survey until all activity forms were delivered",async()=>{
 vi.mocked(listMySessionClosures).mockResolvedValue({items:[{...closure,status:"LOCKED",closingComment:null,submittedCount:1,completionPercentage:40}]});
 render(<SessionClosuresArea programId="program" readOnly={false}/>);
 expect(await screen.findByText(/Envía todas las actividades/)).toBeTruthy();expect(screen.queryByRole("dialog")).toBeNull();expect(screen.queryByRole("form")).toBeNull();
});
it("keeps completed participation read-only even if its closing survey is pending",async()=>{
 vi.mocked(listMySessionClosures).mockResolvedValue({items:[pending]});
 render(<SessionClosuresArea programId="program" readOnly/>);
 await screen.findByText(/Tienes pendiente la encuesta/);expect(screen.queryByRole("form")).toBeNull();expect(screen.queryByRole("dialog")).toBeNull();
});
it("reloads closure progress after an activity submission and cancels the read on unmount",async()=>{
 vi.mocked(listMySessionClosures).mockResolvedValueOnce({items:[{...closure,status:"LOCKED",submittedCount:0,completionPercentage:0}]}).mockResolvedValueOnce({items:[closure]});
 const view=render(<SessionClosuresArea programId="program" readOnly={false}/>);await screen.findByText(/Envía todas las actividades/);
 act(()=>window.dispatchEvent(new Event("rti:session-work-changed")));await screen.findByRole("dialog");
 const signal=vi.mocked(listMySessionClosures).mock.calls[1][1]!;view.unmount();expect(signal.aborted).toBe(true);
});
