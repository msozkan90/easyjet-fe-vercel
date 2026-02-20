// utils/normalizeListAndMeta.js
export const normalizeListAndMeta = (resp) => {
  if (Array.isArray(resp)) {
    const list = resp.filter((item) => item !== undefined && item !== null);
    return {
      list,
      total: list.length,
    };
  }

  const root = (() => {
    const d = resp?.data;
    if (Array.isArray(d) && (resp?.pagination || resp?.meta)) return resp;
    return d ?? resp;
  })();

  if (Array.isArray(root)) {
    const list = root.filter((item) => item !== undefined && item !== null);
    return {
      list,
      total: list.length,
    };
  }

  const inner = root?.data;

  const list =
    (Array.isArray(root?.data) && root.data) ||
    root?.items ||
    (Array.isArray(inner?.data) && inner.data) ||
    (Array.isArray(inner) && inner) ||
    [];

  const pg =
    root?.pagination || inner?.pagination || root?.meta || inner?.meta || {};

  const pageSizeNum = Number(pg?.pageSize ?? pg?.perPage ?? 0) || 0;
  const totalPagesNum = Number(pg?.totalPages ?? pg?.pages ?? 0) || 0;

  let total =
    Number(pg?.total ?? root?.total ?? inner?.total) ||
    (totalPagesNum && pageSizeNum ? totalPagesNum * pageSizeNum : 0) ||
    (Array.isArray(list) ? list.length : 0);

  return {
    list: Array.isArray(list) ? list : [],
    total: Number.isFinite(total) ? total : 0,
  };
};
