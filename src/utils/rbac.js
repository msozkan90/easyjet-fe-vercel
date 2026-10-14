export const hasRole = (user, role) =>
  !!user?.roles?.includes(role.trim().toLowerCase());

export const hasAnyRole = (user, roles = []) => {
  const set = new Set((user?.roles || []).map((r) => r.toLowerCase()));
  return roles.some((r) => set.has(r.trim().toLowerCase()));
};

export const can = (user, perm) => !!user?.permissions?.includes(perm);

// Entity admins (system, company, partner, customer). Wallet balance and
// wallet transactions are only shown to them, never to workers.
export const ENTITY_ADMIN_ROLES = [
  "systemAdmin",
  "companyAdmin",
  "partnerAdmin",
  "customerAdmin",
];

export const isEntityAdmin = (user) => hasAnyRole(user, ENTITY_ADMIN_ROLES);
