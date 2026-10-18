"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { App as AntdApp, Button, Input, Select, Skeleton } from "antd";
import { DownloadOutlined, KeyOutlined, SearchOutlined } from "@ant-design/icons";
import PageHeader from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/StateView";
import { useLocaleInfo } from "@/i18n/use-translations";
import { PublicApiDocsAPI } from "@/utils/api";
import { saveBlobAsFile } from "@/utils/apiHelpers";
import en from "./content/en";
import tr from "./content/tr";
import { CodeBlock, DocTable, MethodBadge, RichText } from "./DocsPrimitives";
import EndpointSection from "./EndpointSection";
import { groupOperations, operationAnchor, operationKey } from "./openapi";

const CONTENT = { en, tr };

function GuideBlock({ block, content, baseUrl, doc, onDownload, downloading }) {
  const ui = content.ui;
  if (block.h) return <h3 className="mb-2 mt-6 text-base font-semibold text-text">{block.h}</h3>;
  if (block.p) {
    return (
      <p className="my-2 max-w-3xl text-[14px] leading-6 text-text-secondary">
        <RichText text={block.p} />
      </p>
    );
  }
  if (block.note) {
    return (
      <div className="my-3 max-w-3xl rounded-lg border border-[var(--ej-info)]/30 bg-[var(--ej-info-bg)] px-4 py-3 text-[13.5px] leading-6 text-text">
        <RichText text={block.note} />
      </div>
    );
  }
  if (block.list || block.steps) {
    const Tag = block.steps ? "ol" : "ul";
    return (
      <Tag className={`my-2 max-w-3xl space-y-1.5 pl-5 text-[14px] leading-6 text-text-secondary ${block.steps ? "list-decimal" : "list-disc"}`}>
        {(block.list ?? block.steps).map((item, index) => (
          <li key={index}>
            <RichText text={item} />
          </li>
        ))}
      </Tag>
    );
  }
  if (block.code) {
    return (
      <div className="max-w-3xl">
        <CodeBlock
          code={block.code.replaceAll("{{baseUrl}}", baseUrl)}
          lang={block.lang}
          copyLabel={ui.copy}
          copiedLabel={ui.copied}
        />
      </div>
    );
  }
  if (block.table) return <div className="max-w-3xl"><DocTable head={block.table.head} rows={block.table.rows} /></div>;
  if (block.errorCodes) {
    const codes = Object.entries(doc?.["x-error-codes"] ?? {});
    return (
      <div className="max-w-3xl">
        <DocTable
          head={[ui.code, ui.status, ui.description]}
          rows={codes.map(([code, info]) => [
            <span key="code" className="ej-mono text-[12.5px] font-medium">{code}</span>,
            <span key="status" className="ej-mono">{info.status}</span>,
            info.description,
          ])}
        />
      </div>
    );
  }
  if (block.postman) {
    return (
      <Button icon={<DownloadOutlined />} onClick={onDownload} loading={downloading} className="mt-2">
        {ui.downloadPostman}
      </Button>
    );
  }
  return null;
}

export default function ApiDocsPage() {
  const { locale } = useLocaleInfo();
  const content = CONTENT[locale] ?? en;
  const ui = content.ui;
  const { message } = AntdApp.useApp();
  const [doc, setDoc] = useState(null);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const [openapi, meta] = await Promise.all([PublicApiDocsAPI.openapi(), PublicApiDocsAPI.info()]);
      setDoc(openapi);
      setInfo(meta?.data ?? null);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const baseUrl = info?.base_url ?? "/api/v1";
  const groups = useMemo(() => (doc ? groupOperations(doc) : []), [doc]);
  const filteredGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return groups;
    return groups
      .map((group) => ({
        ...group,
        operations: group.operations.filter(({ method, path, operation }) => {
          const translated = content.operations?.[operationKey(method, path)]?.summary ?? "";
          return `${method} ${path} ${operation.summary ?? ""} ${translated}`.toLowerCase().includes(needle);
        }),
      }))
      .filter((group) => group.operations.length);
  }, [content.operations, groups, query]);

  const downloadPostman = async () => {
    setDownloading(true);
    try {
      const { blob, filename } = await PublicApiDocsAPI.postman();
      saveBlobAsFile(blob, filename || "EasyJet-API-v1.postman_collection.json");
    } catch {
      message.error(ui.loadError);
    } finally {
      setDownloading(false);
    }
  };

  const jumpTo = (anchor) => {
    document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const navOptions = [
    {
      label: content.nav.guides,
      options: content.guides.map((guide) => ({ value: `guide-${guide.id}`, label: guide.title })),
    },
    ...groups.map((group) => ({
      label: group.tag,
      options: group.operations.map(({ method, path, operation }) => ({
        value: operationAnchor(method, path),
        label: `${method.toUpperCase()} ${path} · ${content.operations?.[operationKey(method, path)]?.summary ?? operation.summary}`,
      })),
    })),
  ];

  return (
    <div>
      <PageHeader
        title={content.title}
        description={content.subtitle}
        extra={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/settings">
              <Button icon={<KeyOutlined />}>{ui.manageKeys}</Button>
            </Link>
            <Button type="primary" icon={<DownloadOutlined />} onClick={downloadPostman} loading={downloading}>
              {ui.downloadPostman}
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3 text-[13px]">
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-text-secondary">{ui.baseUrl}</span>
          <code className="ej-mono break-all rounded bg-subtle px-2 py-0.5 text-text">{baseUrl}</code>
        </span>
        {doc?.info?.version ? (
          <span className="flex items-center gap-2">
            <span className="text-text-secondary">{ui.version}</span>
            <code className="ej-mono rounded bg-subtle px-2 py-0.5 text-text">{doc.info.version}</code>
          </span>
        ) : null}
      </div>

      <div className="mb-4 lg:hidden">
        <Select className="w-full" placeholder={ui.onThisPage} options={navOptions} onChange={jumpTo} showSearch optionFilterProp="label" />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto pr-2 text-[13px]">
            <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
              {content.nav.guides}
            </div>
            {content.guides.map((guide) => (
              <a
                key={guide.id}
                href={`#guide-${guide.id}`}
                className="block rounded-md px-2 py-1.5 text-text no-underline hover:bg-subtle"
              >
                {guide.title}
              </a>
            ))}
            <div className="mb-2 mt-5 px-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
              {content.nav.reference}
            </div>
            <Input
              size="small"
              allowClear
              prefix={<SearchOutlined />}
              placeholder={ui.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="mb-2"
            />
            {filteredGroups.map((group) => (
              <div key={group.tag} className="mb-3">
                <div className="px-2 py-1 font-medium text-text">{group.tag}</div>
                {group.operations.map(({ method, path, operation }) => (
                  <a
                    key={`${method} ${path}`}
                    href={`#${operationAnchor(method, path)}`}
                    className="flex items-start gap-2 rounded-md px-2 py-1 text-text-secondary no-underline hover:bg-subtle hover:text-text"
                  >
                    <MethodBadge method={method} small />
                    <span className="min-w-0 leading-5">
                      {content.operations?.[operationKey(method, path)]?.summary ?? operation.summary}
                    </span>
                  </a>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 rounded-xl border border-line bg-surface px-5 py-2 sm:px-8">
          {content.guides.map((guide) => (
            <section key={guide.id} id={`guide-${guide.id}`} className="scroll-mt-24 border-b border-line py-8 last:border-b-0">
              <h2 className="mb-3 mt-0 text-xl font-semibold text-text">{guide.title}</h2>
              {guide.blocks.map((block, index) => (
                <GuideBlock
                  key={index}
                  block={block}
                  content={content}
                  baseUrl={baseUrl}
                  doc={doc}
                  onDownload={downloadPostman}
                  downloading={downloading}
                />
              ))}
            </section>
          ))}

          <div className="pt-8">
            <h2 className="mb-1 mt-0 text-xl font-semibold text-text">{content.nav.reference}</h2>
            {error ? (
              <ErrorState description={ui.loadError} onRetry={load} />
            ) : !doc ? (
              <div className="py-6">
                <Skeleton active paragraph={{ rows: 6 }} />
              </div>
            ) : (
              groups.map((group) => (
                <div key={group.tag} id={`tag-${group.tag}`} className="pt-4">
                  <h2 className="mb-0 mt-6 text-lg font-semibold text-text">{group.tag}</h2>
                  {group.operations.map((entry) => (
                    <EndpointSection
                      key={`${entry.method} ${entry.path}`}
                      doc={doc}
                      entry={entry}
                      content={content}
                      baseUrl={baseUrl}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
