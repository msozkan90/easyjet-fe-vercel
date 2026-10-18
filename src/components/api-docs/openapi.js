// Helpers that turn the public API OpenAPI document into what the docs page renders.

export const TAG_ORDER = ["Account", "Catalog", "Wallet", "Orders", "Designs", "Shipping", "Sandbox"];

export const operationKey = (method, path) => `${method.toUpperCase()} ${path}`;

export const operationAnchor = (method, path) =>
  `op-${method}-${path.replace(/[{}]/g, "").replace(/[^a-zA-Z0-9]+/g, "-")}`.replace(/-+$/, "");

export function resolveRef(doc, schema) {
  let current = schema;
  const seen = new Set();
  while (current?.$ref && !seen.has(current.$ref)) {
    seen.add(current.$ref);
    const name = current.$ref.split("/").pop();
    current = doc?.components?.schemas?.[name] ?? {};
  }
  return current ?? {};
}

const schemaName = (schema) => (schema?.$ref ? schema.$ref.split("/").pop() : null);

/** Groups operations by their first tag in TAG_ORDER, keeping document order inside a tag. */
export function groupOperations(doc) {
  const groups = new Map();
  for (const [path, item] of Object.entries(doc?.paths ?? {})) {
    for (const method of ["get", "post", "patch", "put", "delete"]) {
      const operation = item?.[method];
      if (!operation) continue;
      const tag = operation.tags?.[0] ?? "Other";
      if (!groups.has(tag)) groups.set(tag, []);
      groups.get(tag).push({ method, path, operation });
    }
  }
  return [...groups.entries()]
    .sort(([a], [b]) => {
      const ia = TAG_ORDER.indexOf(a);
      const ib = TAG_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    })
    .map(([tag, operations]) => ({ tag, operations }));
}

const typeOf = (schema) => {
  if (Array.isArray(schema.type)) return schema.type.filter((type) => type !== "null")[0];
  if (schema.type) return schema.type;
  if (schema.properties) return "object";
  if (schema.items) return "array";
  if (schema.enum) return typeof schema.enum[0];
  return undefined;
};

const isNullable = (schema) =>
  schema.nullable === true ||
  (Array.isArray(schema.type) && schema.type.includes("null")) ||
  (schema.anyOf ?? []).some((entry) => entry.type === "null");

const unwrap = (doc, schema) => {
  const resolved = resolveRef(doc, schema);
  const choice = (resolved.anyOf ?? resolved.oneOf)?.find((entry) => entry.type !== "null");
  return choice ? { ...resolveRef(doc, choice), description: resolved.description ?? choice.description } : resolved;
};

/** Example value for a schema: explicit examples first, then a type-based placeholder. */
export function sampleFromSchema(doc, schema, depth = 0, options = {}) {
  if (!schema || depth > 6) return null;
  const resolved = unwrap(doc, schema);
  if (resolved.example !== undefined) return resolved.example;
  if (resolved.default !== undefined) return resolved.default;
  if (resolved.enum?.length) return resolved.enum[0];
  const allOf = resolved.allOf?.map((entry) => sampleFromSchema(doc, entry, depth + 1, options));
  if (allOf) return Object.assign({}, ...allOf.filter((entry) => typeof entry === "object"));
  switch (typeOf(resolved)) {
    case "object": {
      const out = {};
      const required = new Set(resolved.required ?? []);
      for (const [key, value] of Object.entries(resolved.properties ?? {})) {
        // Request examples show required fields and optional ones that have an example.
        if (options.requiredOnly && !required.has(key) && !hasExample(doc, value)) continue;
        out[key] = sampleFromSchema(doc, value, depth + 1, options);
      }
      return out;
    }
    case "array":
      return [sampleFromSchema(doc, resolved.items, depth + 1, options)];
    case "integer":
    case "number":
      return 1;
    case "boolean":
      return true;
    case "string":
      if (resolved.format === "uuid") return "3fa85f64-5717-4562-b3fc-2c963f66afa6";
      if (resolved.format === "date-time") return "2026-10-18T12:00:00.000Z";
      if (resolved.format === "binary") return "<file>";
      if (resolved.format === "uri") return "https://example.com/file.png";
      return "string";
    default:
      return null;
  }
}

const hasExample = (doc, schema) => {
  const resolved = unwrap(doc, schema);
  return resolved.example !== undefined || resolved.default !== undefined;
};

const typeLabel = (doc, schema) => {
  const resolved = unwrap(doc, schema);
  const type = typeOf(resolved);
  if (type === "array") {
    const items = unwrap(doc, resolved.items ?? {});
    return `${schemaName(resolved.items) ?? typeOf(items) ?? "any"}[]`;
  }
  if (resolved.enum?.length) return resolved.enum.join(" | ");
  if (resolved.format === "binary") return "file";
  if (resolved.format) return `${type} (${resolved.format})`;
  return schemaName(schema) ?? type ?? "any";
};

/** Flattens object fields into rows (nested objects become dotted names). */
export function schemaFields(doc, schema, prefix = "", depth = 0) {
  const resolved = unwrap(doc, schema);
  if (depth > 3) return [];
  const target = typeOf(resolved) === "array" ? unwrap(doc, resolved.items ?? {}) : resolved;
  const required = new Set(target.required ?? []);
  const rows = [];
  for (const [name, value] of Object.entries(target.properties ?? {})) {
    const field = unwrap(doc, value);
    const fullName = prefix ? `${prefix}.${name}` : name;
    rows.push({
      name: fullName,
      type: typeLabel(doc, value),
      required: required.has(name),
      nullable: isNullable(resolveRef(doc, value)),
      description: field.description ?? "",
    });
    const nested = typeOf(field) === "array" ? unwrap(doc, field.items ?? {}) : field;
    if (typeOf(nested) === "object" && nested.properties && !schemaName(value)) {
      rows.push(...schemaFields(doc, field, typeOf(field) === "array" ? `${fullName}[]` : fullName, depth + 1));
    }
  }
  return rows;
}

export function parameterRows(doc, operation) {
  return (operation.parameters ?? []).map((parameter) => {
    const resolved = resolveRef(doc, parameter);
    return {
      name: resolved.name,
      in: resolved.in,
      type: typeLabel(doc, resolved.schema ?? {}),
      required: Boolean(resolved.required),
      description: resolved.description ?? resolved.schema?.description ?? "",
    };
  });
}

export function requestBodies(doc, operation) {
  const content = resolveRef(doc, operation.requestBody ?? {}).content ?? {};
  return Object.entries(content).map(([mediaType, media]) => ({
    mediaType,
    schema: media.schema,
    fields: schemaFields(doc, media.schema),
    example: sampleFromSchema(doc, media.schema, 0, { requiredOnly: true }),
  }));
}

export function responseList(doc, operation) {
  return Object.entries(operation.responses ?? {}).map(([status, response]) => {
    const resolved = resolveRef(doc, response);
    const schema = resolved.content?.["application/json"]?.schema;
    return {
      status,
      description: resolved.description ?? "",
      example: schema && Number(status) < 300 ? sampleFromSchema(doc, schema) : null,
    };
  });
}

const shellQuote = (value) => `'${String(value).replace(/'/g, "'\\''")}'`;

/** Code samples for an operation; JSON bodies use the generated example. */
export function codeSamples({ baseUrl, method, path, body, mediaType }) {
  const url = `${baseUrl}${path.replace(/\{(\w+)\}/g, (_m, name) => `{${name}}`)}`;
  const upper = method.toUpperCase();
  const needsKey = upper === "POST";
  const json = body !== undefined && mediaType === "application/json" ? JSON.stringify(body, null, 2) : null;
  const multipart = mediaType === "multipart/form-data";

  const curl = [
    `curl -X ${upper} ${shellQuote(url)}`,
    `  -H "Authorization: Bearer $EASYJET_API_KEY"`,
    needsKey ? `  -H "Idempotency-Key: $(uuidgen)"` : null,
    json ? `  -H "Content-Type: application/json"` : null,
    json ? `  -d ${shellQuote(json)}` : null,
    multipart ? `  -F "front=@design.png"` : null,
  ]
    .filter(Boolean)
    .join(" \\\n");

  const node = [
    `const response = await fetch(${JSON.stringify(url)}, {`,
    `  method: "${upper}",`,
    `  headers: {`,
    `    Authorization: \`Bearer \${process.env.EASYJET_API_KEY}\`,`,
    needsKey ? `    "Idempotency-Key": crypto.randomUUID(),` : null,
    json ? `    "Content-Type": "application/json",` : null,
    `  },`,
    json ? `  body: JSON.stringify(${json.replace(/\n/g, "\n  ")}),` : null,
    multipart ? `  body: form, // FormData with your files` : null,
    `});`,
    `const { success, data, error } = await response.json();`,
  ]
    .filter(Boolean)
    .join("\n");

  const python = [
    `import os, uuid, requests`,
    ``,
    `response = requests.${method.toLowerCase()}(`,
    `    ${JSON.stringify(url)},`,
    `    headers={`,
    `        "Authorization": f"Bearer {os.environ['EASYJET_API_KEY']}",`,
    needsKey ? `        "Idempotency-Key": str(uuid.uuid4()),` : null,
    `    },`,
    json ? `    json=${json.replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False").replace(/\bnull\b/g, "None").replace(/\n/g, "\n    ")},` : null,
    multipart ? `    files={"front": open("design.png", "rb")},` : null,
    `)`,
    `print(response.json())`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const php = [
    `$ch = curl_init(${JSON.stringify(url)});`,
    `curl_setopt_array($ch, [`,
    `    CURLOPT_CUSTOMREQUEST => "${upper}",`,
    `    CURLOPT_RETURNTRANSFER => true,`,
    `    CURLOPT_HTTPHEADER => [`,
    `        "Authorization: Bearer " . getenv("EASYJET_API_KEY"),`,
    needsKey ? `        "Idempotency-Key: " . bin2hex(random_bytes(16)),` : null,
    json ? `        "Content-Type: application/json",` : null,
    `    ],`,
    json ? `    CURLOPT_POSTFIELDS => json_encode(${phpArray(body, 1)}),` : null,
    multipart ? `    CURLOPT_POSTFIELDS => ["front" => new CURLFile("design.png")],` : null,
    `]);`,
    `$result = json_decode(curl_exec($ch), true);`,
  ]
    .filter(Boolean)
    .join("\n");

  return { curl, node, python, php };
}

function phpArray(value, indent) {
  const pad = "    ".repeat(indent + 1);
  const end = "    ".repeat(indent);
  if (Array.isArray(value)) {
    return `[\n${value.map((entry) => `${pad}${phpArray(entry, indent + 1)}`).join(",\n")}\n${end}]`;
  }
  if (value && typeof value === "object") {
    return `[\n${Object.entries(value)
      .map(([key, entry]) => `${pad}${JSON.stringify(key)} => ${phpArray(entry, indent + 1)}`)
      .join(",\n")}\n${end}]`;
  }
  if (value === null) return "null";
  return JSON.stringify(value);
}
