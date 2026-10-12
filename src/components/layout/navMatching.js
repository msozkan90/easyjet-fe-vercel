// Resolves which sidebar entry matches the current route.
// Menu items carry their target as a <Link href> label, so the href is read
// from the label element; the most specific match wins.

const parseHref = (href) => {
  if (typeof href !== "string" || !href.startsWith("/")) return null;
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  return { path: path.replace(/\/+$/, "") || "/", params };
};

const scoreMatch = (target, pathname, searchParams) => {
  for (const [key, value] of target.params.entries()) {
    if (searchParams?.get(key) !== value) return -1;
  }
  const paramBonus = [...target.params.keys()].length * 100;
  if (pathname === target.path) return 10000 + target.path.length + paramBonus;
  if (pathname.startsWith(`${target.path}/`)) return target.path.length;
  return -1;
};

export function findActiveNavItem(items, pathname, searchParams) {
  const normalizedPath = (pathname || "/").replace(/\/+$/, "") || "/";
  let best = { score: -1, key: null, ancestors: [] };

  const walk = (list, ancestors) => {
    (list || []).forEach((item) => {
      if (!item || item.type === "divider") return;
      if (Array.isArray(item.children)) {
        walk(item.children, [...ancestors, item.key]);
        return;
      }
      const target = parseHref(item.label?.props?.href);
      if (!target) return;
      const score = scoreMatch(target, normalizedPath, searchParams);
      if (score > best.score) {
        best = { score, key: item.key, ancestors };
      }
    });
  };

  walk(items, []);
  return best.key
    ? { selectedKey: best.key, ancestorKeys: best.ancestors }
    : { selectedKey: null, ancestorKeys: [] };
}
