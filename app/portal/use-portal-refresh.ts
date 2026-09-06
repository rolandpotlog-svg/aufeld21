"use client";
import { useCallback, useEffect, useState } from "react";

// In-app refresh, not OS push. Pause background polling to keep traffic low.
export function usePortalRefresh(enabled: boolean) {
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!enabled) return;
    let last = 0;
    const update = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 1500) return;
      last = Date.now();
      refresh();
    };
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("focus", update);
    window.addEventListener("online", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      window.removeEventListener("online", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [enabled, refresh]);
  return [revision, refresh] as const;
}

// Existing portal dialogs share focus trapping, Escape and background scroll lock.
export function useDialogFocus(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const elements = () => [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter((node) => node.getClientRects().length);
    elements()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dialog.querySelector<HTMLButtonElement>('button[aria-label="Schließen"]')?.click();
      }
      if (event.key !== "Tab") return;
      const list = elements();
      const first = list[0], last = list[list.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", onKey);
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);
}
