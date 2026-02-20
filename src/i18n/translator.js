function resolvePath(source, path) {
  return path
    .split(".")
    .reduce(
      (acc, segment) =>
        acc && Object.prototype.hasOwnProperty.call(acc, segment)
          ? acc[segment]
          : undefined,
      source
    );
}

function formatMessage(template, variables = {}) {
  if (typeof template !== "string") {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, token) =>
    Object.prototype.hasOwnProperty.call(variables, token)
      ? variables[token]
      : `{${token}}`
  );
}

export function createTranslator(messages, namespace) {
  return (key, variables) => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    const message = resolvePath(messages, fullKey);

    if (message === undefined) {
      return fullKey;
    }

    if (typeof message === "string") {
      return formatMessage(message, variables);
    }

    return message;
  };
}
