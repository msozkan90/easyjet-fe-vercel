"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchGenericList } from "@/utils/fetchGenericList";
import { loadProductVariantOptions, normalizeProductIds } from "@/utils/productVariantFilters.mjs";

export function useProductVariantFilterOptions(productIds, fields) {
  const ids = normalizeProductIds(productIds);
  const active = ids.length > 0 && fields.length > 0;
  const requestKey = active ? JSON.stringify({ ids, fields }) : "";
  const [result, setResult] = useState({ key: "", fields: {} });
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt(value => value + 1), []);

  useEffect(() => {
    if (!requestKey) return;
    let current = true;
    const { ids: selectedIds, fields: selectedFields } = JSON.parse(requestKey);
    loadProductVariantOptions(selectedIds, selectedFields, fetchGenericList).then(options => {
      if (current) setResult({ key: requestKey, attempt, fields: options });
    });
    return () => { current = false; };
  }, [requestKey, attempt]);

  // Hide the previous product's options immediately, even before the effect runs.
  const ready = result.key === requestKey && result.attempt === attempt;
  return {
    active,
    key: requestKey,
    fields: Object.fromEntries(fields.map(field => [field.key, {
      options: ready ? result.fields[field.key]?.options || [] : [],
      error: ready ? result.fields[field.key]?.error : null,
      loading: active && !ready,
    }])),
    reload,
  };
}
