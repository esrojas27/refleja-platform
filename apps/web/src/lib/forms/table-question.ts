export const MAX_TABLE_ROWS = 20;
export const MAX_TABLE_COLUMNS = 10;
export const MAX_TABLE_CELL_LENGTH = 150;
export type TableLayout = { corner: string; columns: string[]; rows: string[] };
export function tableOptions(layout: TableLayout): string[] {
  return [`TABLE_V1:${layout.rows.length}:${layout.columns.length}`, layout.corner.trim(),
    ...layout.columns.map(v => v.trim()), ...layout.rows.map(v => v.trim())];
}
export function tableLayout(options: string[] = []): TableLayout | null {
  const match = /^TABLE_V1:([1-9]|1[0-9]|20):([1-9]|10)$/.exec(options[0] ?? "");
  if (!match) return null;
  const rows = Number(match[1]), columns = Number(match[2]);
  if (options.length !== 2 + rows + columns) return null;
  return { corner: options[1], columns: options.slice(2, 2 + columns), rows: options.slice(2 + columns) };
}
export function tableDefinitionError(options?: string[]): string {
  const layout = tableLayout(options);
  return !layout || [layout.corner, ...layout.columns, ...layout.rows].some(v => !v.trim() || v.trim().length > 200)
    ? "Configura la tabla y completa sus encabezados (máximo 200 caracteres)." : "";
}
export function tableAnswerError(options: string[] | undefined, values: string[]): string {
  const layout = tableLayout(options);
  return !layout || values.length !== layout.rows.length * layout.columns.length ||
    values.some(v => !v.trim() || v.trim().length > MAX_TABLE_CELL_LENGTH)
    ? "Completa todas las celdas de la tabla con un máximo de 150 caracteres por celda." : "";
}
