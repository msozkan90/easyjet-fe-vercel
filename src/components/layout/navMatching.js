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
  // The dashboard home only matches itself, never as a parent route.
  if (target.path === "/dashboard") return -1;
  if (pathname.startsWith(`${target.path}/`)) return target.path.length;
  return -1;
};

export const nodeText = (node) => {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) return node.map(nodeText).join("");
  return nodeText(node?.props?.children);
};

export function findActiveNavItem(items, pathname, searchParams) {
  const normalizedPath = (pathname || "/").replace(/\/+$/, "") || "/";
  let best = {
    score: -1,
    key: null,
    ancestors: [],
    item: null,
    trail: [],
    siblings: [],
  };

  const walk = (list, ancestors, trail) => {
    (list || []).forEach((item) => {
      if (!item || item.type === "divider") return;
      if (Array.isArray(item.children)) {
        walk(
          item.children,
          [...ancestors, item.key],
          [...trail, nodeText(item.label)],
        );
        return;
      }
      const target = parseHref(item.label?.props?.href);
      if (!target) return;
      const score = scoreMatch(target, normalizedPath, searchParams);
      if (score > best.score) {
        best = { score, key: item.key, ancestors, item, trail, siblings: list };
      }
    });
  };

  const toLink = (item) => {
    const href = item?.label?.props?.href;
    if (!item || item.type === "divider" || item.children || !href) return null;
    return { key: item.key, title: nodeText(item.label), href };
  };

  walk(items, [], []);
  return best.key
    ? {
        selectedKey: best.key,
        ancestorKeys: best.ancestors,
        exact: best.score >= 10000,
        title: nodeText(best.item?.label),
        trail: best.trail.filter(Boolean),
        parentKey: best.ancestors[best.ancestors.length - 1] || null,
        siblings: (best.siblings || []).map(toLink).filter(Boolean),
      }
    : {
        selectedKey: null,
        ancestorKeys: [],
        exact: false,
        title: "",
        trail: [],
        parentKey: null,
        siblings: [],
      };
}
