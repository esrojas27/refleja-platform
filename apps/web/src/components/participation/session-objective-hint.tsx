"use client";

import { Popover } from "@base-ui/react/popover";
import { Lightbulb } from "lucide-react";

export function SessionObjectiveHint({ sessionName, objective }: {
  sessionName: string; objective?: string | null;
}) {
  if (!objective?.trim()) return null;
  return <Popover.Root>
    <Popover.Trigger openOnHover delay={150} closeDelay={100}
      aria-label={`Ver objetivo de la sesión ${sessionName}`}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-accent text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      <Lightbulb aria-hidden="true" className="size-4" />
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner sideOffset={8} collisionPadding={16} className="z-50">
        <Popover.Popup className="max-h-[min(24rem,70vh)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-border bg-card p-4 text-sm shadow-lg">
          <Popover.Title className="font-semibold">Objetivo de sesión</Popover.Title>
          <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed">{objective}</p>
          <Popover.Close className="rti-link mt-3">Cerrar</Popover.Close>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>;
}
