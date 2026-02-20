const RULE_OPERATORS = {
  "==": (left, right) => left === right,
  "!=": (left, right) => left !== right,
  ">": (left, right) => Number(left) > Number(right),
  ">=": (left, right) => Number(left) >= Number(right),
  "<": (left, right) => Number(left) < Number(right),
  "<=": (left, right) => Number(left) <= Number(right),
  in: (left, right) => {
    if (Array.isArray(right)) {
      return right.some((item) => item === left);
    }
    if (Array.isArray(left)) {
      return left.some((item) => item === right);
    }
    return false;
  },
};

RULE_OPERATORS.not_in = (left, right) => !RULE_OPERATORS.in(left, right);

const normalizeArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
};

const getValueByPath = (source, path) => {
  const normalizedPath = Array.isArray(path)
    ? path
    : `${path ?? ""}`.split(".");
  return normalizedPath
    .map((segment) => segment.trim())
    .filter(Boolean)
    .reduce((acc, segment) => (acc == null ? acc : acc[segment]), source);
};

const shouldApplyRuleGroup = (rule, entityType) => {
  const normalizedType = `${entityType || ""}`.toLowerCase();
  const appliesTo = normalizeArray(rule?.applies_to).map((item) =>
    `${item || ""}`.toLowerCase()
  );
  if (!appliesTo.length || !normalizedType) {
    return true;
  }
  return appliesTo.includes(normalizedType);
};

const getRuleConditions = (rule) => {
  if (Array.isArray(rule?.conditions) && rule.conditions.length) {
    return rule.conditions;
  }
  if (rule?.key) {
    return [
      {
        key: rule.key,
        value: rule.value,
        operator: rule.operator,
      },
    ];
  }
  return [];
};

const evaluateCondition = (condition, context) => {
  if (!condition?.key) return true;
  const operatorKey = `${condition?.operator || "=="}`.toLowerCase();
  const comparator = RULE_OPERATORS[operatorKey] || RULE_OPERATORS["=="];
  const leftValue = getValueByPath(context, condition.key);
  return comparator(leftValue, condition.value);
};

const evaluateRuleGroup = (rule, context) => {
  if (!shouldApplyRuleGroup(rule, context?.entityType)) {
    return true;
  }
  const conditions = getRuleConditions(rule);
  if (!conditions.length) {
    return true;
  }
  const logic = `${rule?.logic || "all"}`.toLowerCase();
  if (logic === "any") {
    return conditions.some((condition) => evaluateCondition(condition, context));
  }
  return conditions.every((condition) => evaluateCondition(condition, context));
};

export const hasAccessToApiSource = (source, context = {}) => {
  const entityType = `${context?.entityType || ""}`.toLowerCase();
  if (!entityType) {
    return false;
  }

  const allowedTypes = Array.isArray(
    source?.config?.ownership?.allowed_entity_types
  )
    ? source.config.ownership.allowed_entity_types.map((item) =>
        `${item || ""}`.toLowerCase()
      )
    : [];

  if (allowedTypes.length && !allowedTypes.includes(entityType)) {
    return false;
  }

  if (`${source?.status || ""}`.toLowerCase() !== "active") {
    return false;
  }

  const rules = Array.isArray(source?.config?.rules)
    ? source.config.rules
    : [];

  return rules.every((rule) => evaluateRuleGroup(rule, context));
};

export const filterSourcesByAccess = (sources, context = {}) => {
  if (!Array.isArray(sources)) {
    return [];
  }

  return sources.filter((source) => hasAccessToApiSource(source, context));
};

export const apiSourceRuleUtils = {
  filterSourcesByAccess,
  hasAccessToApiSource,
};

export default apiSourceRuleUtils;
