"use client";

import { useCallback, useRef } from "react";

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

/**
 * Re-focuses a scan input when focus fell back to the page body (e.g. after a click
 * on empty space), so the next scan lands in the input. Focus that moved to another
 * control (a button, a modal) is left alone.
 */
export function reclaimScanFocus(inputRef) {
  window.setTimeout(() => {
    const active = document.activeElement;
    if (!active || active === document.body) {
      inputRef.current?.focus();
    }
  }, 0);
}
