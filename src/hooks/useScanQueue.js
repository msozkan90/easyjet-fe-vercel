"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Serial queue for barcode scans.
 *
 * A scanner fires Enter as soon as a code is typed, often faster than the server
 * answers. Instead of dropping scans that arrive while a request is running (or
 * letting the input keep accumulating text), each scanned code is queued and
 * handled one after another, in order. The handler is read from a ref on every
 * dequeue, so it always sees the latest page state.
 */
export function useScanQueue(handleCode) {
  const handlerRef = useRef(handleCode);
  handlerRef.current = handleCode;
  const queueRef = useRef([]);
  const drainingRef = useRef(false);

  const drain = useCallback(async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;
    try {
      while (queueRef.current.length) {
        const code = queueRef.current.shift();
        try {
          await handlerRef.current(code);
        } catch {
          // The handler reports its own errors to the user; keep the queue moving.
        }
      }
    } finally {
      drainingRef.current = false;
    }
  }, []);

  return useCallback(
    (rawCode) => {
      const code = String(rawCode ?? "").trim();
      if (!code) return false;
      queueRef.current.push(code);
      drain();
      return true;
    },
    [drain],
  );
}

const OVERLAY_SELECTOR = [
  ".ant-modal-wrap",
  ".ant-drawer-open",
  ".ant-image-preview-wrap",
  ".ant-popover",
  ".ant-dropdown",
  ".ant-select-dropdown",
  ".ant-picker-dropdown",
].join(",");

const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

// Closed antd overlays stay in the DOM with display: none, so only rendered ones count.
const hasOpenOverlay = () =>
  Array.from(document.querySelectorAll(OVERLAY_SELECTOR)).some(
    (element) => element.getClientRects().length > 0,
  );

const isTextEntry = (element) => {
  if (!element || element === document.body) return false;
  if (element.isContentEditable) return true;
  const tag = element.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    return !NON_TEXT_INPUT_TYPES.has(String(element.type || "").toLowerCase());
  }
  return false;
};

const resolveInputElement = (inputRef) => {
  const current = inputRef.current;
  if (!current) return null;
  // antd's InputRef exposes the native element as `.input`.
  const element = current.input || current;
  return element instanceof HTMLElement ? element : null;
};

const SELECTION_GRACE_MS = 3000;
const WATCHDOG_INTERVAL_MS = 250;

/**
 * Keeps a scanner input focused so barcodes can be scanned back to back.
 *
 * Focus can leave the input without any event on the input itself: label printing
 * focuses a hidden iframe (activeElement becomes the IFRAME, not body), the iframe is
 * later removed (focus silently drops to body), the print dialog returns focus to the
 * frame, a button click keeps focus on the button, etc. So besides reacting to focus
 * events, a light watchdog re-checks every 250ms and pulls focus back.
 *
 * Focus is left alone while:
 *   - `enabled` is false (e.g. a page modal is open),
 *   - an antd modal / drawer / popover / dropdown is open,
 *   - another text field is focused (the user is typing somewhere else),
 *   - the mouse button is held down, or the user just selected some text,
 *   - the tab is hidden.
 */
export function useScanInputFocus(inputRef, { enabled = true } = {}) {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    let pointerDown = false;
    let lastPointerUpAt = 0;
    const timeouts = new Set();

    const ensureFocus = () => {
      if (!enabledRef.current) return;
      if (document.visibilityState === "hidden") return;
      if (pointerDown) return;

      const input = resolveInputElement(inputRef);
      if (!input || !input.isConnected || input.disabled) return;

      const active = document.activeElement;
      if (active === input) return;
      if (isTextEntry(active)) return;
      if (hasOpenOverlay()) return;

      const selection = window.getSelection?.();
      if (
        selection &&
        !selection.isCollapsed &&
        String(selection).trim() &&
        Date.now() - lastPointerUpAt < SELECTION_GRACE_MS
      ) {
        return;
      }

      input.focus({ preventScroll: true });
    };

    const ensureFocusSoon = () => {
      const id = window.setTimeout(() => {
        timeouts.delete(id);
        ensureFocus();
      }, 0);
      timeouts.add(id);
    };

    const handlePointerDown = () => {
      pointerDown = true;
    };
    const handlePointerUp = () => {
      pointerDown = false;
      lastPointerUpAt = Date.now();
    };

    document.addEventListener("focusout", ensureFocusSoon, true);
    document.addEventListener("visibilitychange", ensureFocusSoon);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("pointerup", handlePointerUp, true);
    document.addEventListener("pointercancel", handlePointerUp, true);
    // Moving focus into an iframe (label printing) blurs the parent window.
    window.addEventListener("blur", ensureFocusSoon);
    window.addEventListener("focus", ensureFocusSoon);
    const intervalId = window.setInterval(ensureFocus, WATCHDOG_INTERVAL_MS);
    ensureFocusSoon();

    return () => {
      document.removeEventListener("focusout", ensureFocusSoon, true);
      document.removeEventListener("visibilitychange", ensureFocusSoon);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("pointerup", handlePointerUp, true);
      document.removeEventListener("pointercancel", handlePointerUp, true);
      window.removeEventListener("blur", ensureFocusSoon);
      window.removeEventListener("focus", ensureFocusSoon);
      window.clearInterval(intervalId);
      timeouts.forEach((id) => window.clearTimeout(id));
    };
  }, [inputRef]);
}
