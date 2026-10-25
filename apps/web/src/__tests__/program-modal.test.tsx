import { cleanup,fireEvent,render,screen } from "@testing-library/react";
import { afterEach,expect,it,vi } from "vitest";
import { ProgramModal } from "@/components/programs/program-modal";

afterEach(()=>{cleanup();document.body.style.overflow="";});

it("focuses only on mount and keeps Escape bound to the latest close handler",()=>{
 const first=vi.fn();const latest=vi.fn();
 const content=<><h2 id="modal-title">Formulario</h2><input aria-label="Nombre"/></>;
 const view=render(<ProgramModal titleId="modal-title" closeLabel="Cerrar" onClose={first}>{content}</ProgramModal>);
 expect(document.activeElement).toBe(screen.getByRole("dialog"));
 const input=screen.getByLabelText("Nombre");input.focus();
 view.rerender(<ProgramModal titleId="modal-title" closeLabel="Cerrar" onClose={latest}>{content}</ProgramModal>);
 expect(document.activeElement).toBe(input);
 fireEvent.keyDown(document,{key:"Escape"});expect(latest).toHaveBeenCalledOnce();expect(first).not.toHaveBeenCalled();
});

it("preserves the scroll lock across rerenders and restores it on unmount",()=>{
 document.body.style.overflow="auto";
 const view=render(<ProgramModal titleId="title" closeLabel="Cerrar" onClose={()=>{}}><h2 id="title">Formulario</h2></ProgramModal>);
 expect(document.body.style.overflow).toBe("hidden");
 view.rerender(<ProgramModal titleId="title" closeLabel="Cerrar" onClose={()=>{}}><h2 id="title">Formulario actualizado</h2></ProgramModal>);
 expect(document.body.style.overflow).toBe("hidden");view.unmount();expect(document.body.style.overflow).toBe("auto");
});
