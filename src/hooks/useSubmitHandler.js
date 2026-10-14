"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Wraps an (optionally async) submit callback with a `submitting` flag and
 * ignores repeated submits while the previous one is still running.
 */
export function useSubmitHandler(onSubmit) {
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  const handler = useCallback(
    async (...args) => {
      if (inFlight.current) return undefined;
      inFlight.current = true;
      setSubmitting(true);
      try {
        return await onSubmit?.(...args);
      } finally {
        inFlight.current = false;
        setSubmitting(false);
      }
    },
    [onSubmit],
  );

  return [handler, submitting];
}
