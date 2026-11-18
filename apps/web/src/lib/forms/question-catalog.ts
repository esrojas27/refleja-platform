/** Shared definitions for activity and session forms, independent of API transport. */
export const QUESTION_TYPE_LABELS = {
  AGREEMENT_SCALE: "Escala · Nivel de acuerdo",
  LIKELIHOOD_SCALE: "Escala · Probabilidad",
  NUMERIC_SCALE: "Escala numérica · 1–5",
  OPEN_TEXT: "Respuesta abierta",
  EMOTION_MULTI_SELECT: "Emociones · Máximo 2",
  SINGLE_CHOICE_LETTERS: "Selección única · Lista con letras",
  IMAGE: "Imagen",
  MULTIPLE_CHOICE_WORDS: "Selección múltiple · Palabras",
  SINGLE_CHOICE_WORDS: "Selección única · Palabras",
} as const;
export type EvaluationQuestionType = keyof typeof QUESTION_TYPE_LABELS;
export type FormQuestion = { id: string; prompt: string; type: EvaluationQuestionType; position: number; options?: string[] };
export const AGREEMENT_OPTIONS = ["Totalmente en desacuerdo", "En desacuerdo", "Ni de acuerdo ni en desacuerdo", "De acuerdo", "Totalmente de acuerdo"];
export const LIKELIHOOD_OPTIONS = ["Muy improbable", "Improbable", "No estoy seguro(a)", "Probable", "Muy probable"];
export const NUMERIC_SCALE_OPTIONS = ["1", "2", "3", "4", "5"];
export const EMOTION_OPTIONS = ["Inspirado(a)", "Motivado(a)", "Reflexivo(a)", "Sorprendido(a)", "Retado(a)", "Confundido(a)", "Indiferente"];
export const MAX_QUESTION_OPTIONS = 100;
export const MAX_OPTION_LENGTH = 200;
export const activityOnlyQuestion = (type: EvaluationQuestionType) => type === "IMAGE" || type === "MULTIPLE_CHOICE_WORDS";
export const MAX_ACTIVITY_IMAGE_BYTES = 10 * 1024 * 1024;
export const ACTIVITY_IMAGE_TYPES = "image/jpeg,image/png,image/webp";
export const hasCustomOptions = (type: EvaluationQuestionType) => type === "SINGLE_CHOICE_LETTERS" || type === "SINGLE_CHOICE_WORDS" || type === "MULTIPLE_CHOICE_WORDS";
export const parseQuestionOptions = (text: string) => text.split(/\r?\n/).map(option => option.trim()).filter(Boolean);
export const MIN_WORD_SELECTIONS = 3;
export const MAX_WORD_SELECTIONS = 8;
export const WORD_SELECTION_HELP = "Selecciona entre 3 y 8 opciones.";
export function questionOptionsError(options: string[], type?: EvaluationQuestionType) {
  const minimum = type === "MULTIPLE_CHOICE_WORDS" ? MIN_WORD_SELECTIONS : 2;
  if (options.length < minimum || options.length > MAX_QUESTION_OPTIONS) return `Agrega entre ${minimum} y ${MAX_QUESTION_OPTIONS} opciones, una por línea.`;
  if (options.some(option => !option.trim() || option.length > MAX_OPTION_LENGTH)) return "Cada opción debe tener entre 1 y 200 caracteres.";
  if (new Set(options.map(option => option.toLowerCase())).size !== options.length) return "Hay opciones repetidas. Cada opción debe ser diferente.";
  return "";
}
export function optionLetter(index: number): string {
  let value = index + 1;
  let label = "";
  while (value > 0) { value--; label = String.fromCharCode(97 + value % 26) + label; value = Math.floor(value / 26); }
  return label;
}
