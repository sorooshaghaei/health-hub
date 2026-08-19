import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import "./dialog.css";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function focusableElements(container) {
  return [...container.querySelectorAll(FOCUSABLE)].filter((element) => (
    element.getAttribute("aria-hidden") !== "true"
  ));
}

export default function Dialog({
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  backdropClassName = "device-modal-backdrop",
  className = "device-modal",
  canClose = true,
  initialFocusSelector = "[data-dialog-initial-focus]",
  returnFocusSelector,
  onClose,
  children,
}) {
  const panelRef = useRef(null);
  const returnFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const canCloseRef = useRef(canClose);
  onCloseRef.current = onClose;
  canCloseRef.current = canClose;

  useEffect(() => {
    const panel = panelRef.current;
    returnFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => {
      const preferred = initialFocusSelector ? panel?.querySelector(initialFocusSelector) : null;
      (preferred || focusableElements(panel || document.body)[0] || panel)?.focus();
    });

    function onKeyDown(event) {
      if (event.key === "Escape") {
        if (canCloseRef.current) {
          event.preventDefault();
          onCloseRef.current?.();
        }
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const elements = focusableElements(panel);
      if (!elements.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      const target = returnFocusSelector ? document.querySelector(returnFocusSelector) : returnFocusRef.current;
      if (target?.isConnected) window.requestAnimationFrame(() => target.focus());
    };
  }, [initialFocusSelector, returnFocusSelector]);

  const dialog = <div
    className={backdropClassName}
    onMouseDown={(event) => {
      if (event.target === event.currentTarget && canCloseRef.current) onCloseRef.current?.();
    }}
  >
    <section
      ref={panelRef}
      className={className}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      tabIndex={-1}
    >
      {children}
    </section>
  </div>;

  return createPortal(dialog, document.body);
}
