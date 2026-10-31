"use client";

import { useEffect, useRef, type ReactNode } from "react";

export default function Dialog({ title, children, onClose, wide = false, busy = false }: {
  title: string; children: ReactNode; onClose: () => void; wide?: boolean; busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const dialog = ref.current!;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const scrollY = window.scrollY;
    const previousStyle = document.body.getAttribute("style");
    // Fixed-body locking avoids iOS background scroll and restores its exact position.
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    dialog.showModal();
    return () => {
      dialog.close();
      if (previousStyle === null) document.body.removeAttribute("style");
      else document.body.setAttribute("style", previousStyle);
      window.scrollTo({ top: scrollY, behavior: "instant" });
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog ref={ref} aria-label={title} className={`dialog ${wide ? "dialog-wide" : ""}`}
      onCancel={event => { event.preventDefault(); if (!busy) close.current(); }}
      onClick={event => {
        if (event.target !== event.currentTarget || busy) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close.current();
      }}>
      <div className="dialog-top"><span className="eyebrow">CRUISE GETAWAYS / {title}</span><button className="icon-button close-button" aria-label="Close dialog" onClick={onClose} disabled={busy}><span aria-hidden="true">×</span></button></div>
      {children}
    </dialog>
  );
}
