"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

export function ProgramModal({ children, onClose, titleId, closeLabel }: {
  children: ReactNode; onClose: () => void; titleId: string; closeLabel: string;
}) {
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") onClose(); }
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", closeOnEscape); };
  }, [onClose]);

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/35 p-0 backdrop-blur-sm sm:items-center sm:p-6"
    onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
      className="w-full overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl outline-none sm:max-w-2xl sm:rounded-3xl">
      <div className="rti-modal-scroll max-h-[92vh] overflow-y-auto p-6 sm:p-8">
        <div className="mb-5 flex justify-end">
          <button type="button" onClick={onClose}
            className="inline-flex size-10 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label={closeLabel}><X aria-hidden="true" className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  </div>;
}
