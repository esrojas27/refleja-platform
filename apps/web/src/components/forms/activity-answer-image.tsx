"use client";

/* eslint-disable @next/next/no-img-element -- authenticated local blob URLs cannot use the image optimizer */
import { useEffect, useState } from "react";
import { ACTIVITY_IMAGE_TYPES, MAX_ACTIVITY_IMAGE_BYTES } from "@/lib/forms/question-catalog";
import { fetchActivityImage } from "@/lib/participation/activity-api";

function useObjectUrl(blob?: Blob) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return;
    const next = URL.createObjectURL(blob);
    let active = true;
    queueMicrotask(() => { if (active) setUrl(next); });
    return () => { active = false; URL.revokeObjectURL(next); };
  }, [blob]);
  return blob ? url : undefined;
}

export function ActivityAnswerImage({ programId, imageId, organizationId }: {
  programId: string; imageId: string; organizationId?: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ blob?: Blob; error?: boolean }>();
  const url = useObjectUrl(result?.blob);
  useEffect(() => {
    if (!attempt) return;
    const controller = new AbortController();
    fetchActivityImage(programId, imageId, controller.signal, organizationId)
      .then(blob => { if (!controller.signal.aborted) setResult({ blob }); })
      .catch(() => { if (!controller.signal.aborted) setResult({ error: true }); });
    return () => controller.abort();
  }, [attempt, programId, imageId, organizationId]);

  if (url) return <a className="rti-link mt-2 inline-block" href={url} target="_blank" rel="noopener noreferrer">
    <img className="max-h-64 max-w-full rounded-lg object-contain" src={url} alt="Imagen adjunta a la respuesta" />
    <span>Ampliar imagen (abre otra pestaña)</span>
  </a>;
  if (attempt && !result?.error) return <p role="status" className="mt-2">Cargando imagen…</p>;
  return <div className="mt-2">
    {result?.error && <p role="status">No se pudo cargar la imagen.</p>}
    <button type="button" className="rti-button-secondary" onClick={() => { setResult(undefined); setAttempt(value => value + 1); }}>
      {result?.error ? "Reintentar" : "Ver imagen adjunta"}
    </button>
  </div>;
}

export function ActivityImageInput({ id, prompt, file, imageId, programId, disabled, onChange }: {
  id: string; prompt: string; file?: File; imageId?: string; programId?: string; disabled: boolean;
  onChange: (file?: File) => void;
}) {
  const [error, setError] = useState("");
  const url = useObjectUrl(file);
  return <div className="mt-3">
    <input className="rti-field" id={id} aria-label={`Adjuntar imagen: ${prompt}`} aria-describedby={`${id}-help`}
      type="file" accept={ACTIVITY_IMAGE_TYPES} disabled={disabled} onChange={event => {
        const next = event.target.files?.[0];
        event.target.value = "";
        if (!next) return;
        if ((!ACTIVITY_IMAGE_TYPES.split(",").includes(next.type) && (next.type || !/\.(jpe?g|png|webp)$/i.test(next.name)))
          || !next.size || next.size > MAX_ACTIVITY_IMAGE_BYTES) {
          setError("Elige una imagen JPG, PNG o WebP de hasta 10 MB.");
          return;
        }
        setError("");
        onChange(next);
      }} />
    <p id={`${id}-help`} className="mt-2 text-xs text-muted-foreground">Una imagen JPG, PNG o WebP de hasta 10 MB.</p>
    {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    {file && url && <img className="mt-2 max-h-56 max-w-full rounded-lg object-contain" src={url} alt="Vista previa de la imagen" />}
    {!file && imageId && programId && <ActivityAnswerImage key={imageId} programId={programId} imageId={imageId} />}
    {(file || imageId) && <button type="button" disabled={disabled} className="rti-button-secondary mt-2"
      onClick={() => { setError(""); onChange(undefined); }}>Quitar imagen</button>}
  </div>;
}
