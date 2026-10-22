"use client";

import { useEffect } from "react";

/** Open the three nested accordions before focusing an activity from the inbox. */
export function ActivityLinkTarget() {
  useEffect(() => {
    function reveal() {
      if (!/^#activity-[0-9a-f-]{36}$/i.test(window.location.hash)) return;
      const target = document.getElementById(window.location.hash.slice(1));
      if (!target) return;
      let ancestor: HTMLElement | null = target;
      while (ancestor) {
        if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
        ancestor = ancestor.parentElement;
      }
      const details = target.querySelector("details");
      if (details) details.open = true;
      target.scrollIntoView?.({ block: "center" });
      details?.querySelector("summary")?.focus({ preventScroll: true });
    }
    reveal(); window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, []);
  return null;
}
