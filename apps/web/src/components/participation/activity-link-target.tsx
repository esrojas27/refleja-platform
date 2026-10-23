"use client";

import { useEffect } from "react";

export function revealActivityTarget(activityId: string) {
  const target = document.getElementById(`activity-${activityId}`);
  const details = target?.querySelector("details");
  if (!target || !details) return;
  details.open = true;
  target.scrollIntoView?.({ block: "start" });
  details.querySelector("summary")?.focus({ preventScroll: true });
}

/** Open an activity directly from the inbox or the next-activity shortcut. */
export function ActivityLinkTarget() {
  useEffect(() => {
    function reveal() {
      if (!/^#activity-[0-9a-f-]{36}$/i.test(window.location.hash)) return;
      revealActivityTarget(window.location.hash.slice("#activity-".length));
    }
    reveal(); window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, []);
  return null;
}
