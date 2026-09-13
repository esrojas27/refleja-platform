"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  getMyProgram,
  listMyPrograms,
  myProgramErrorMessage,
  myProgramsPath,
  ParticipationRequestError,
  type MyProgram,
  type PageResult,
} from "@/lib/participation/participation-api";

const button = "min-h-10 rounded-md border px-4 py-2 text-sm disabled:opacity-50";

export function MyProgramArea({ mode, programId }: { mode: "list" | "detail"; programId?: string }) {
  return <section className="w-full max-w-3xl rounded-xl border bg-background p-5 shadow-sm sm:p-8">
    <p className="text-sm font-medium text-muted-foreground">Área del colaborador</p>
    <h1 className="mt-2 text-2xl font-semibold">{mode === "detail" ? "Detalle del programa" : "Mis programas"}</h1>
    <p className="mt-2 text-sm text-muted-foreground">
      {mode === "detail" ? "Información básica de uno de tus programas asignados." : "Programas asociados a tus inscripciones activas o completadas."}
    </p>
    {mode === "detail" && programId ? <MyProgramDetail programId={programId} /> : <MyProgramList />}
    <nav aria-label="Navegación de mis programas" className="mt-6 flex flex-wrap gap-4 text-sm">
      {mode === "detail" && <Link href={myProgramsPath()} className="underline">Volver a Mis programas</Link>}
      <Link href="/account" className="underline">Volver a Cuenta</Link>
    </nav>
  </section>;
}

function MyProgramList() {
  const [result, setResult] = useState<PageResult<MyProgram>>();
  const [page, setPage] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(true);
  const [message, setMessage] = useState("Cargando tus programas…");
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    listMyPrograms(page, controller.signal).then(data => {
      if (controller.signal.aborted) return;
      setResult(data);
      setMessage(data.items.length ? "" : "No tienes programas asignados disponibles.");
    }).catch(error => {
      if (controller.signal.aborted) return;
      setMessage(myProgramErrorMessage(error));
      setNeedsLogin(error instanceof ParticipationRequestError && error.status === 401);
    }).finally(() => { if (!controller.signal.aborted) setPending(false); });
    return () => controller.abort();
  }, [page, attempt]);

  function load(nextPage = page) {
    setResult(undefined); setPending(true); setNeedsLogin(false); setMessage("Cargando tus programas…");
    setPage(nextPage); setAttempt(value => value + 1);
  }

  return <div className="mt-5 space-y-4">
    {message && <p role="status" className="text-sm">{message}</p>}
    {needsLogin && <Link href="/login" className="inline-block text-sm underline">Iniciar sesión</Link>}
    {result && <>
      <ul className="space-y-3">{result.items.map(program => <li key={program.id} className="rounded-md border p-4">
        <Link href={myProgramsPath(program.id)} className="break-words font-medium underline">{program.name}</Link>
        <p className="mt-1 break-words text-sm text-muted-foreground">{program.organizationName}</p>
        <p className="mt-1 text-sm">{program.startDate ?? "Sin fecha"} — {program.endDate ?? "Sin fecha"}</p>
        <p className="mt-1 text-sm">{program.status}</p>
      </li>)}</ul>
      <p className="text-sm">{result.totalElements} programas · Página {result.page + 1} de {Math.max(1, result.totalPages)}</p>
      <div className="flex flex-wrap gap-3">
        <button className={button} disabled={pending || page === 0} onClick={() => load(page - 1)}>Anterior</button>
        <button className={button} disabled={pending || page + 1 >= result.totalPages} onClick={() => load(page + 1)}>Siguiente</button>
      </div>
    </>}
    <button className={button} disabled={pending} onClick={() => load()}>Actualizar listado</button>
  </div>;
}

function MyProgramDetail({ programId }: { programId: string }) {
  const [program, setProgram] = useState<MyProgram>();
  const [message, setMessage] = useState("Cargando programa…");
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getMyProgram(programId, controller.signal).then(data => {
      if (!controller.signal.aborted) { setProgram(data); setMessage(""); }
    }).catch(error => {
      if (controller.signal.aborted) return;
      setMessage(myProgramErrorMessage(error));
      setNeedsLogin(error instanceof ParticipationRequestError && error.status === 401);
    });
    return () => controller.abort();
  }, [programId]);

  return <div className="mt-5">
    {message && <p role="status" className="text-sm">{message}</p>}
    {needsLogin && <Link href="/login" className="mt-3 inline-block text-sm underline">Iniciar sesión</Link>}
    {program && <dl className="space-y-2 break-words">
      <dt className="font-medium">Nombre</dt><dd>{program.name}</dd>
      <dt className="font-medium">Organización</dt><dd>{program.organizationName}</dd>
      <dt className="font-medium">Descripción</dt><dd className="whitespace-pre-wrap">{program.description || "Sin descripción"}</dd>
      <dt className="font-medium">Estado</dt><dd>{program.status}</dd>
      <dt className="font-medium">Inicio</dt><dd>{program.startDate ?? "Sin fecha"}</dd>
      <dt className="font-medium">Fin</dt><dd>{program.endDate ?? "Sin fecha"}</dd>
    </dl>}
  </div>;
}
