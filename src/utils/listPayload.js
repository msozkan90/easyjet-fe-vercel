// src/utils/listPayload.js

// Basit yardımcı: dizi içindeki string sayıları number'a çevirir
const toNumberArray = (arr) =>
  Array.isArray(arr)
    ? arr.map((x) => (typeof x === "string" ? Number(x) : x))
    : arr;

/**
 * UI'dan gelen { page, pageSize, sort, filters } → API'nin beklediği payload
 *
 * @param {Object} ctx
 * @param {number} ctx.page
 * @param {number} ctx.pageSize
 * @param {{orderBy?: string, orderDir?: "asc"|"desc"}|Array} ctx.sort
 * @param {Object} ctx.filters
 * @param {Object} opts
 * @param {Array<{field:string,direction:"asc"|"desc"}>} [opts.defaultSort=[{field:"created_at",direction:"desc"}]]
 * @param {Object<string,string>} [opts.filterMap]  // UI anahtarını API anahtarına eşler (örn: { categories: "company_categories" })
 * @param {Array<string>} [opts.numericArrayKeys]   // sayılaştırılacak dizi filtreleri (örn: ["company_categories"])
 * @param {Function} [opts.filterTransform]         // Ek özel dönüştürme (filters)=>newFilters
 * @param {Object} [opts.fixedFilters]             // Sabit filtreler (örn: { roleId: 2, ... })
 * @param {Function} [opts.fixedFiltersFn]         // Sabit filtreler fonksiyonu (örn: (ctx)=>({ roleId: 2, divisionId: ctx.filters?.divisionId }))
 * @param {'fixedWins'|'uiWins'} [opts.mergeStrategy='fixedWins']  // Sabit ve UI filtreleri çakışırsa hangisi geçerli olur?
 *
 */
export const buildListPayload = (
  { page, pageSize, sort, filters },
  {
    defaultSort = [{ field: "created_at", direction: "desc" }],
    filterMap = {},
    numericArrayKeys = [],
    filterTransform,
    fixedFilters, // { roleId: 2, ... }
    fixedFiltersFn, // (ctx) => ({ roleId: 2, divisionId: ctx.filters?.divisionId })
    mergeStrategy = "fixedWins", // 'fixedWins' | 'uiWins'
  } = {}
) => {
  // sort → [{ field, direction }]
  let orderBy;
  if (Array.isArray(sort)) {
    // Çoklu sıralama desteği istiyorsan burada kullan
    orderBy = sort.map((s) => ({
      field: s.orderBy,
      direction: s.orderDir === "desc" ? "desc" : "asc",
    }));
  } else if (sort?.orderBy) {
    orderBy = [
      {
        field: sort.orderBy,
        direction: sort.orderDir === "desc" ? "desc" : "asc",
      },
    ];
  } else {
    orderBy = defaultSort;
  }

  // filters kopyala ve map uygula
  const mapped = {};
  Object.entries(filters || {}).forEach(([uiKey, val]) => {
    if (
      val === undefined ||
      val === null ||
      val === "" ||
      (Array.isArray(val) && val.length === 0)
    ) {
      return;
    }
    const apiKey = filterMap[uiKey] || uiKey;
    mapped[apiKey] = val;
  });

  const fixed =
    typeof fixedFiltersFn === "function"
      ? fixedFiltersFn({ page, pageSize, sort, filters })
      : fixedFilters || {};

  // NEW: birleştir (öncelik stratejisi)
  // fixedWins: sabit filtreler UI'ı ezer → {...mapped, ...fixed}
  // uiWins: UI sabiti ezer → {...fixed, ...mapped}
  const mergedBeforeNumeric =
    mergeStrategy === "uiWins"
      ? { ...fixed, ...mapped }
      : { ...mapped, ...fixed };

  // Sayısal dizi anahtarlarını dönüştür
  numericArrayKeys.forEach((k) => {
    if (mergedBeforeNumeric[k])
      mergedBeforeNumeric[k] = toNumberArray(mergedBeforeNumeric[k]);
  });

  const finalFilters =
    typeof filterTransform === "function"
      ? filterTransform(mergedBeforeNumeric)
      : mergedBeforeNumeric;

  return {
    pagination: { page, pageSize, orderBy },
    filters: finalFilters,
  };
};

/**
 * API list endpoint'i ile birlikte kullanmak için hazır request factory.
 * @param {(data:any)=>Promise<any>} apiListFn  // örn: CompaniesAPI.list
 * @param {Parameters<typeof buildListPayload>[1]} opts
 * @param {(resp:any)=>{list:any[], total:number}} normalizeFn  // normalizeListAndMeta
 */
export const makeListRequest = (apiListFn, opts, normalizeFn) => {
  return async (ctx) => {
    const payload = buildListPayload(ctx, opts);
    const resp = await apiListFn(payload);
    return normalizeFn(resp);
  };
};
