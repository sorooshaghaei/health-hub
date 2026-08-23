import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

import "./dialog.css";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const dialogStack = [];
const isolatedElements = new Map();
let previousBodyOverflow = null;

function restoreAttribute(element, name, state) {
  if (state.present) element.setAttribute(name, state.value ?? "");
  else element.removeAttribute(name);
}

function isolateElement(element) {
  if (!isolatedElements.has(element)) {
    isolatedElements.set(element, {
      inert: { present: element.hasAttribute("inert"), value: element.getAttribute("inert") },
      ariaHidden: { present: element.hasAttribute("aria-hidden"), value: element.getAttribute("aria-hidden") },
    });
  }
  element.setAttribute("inert", "");
  element.setAttribute("aria-hidden", "true");
}

function restoreElement(element) {
  const state = isolatedElements.get(element);
  if (!state) return;
  restoreAttribute(element, "inert", state.inert);
  restoreAttribute(element, "aria-hidden", state.ariaHidden);
  isolatedElements.delete(element);
}

function syncDialogIsolation() {
  const topLayer = dialogStack.at(-1)?.layer ?? null;

  for (const element of [...document.body.children]) {
    if (topLayer && element !== topLayer) isolateElement(element);
    else restoreElement(element);
  }

  if (topLayer) {
    if (previousBodyOverflow === null) previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return;
  }

  for (const element of [...isolatedElements.keys()]) restoreElement(element);
  if (previousBodyOverflow !== null) {
    document.body.style.overflow = previousBodyOverflow;
    previousBodyOverflow = null;
  }
}

function topDialog() {
  return dialogStack.at(-1) ?? null;
}

function isUsableFocusTarget(element) {
  if (!element?.isConnected || element === document.body || element.disabled) return false;
  if (element.closest("[hidden], [inert], [aria-hidden='true']")) return false;
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

function focusableElements(container) {
  return [...container.querySelectorAll(FOCUSABLE)].filter((element) => (
    isUsableFocusTarget(element)
  ));
}

function focusElement(element) {
  if (!isUsableFocusTarget(element)) return false;
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
  return document.activeElement === element;
}

function focusInside(entry, preferInitial = false) {
  if (!entry?.panel?.isConnected) return;
  const preferred = preferInitial && entry.initialFocusSelector
    ? entry.panel.querySelector(entry.initialFocusSelector)
    : null;
  focusElement(preferred)
    || focusElement(focusableElements(entry.panel)[0])
    || focusElement(entry.panel);
}

function returnFocus(entry) {
  window.requestAnimationFrame(() => {
    const activeDialog = topDialog();
    if (activeDialog) {
      if (activeDialog.panel.contains(entry.opener) && focusElement(entry.opener)) return;
      if (!activeDialog.panel.contains(document.activeElement)) focusInside(activeDialog);
      return;
    }

    let selected = null;
    if (entry.returnFocusSelector) {
      try {
        selected = document.querySelector(entry.returnFocusSelector);
      } catch {
        selected = null;
      }
    }
    focusElement(selected) || focusElement(entry.opener);
  });
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
  role = "dialog",
  onClose,
  children,
}) {
  const layerRef = useRef(null);
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const canCloseRef = useRef(canClose);
  onCloseRef.current = onClose;
  canCloseRef.current = canClose;

  useLayoutEffect(() => {
    const layer = layerRef.current;
    const panel = panelRef.current;
    const entry = {
      initialFocusSelector,
      layer,
      opener: document.activeElement,
      panel,
      returnFocusSelector,
    };
    dialogStack.push(entry);
    syncDialogIsolation();

    const frame = window.requestAnimationFrame(() => {
      if (topDialog() === entry) focusInside(entry, true);
    });

    function onKeyDown(event) {
      if (topDialog() !== entry) return;
      if (event.key === "Escape") {
        if (canCloseRef.current) {
          event.preventDefault();
          event.stopPropagation();
          onCloseRef.current?.();
        }
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const elements = focusableElements(panel);
      if (!elements.length) {
        event.preventDefault();
        focusElement(panel);
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      const activeElement = document.activeElement;
      if (!panel.contains(activeElement)) {
        event.preventDefault();
        focusElement(event.shiftKey ? last : first);
      } else if (event.shiftKey && (activeElement === first || activeElement === panel)) {
        event.preventDefault();
        focusElement(last);
      } else if (!event.shiftKey && (activeElement === last || activeElement === panel)) {
        event.preventDefault();
        focusElement(first);
      }
    }

    function onFocusIn(event) {
      if (topDialog() === entry && !panel.contains(event.target)) focusInside(entry);
    }

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn, true);
      const index = dialogStack.indexOf(entry);
      if (index >= 0) dialogStack.splice(index, 1);
      syncDialogIsolation();
      returnFocus(entry);
    };
  }, [initialFocusSelector, returnFocusSelector]);

  const dialog = <div
    ref={layerRef}
    className={backdropClassName}
    data-dialog-layer="true"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget && topDialog()?.layer === event.currentTarget && canCloseRef.current) onCloseRef.current?.();
    }}
  >
    <section
      ref={panelRef}
      className={className}
      role={role}
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
