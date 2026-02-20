export const hasRole = (user, role) =>
  !!user?.roles?.includes(role.trim().toLowerCase());

export const hasAnyRole = (user, roles = []) => {
  const set = new Set((user?.roles || []).map((r) => r.toLowerCase()));
  return roles.some((r) => set.has(r.trim().toLowerCase()));
};

export const can = (user, perm) => !!user?.permissions?.includes(perm);
