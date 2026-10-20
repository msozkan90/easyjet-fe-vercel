"use client";

import { useMemo, useState } from "react";
import { Segmented } from "antd";
import { CodeBlock, DocTable, MethodBadge, RichText } from "./DocsPrimitives";
import {
  codeSamples,
  operationAnchor,
  operationKey,
  parameterRows,
  requestBodies,
  responseList,
} from "./openapi";

const SAMPLE_LANGUAGES = [
  { value: "curl", label: "cURL" },
  { value: "node", label: "Node.js" },
  { value: "python", label: "Python" },
  { value: "php", label: "PHP" },
];

export default function EndpointSection({ doc, entry, content, baseUrl }) {
  const { method, path, operation } = entry;
  const ui = content.ui;
  const translated = content.operations?.[operationKey(method, path)] ?? {};
  const [language, setLanguage] = useState("curl");
  const bodies = useMemo(() => requestBodies(doc, operation), [doc, operation]);
  const [bodyIndex, setBodyIndex] = useState(0);
  const body = bodies[bodyIndex];
  const parameters = useMemo(() => parameterRows(doc, operation), [doc, operation]);
  const responses = useMemo(() => responseList(doc, operation), [doc, operation]);
  const samples = useMemo(
    () => codeSamples({ baseUrl, method, path, body: body?.example, mediaType: body?.mediaType }),
    [baseUrl, body, method, path],
  );
  const success = responses.find((response) => Number(response.status) < 300 && response.example);

  return (
    <section id={operationAnchor(method, path)} className="scroll-mt-24 border-t border-line py-8">
      <div className="flex flex-wrap items-center gap-2">
        <MethodBadge method={method} />
        <code className="ej-mono break-all text-[14px] font-medium text-text">{path}</code>
      </div>
      <h3 className="mb-2 mt-3 text-lg font-semibold text-text">
        {translated.summary ?? operation.summary}
      </h3>
      <p className="m-0 max-w-3xl text-[14px] leading-6 text-text-secondary">
        <RichText text={translated.description ?? operation.description} />
      </p>

      <div className="mt-5 grid grid-cols-1 gap-6 2xl:grid-cols-2">
        <div className="min-w-0">
          {parameters.length ? (
            <>
              <h4 className="mb-1 mt-0 text-sm font-semibold text-text">{ui.parameters}</h4>
              <DocTable
                head={[ui.parameter, ui.location, ui.type, ui.description]}
                rows={parameters.map((row) => [
                  <span key="name" className="ej-mono text-[12.5px]">
                    {row.name}
                    {row.required ? <span className="ml-1 text-[var(--ej-danger)]">*</span> : null}
                  </span>,
                  row.in,
                  <span key="type" className="ej-mono text-[12px] text-text-secondary">{row.type}</span>,
                  row.description,
                ])}
              />
            </>
          ) : null}

          {bodies.length ? (
            <>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <h4 className="m-0 text-sm font-semibold text-text">{ui.requestBody}</h4>
                {bodies.length > 1 ? (
                  <Segmented
                    size="small"
                    value={bodyIndex}
                    onChange={setBodyIndex}
                    options={bodies.map((entry, index) => ({ value: index, label: entry.mediaType }))}
                  />
                ) : (
                  <span className="ej-mono text-xs text-text-secondary">{body.mediaType}</span>
                )}
              </div>
              {body.fields.length ? (
                <DocTable
                  head={[ui.field, ui.type, ui.description]}
                  rows={body.fields.map((field) => [
                    <span key="name" className="ej-mono text-[12.5px]">
                      {field.name}
                      {field.required ? <span className="ml-1 text-[var(--ej-danger)]">*</span> : null}
                    </span>,
                    <span key="type" className="ej-mono text-[12px] text-text-secondary">
                      {field.type}
                      {field.nullable ? ` · ${ui.nullable}` : ""}
                    </span>,
                    field.description,
                  ])}
                />
              ) : null}
            </>
          ) : null}

          <h4 className="mb-1 mt-4 text-sm font-semibold text-text">{ui.responses}</h4>
          <DocTable
            head={[ui.status, ui.description]}
            rows={responses.map((response) => [
              <span
                key="status"
                className={`ej-mono font-semibold ${
                  Number(response.status) < 300 ? "text-[var(--ej-success)]" : "text-[var(--ej-danger)]"
                }`}
              >
                {response.status}
              </span>,
              response.description,
            ])}
          />
        </div>

        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="m-0 text-sm font-semibold text-text">{ui.codeSamples}</h4>
            <Segmented size="small" value={language} onChange={setLanguage} options={SAMPLE_LANGUAGES} />
          </div>
          <CodeBlock code={samples[language]} lang={language} copyLabel={ui.copy} copiedLabel={ui.copied} />
          {body?.example !== undefined && body?.mediaType === "application/json" ? (
            <>
              <h4 className="mb-0 mt-4 text-sm font-semibold text-text">
                {ui.requestBody} · {ui.example}
              </h4>
              <CodeBlock
                code={JSON.stringify(body.example, null, 2)}
                lang="json"
                copyLabel={ui.copy}
                copiedLabel={ui.copied}
              />
            </>
          ) : null}
          {success ? (
            <>
              <h4 className="mb-0 mt-4 text-sm font-semibold text-text">
                {success.status} · {ui.example}
              </h4>
              <CodeBlock
                code={JSON.stringify(success.example, null, 2)}
                lang="json"
                copyLabel={ui.copy}
                copiedLabel={ui.copied}
              />
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
