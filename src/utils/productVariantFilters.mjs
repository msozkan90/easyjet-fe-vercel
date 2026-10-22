// Product-scoped dropdowns share the same rules in every list table.
export const normalizeProductIds = value => [...new Set(
  (Array.isArray(value) ? value : value ? [value] : []).filter(Boolean).map(String),
)].sort();

export function getProductVariantFilterConfig(columns = []) {
  const parent = columns.find(column => column.dataIndex === "product_id" &&
    ["select", "multi"].includes(column.filter?.type));
  if (!parent) return null;
  const children = columns.flatMap(column => {
    const key = column.dataIndex || column.key;
    const match = /^(size|color)_(id|name)$/.exec(key || "");
    if (!match || !["select", "multi"].includes(column.filter?.type)) return [];
    return [{ key, table: `product_${match[1]}`, valueField: match[2], multiple: column.filter.type === "multi" }];
  });
  return children.length ? { parent: "product_id", children } : null;
}

export function resetProductVariantFilters(previous, next, config) {
  if (!config || JSON.stringify(normalizeProductIds(previous[config.parent])) ===
    JSON.stringify(normalizeProductIds(next[config.parent]))) return next;
  const result = { ...next };
  for (const child of config.children) result[child.key] = child.multiple ? [] : undefined;
  return result;
}

export async function loadProductVariantOptions(productIds, fields, fetchList) {
  const tables = [...new Set(fields.map(field => field.table))];
  const results = await Promise.all(tables.map(async table => {
    const responses = await Promise.allSettled(productIds.map(productId =>
      Promise.resolve().then(() => fetchList(table, { filters: { product_id: productId } })),
    ));
    // Never fall back to unscoped options after a failed scoped request.
    const failed = responses.find(response => response.status === "rejected");
    return [table, failed ? { rows: [], error: failed.reason } : {
      rows: responses.flatMap(response => response.value), error: null,
    }];
  }));
  const byTable = new Map(results);
  return Object.fromEntries(fields.map(field => {
    const { rows, error } = byTable.get(field.table);
    const options = new Map();
    for (const row of rows) {
      const value = row?.[field.valueField];
      if (value == null || value === "") continue;
      options.set(String(value), { value, label: row.name });
    }
    return [field.key, { error, options: [...options.values()] }];
  }));
}
