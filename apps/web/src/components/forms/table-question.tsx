"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X, Table2, Plus, Trash2 } from "lucide-react";
import { MAX_TABLE_ROWS, MAX_TABLE_COLUMNS, MAX_TABLE_CELL_LENGTH, tableLayout, tableOptions,
  tableDefinitionError, type TableLayout } from "@/lib/forms/table-question";

function TableDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (typeof element?.showModal === "function") element.showModal();
    else element?.setAttribute("open", "");
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return createPortal(<dialog ref={ref} aria-labelledby={titleId}
    className="fixed inset-0 m-auto max-h-[94dvh] w-[calc(100%-1rem)] max-w-6xl overflow-y-auto rounded-2xl border border-border bg-card p-4 text-foreground shadow-2xl backdrop:bg-black/45 sm:p-6"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); event.preventDefault(); onClose(); } }}
    onClick={event => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose(); } }}>
    <div className="mb-4 flex items-start justify-between gap-3"><h2 id={titleId} className="text-xl font-semibold">{title}</h2>
      <button type="button" aria-label="Cerrar tabla" className="rti-button-secondary shrink-0" onClick={onClose}><X className="size-4" aria-hidden="true" /></button></div>
    {children}
  </dialog>, document.body);
}

export function TablePreview({ options, values = [], compact = false }: { options?: string[]; values?: string[]; compact?: boolean }) {
  const layout = tableLayout(options);
  if (!layout) return <p className="mt-3 text-sm text-muted-foreground">Configura los encabezados de la tabla.</p>;
  const rows = compact ? layout.rows.slice(0, 3) : layout.rows;
  const columns = compact ? layout.columns.slice(0, 3) : layout.columns;
  return <div className="mt-3 max-w-full overflow-x-auto rounded-xl border border-border">
    <table className="w-full border-collapse text-left text-sm"><thead><tr>
      <th scope="col" className="min-w-28 border border-border bg-muted p-3 [overflow-wrap:anywhere]">{layout.corner}</th>
      {columns.map((column, index) => <th scope="col" key={index} className="min-w-36 border border-border bg-muted p-3 [overflow-wrap:anywhere]">{column}</th>)}
    </tr></thead><tbody>{rows.map((row, r) => <tr key={r}>
      <th scope="row" className="border border-border bg-muted/50 p-3 [overflow-wrap:anywhere]">{row}</th>
      {columns.map((_, c) => <td key={c} className="max-w-72 border border-border p-3 whitespace-pre-wrap [overflow-wrap:anywhere]">{values[r * layout.columns.length + c] || "—"}</td>)}
    </tr>)}</tbody></table>
    {compact && (rows.length < layout.rows.length || columns.length < layout.columns.length) && <p className="p-2 text-xs text-muted-foreground">Vista parcial · {layout.rows.length} filas × {layout.columns.length} columnas</p>}
  </div>;
}

export function TableDefinitionEditor({ options, disabled, invalid, id, onChange, initiallyOpen = false }: {
  options?: string[]; disabled: boolean; invalid?: boolean; id: string; onChange: (options: string[]) => void; initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return <div className="mt-4">
    <button id={id} type="button" className="rti-button-secondary" aria-describedby={invalid ? `${id}-error` : undefined} disabled={disabled} onClick={() => setOpen(true)}>
      <Table2 aria-hidden="true" className="size-4" />{tableLayout(options) ? "Editar tabla" : "Configurar tabla"}</button>
    {invalid && <p id={`${id}-error`} className="mt-2 text-sm text-destructive">{tableDefinitionError(options)}</p>}
    <TablePreview options={options} compact />
    {open && <TableConfiguration options={options} onClose={() => setOpen(false)} onSave={value => { onChange(value); setOpen(false); }} />}
  </div>;
}

function TableConfiguration({ options, onSave, onClose }: { options?: string[]; onSave: (options: string[]) => void; onClose: () => void }) {
  const [layout, setLayout] = useState<TableLayout>(() => tableLayout(options) ?? { corner: "", columns: ["", ""], rows: ["", ""] });
  const [error, setError] = useState("");
  function header(kind: "columns" | "rows", index: number, value: string) {
    setLayout(current => ({ ...current, [kind]: current[kind].map((v, i) => i === index ? value : v) })); setError("");
  }
  function save() {
    const value = tableOptions(layout), message = tableDefinitionError(value);
    if (message) { setError(message); return; }
    onSave(value);
  }
  return <TableDialog title="Configurar tabla" onClose={onClose}>
    <p className="text-sm text-muted-foreground">Escribe solo la primera fila y la primera columna: serán las instrucciones. El colaborador completará el interior. Hasta 20 filas y 10 columnas de respuestas. En pantallas pequeñas, desliza la tabla hacia los lados.</p>
    <div className="my-4 flex flex-wrap gap-3">
      <button type="button" className="rti-button-secondary" disabled={layout.columns.length >= MAX_TABLE_COLUMNS} onClick={() => setLayout(v => ({ ...v, columns: [...v.columns, ""] }))}><Plus aria-hidden="true" className="size-4" />Agregar columna</button>
      <button type="button" className="rti-button-secondary" disabled={layout.rows.length >= MAX_TABLE_ROWS} onClick={() => setLayout(v => ({ ...v, rows: [...v.rows, ""] }))}><Plus aria-hidden="true" className="size-4" />Agregar fila</button>
      <span className="self-center text-sm">{layout.rows.length} / 20 filas · {layout.columns.length} / 10 columnas</span>
    </div>
    <div className="max-h-[55dvh] overflow-auto rounded-xl border border-border">
      <table className="border-collapse text-sm"><thead><tr>
        <th className="min-w-48 border border-border bg-muted p-2"><textarea aria-label="Encabezado de la primera columna" placeholder="Ej. Ámbito" maxLength={200} value={layout.corner} className="rti-field min-h-24 resize" onChange={e => { setLayout(v => ({ ...v, corner: e.target.value })); setError(""); }} /></th>
        {layout.columns.map((column, index) => <th key={index} className="min-w-56 border border-border bg-muted p-2">
          <textarea aria-label={`Encabezado de columna ${index + 1}`} placeholder={`Columna ${index + 1}`} maxLength={200} className="rti-field min-h-24 resize" value={column} onChange={e => header("columns", index, e.target.value)} />
          <button type="button" aria-label={`Eliminar columna ${index + 1}`} className="mt-2 rounded-lg border p-2 disabled:opacity-40" disabled={layout.columns.length === 1} onClick={() => setLayout(v => ({ ...v, columns: v.columns.filter((_, i) => i !== index) }))}><Trash2 aria-hidden="true" className="size-4" /></button>
        </th>)}
      </tr></thead><tbody>{layout.rows.map((row, index) => <tr key={index}>
        <th className="border border-border bg-muted p-2">
          <textarea aria-label={`Encabezado de fila ${index + 1}`} placeholder={`Fila ${index + 1}`} maxLength={200} className="rti-field min-h-24 resize" value={row} onChange={e => header("rows", index, e.target.value)} />
          <button type="button" aria-label={`Eliminar fila ${index + 1}`} className="mt-2 rounded-lg border p-2 disabled:opacity-40" disabled={layout.rows.length === 1} onClick={() => setLayout(v => ({ ...v, rows: v.rows.filter((_, i) => i !== index) }))}><Trash2 aria-hidden="true" className="size-4" /></button>
        </th>
        {layout.columns.map((_, c) => <td key={c} className="border border-border bg-background p-3 text-center text-muted-foreground">Respuesta del colaborador</td>)}
      </tr>)}</tbody></table>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    <div className="mt-5 flex flex-wrap gap-3"><button type="button" className="rti-button-primary" onClick={save}>Guardar tabla</button>
      <button type="button" className="rti-button-secondary" onClick={onClose}>Cancelar</button></div>
  </TableDialog>;
}

export function TableAnswerInput({ id, prompt, options, values, disabled, onChange }: {
  id: string; prompt: string; options?: string[]; values: string[]; disabled: boolean; onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const layout = tableLayout(options);
  if (!layout) return <p role="alert">Esta tabla no está disponible. Contacta a tu consultor.</p>;
  const total = layout.rows.length * layout.columns.length;
  const complete = values.filter(v => v.trim()).length;
  function cell(index: number, text: string) {
    const next = Array.from({ length: total }, (_, i) => values[i] ?? "");
    next[index] = text; onChange(next);
  }
  return <div className="mt-3">
    <div className="relative rounded-xl focus-within:ring-2 focus-within:ring-ring">
      <TablePreview options={options} values={values} compact />
      <button id={id} type="button" disabled={disabled} aria-label={`Abrir tabla: ${prompt}`} className="absolute inset-0 rounded-xl disabled:cursor-not-allowed" onClick={() => setOpen(true)} />
    </div>
    <button type="button" disabled={disabled} className="rti-button-secondary mt-3" onClick={() => setOpen(true)}><Table2 aria-hidden="true" className="size-4" />Completar tabla · {complete}/{total} celdas</button>
    {open && <TableDialog title={prompt} onClose={() => setOpen(false)}>
      <p className="mb-4 text-sm text-muted-foreground">Completa todas las celdas antes de enviar el formulario. Máximo 150 caracteres por celda. Puedes arrastrar la esquina de cada recuadro para ampliarlo. En pantallas pequeñas, desliza la tabla hacia los lados.</p>
      <div className="max-h-[65dvh] overflow-auto rounded-xl border border-border">
        <table className="border-collapse text-left text-sm"><thead><tr>
          <th scope="col" className="min-w-40 border border-border bg-muted p-3 [overflow-wrap:anywhere]">{layout.corner}</th>
          {layout.columns.map((column, c) => <th scope="col" key={c} className="min-w-60 border border-border bg-muted p-3 [overflow-wrap:anywhere]">{column}</th>)}
        </tr></thead><tbody>{layout.rows.map((row, r) => <tr key={r}>
          <th scope="row" className="border border-border bg-muted/60 p-3 [overflow-wrap:anywhere]">{row}</th>
          {layout.columns.map((column, c) => { const index = r * layout.columns.length + c; return <td key={c} className="border border-border p-2">
            <textarea aria-label={`${row} / ${column}`} required maxLength={MAX_TABLE_CELL_LENGTH} disabled={disabled} value={values[index] ?? ""}
              className="rti-field min-h-28 min-w-52 resize" onChange={event => cell(index, event.target.value)} />
            <p className="text-right text-xs text-muted-foreground">{values[index]?.length ?? 0}/150</p>
          </td>; })}
        </tr>)}</tbody></table>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm" aria-live="polite">{complete}/{total} celdas completas</p>
        <button type="button" className="rti-button-primary" onClick={() => setOpen(false)}>Volver al formulario</button></div>
      <p className="mt-3 text-xs text-muted-foreground">Las respuestas quedan en este formulario. Para entregarlas, pulsa el botón de envío del formulario.</p>
    </TableDialog>}
  </div>;
}
