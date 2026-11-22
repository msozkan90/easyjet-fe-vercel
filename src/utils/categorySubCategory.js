export function categoryRequiresSubCategory(name) {
  const normalized = name?.trim().toLowerCase();
  return normalized === "apparel" || normalized === "print";
}
