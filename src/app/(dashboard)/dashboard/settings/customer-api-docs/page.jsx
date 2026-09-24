"use client";

import { useState } from "react";
import Link from "next/link";
import RequireRole from "@/components/common/Access/RequireRole";
import { useLocaleInfo } from "@/i18n/use-translations";
import styles from "./page.module.css";

const BASE = "/api/integrations/v1";
const ORDER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const SUB_CATEGORY_ID = "33333333-3333-4333-8333-333333333333";
const DESIGN_SESSION_ID = "44444444-4444-4444-8444-444444444444";
const LABEL_SESSION_ID = "22222222-2222-4222-8222-222222222222";
const OPENAPI_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api").replace(/\/$/, "") + "/integrations/v1/openapi.json";

const navigation = [
  ["baslangic", "Başlangıç", "Getting started"],
  ["akis", "Uçtan uca akış", "End-to-end flow"],
  ["kimlik", "Kimlik doğrulama", "Authentication"],
  ["catalog", "1. Ürün kataloğu", "1. Product catalog"],
  ["order", "2. Taslak sipariş", "2. Draft order"],
  ["design", "3. Tasarım yükleme", "3. Design upload"],
  ["label", "4. Etiket yükleme", "4. Label upload"],
  ["submit", "5. Production", "5. Production"],
  ["status", "6. Durum takibi", "6. Status tracking"],
  ["idempotency", "Tekrar deneme", "Retries"],
  ["errors", "Hatalar", "Errors"],
  ["rotation", "Anahtar rotasyonu", "Key rotation"],
  ["checklist", "Canlıya alma", "Go-live checklist"],
];

const examples = {
  env: [
    'API_BASE_URL="https://<easyjet-api-host>/api/integrations/v1"',
    'EASYJET_API_KEY="ej_live_<keyId>.<secret>"',
  ].join("\n"),
  catalogCurl: [
    'curl --fail-with-body "$API_BASE_URL/catalog/transfer-products" \\',
    '  -H "Authorization: Bearer $EASYJET_API_KEY"',
  ].join("\n"),
  orderCurl: [
    'curl --fail-with-body "$API_BASE_URL/transfer-orders" \\',
    '  -H "Authorization: Bearer $EASYJET_API_KEY" \\',
    '  -H "Content-Type: application/json" \\',
    '  -H "Idempotency-Key: 5d690183-f015-4b6f-b20a-cecf476af196" \\',
    "  --data '{",
    '    "external_order_id": "merchant-1001",',
    '    "order_number": "INT-1001",',
    '    "order_date": "2026-09-23T10:00:00.000Z",',
    '    "ship_to_name": "Example Recipient",',
    '    "ship_to_street1": "1 Main Street",',
    '    "ship_to_city": "London",',
    '    "ship_to_state": "London",',
    '    "ship_to_postal_code": "SW1A 1AA",',
    '    "ship_to_country": "GB",',
    '    "items": [{',
    '      "external_item_id": "line-1",',
    '      "transfer_product_id": "' + PRODUCT_ID + '",',
    '      "name": "Transfer item",',
    '      "quantity": 2',
    "    }]",
    "  }'",
  ].join("\n"),
  s3Put: [
    'curl --fail-with-body -X PUT "$PART_URL" \\',
    '  --data-binary @design.png \\',
    "  -D -",
    "",
    '# Yanıt header: ETag: "<s3-etag>"',
  ].join("\n"),
  submitCurl: [
    'curl --fail-with-body "$API_BASE_URL/transfer-orders/' + ORDER_ID + '/submit" \\',
    '  -H "Authorization: Bearer $EASYJET_API_KEY" \\',
    '  -H "Content-Type: application/json" \\',
    '  -H "Idempotency-Key: 074ae1f6-2920-4fc4-84db-a894f09e9719" \\',
    "  --data '{ \"label_upload_session_id\": \"" + LABEL_SESSION_ID + "\" }'",
  ].join("\n"),
  statusCurl: [
    'curl --fail-with-body "$API_BASE_URL/transfer-orders/by-external-id/merchant-1001" \\',
    '  -H "Authorization: Bearer $EASYJET_API_KEY"',
  ].join("\n"),
};

const json = (value) => JSON.stringify(value, null, 2);

function Inline({ text }) {
  return String(text).split(/(`[^`]+`)/g).map((part, index) =>
    part.startsWith("`") && part.endsWith("`")
      ? <code key={index}>{part.slice(1, -1)}</code>
      : part
  );
}

function Code({ title, children }) {
  const { locale } = useLocaleInfo();
  const [copied, setCopied] = useState(false);
  const value = String(children).trim();

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={styles.codePanel}>
      <div className={styles.codeHead}>
        <span>{title}</span>
        <button type="button" onClick={copy} aria-label={locale === "en" ? "Copy " + title : title + " örneğini kopyala"}>
          {copied ? (locale === "en" ? "Copied" : "Kopyalandı") : (locale === "en" ? "Copy" : "Kopyala")}
        </button>
      </div>
      <pre><code>{value}</code></pre>
    </div>
  );
}

function Endpoint({ method, path, description }) {
  return (
    <div className={styles.endpoint}>
      <span className={method === "GET" ? styles.get : styles.post}>{method}</span>
      <code>{path}</code>
      <small>{description}</small>
    </div>
  );
}

function Fields({ rows, headings }) {
  const { locale } = useLocaleInfo();
  const resolvedHeadings = headings || (locale === "en" ? ["Field", "Requirement / type", "Description"] : ["Alan", "Gereklilik / tip", "Açıklama"]);
  return (
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <thead><tr>{resolvedHeadings.map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
        <tbody>{rows.map(([name, type, description]) => (
          <tr key={name}><td><code>{name}</code></td><td>{type}</td><td>{description}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function Callout({ title, children, warning = false }) {
  return <div className={warning ? styles.warning : styles.callout}><strong>{title}</strong><div>{children}</div></div>;
}

function Section({ id, eyebrow, title, children }) {
  return <section id={id} className={styles.section}><p className={styles.eyebrow}>{eyebrow}</p><h2>{title}</h2>{children}</section>;
}

function Docs() {
  const { locale, changeLocale, isChangingLocale } = useLocaleInfo();
  const l = (tr, en) => locale === "en" ? en : tr;
  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <Link href="/dashboard/settings">{l("← API Yapılandırması", "← API Configuration")}</Link>
        <div className={styles.topbarRight}>
          <span>Customer Transfer Order API · v1</span>
          <div className={styles.languageSwitch} role="group" aria-label={l("Dokümantasyon dili", "Documentation language")}>
            <button type="button" aria-pressed={locale === "tr"} disabled={isChangingLocale} onClick={() => changeLocale("tr")}>TR</button>
            <button type="button" aria-pressed={locale === "en"} disabled={isChangingLocale} onClick={() => changeLocale("en")}>EN</button>
          </div>
        </div>
      </div>
      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.heroLabel}>{l("GELİŞTİRİCİ DOKÜMANTASYONU", "DEVELOPER DOCUMENTATION")}</span>
          <h1>{l("Transfer order entegrasyonu", "Transfer order integration")}</h1>
          <p>{l("Müşteri yazılımınızda oluşturduğunuz yurt dışı transfer siparişlerini EasyJet'e aktarın, dosyalarını yükleyin, üretime gönderin ve durumunu takip edin.", "Send international transfer orders from your own system to EasyJet, upload their files, submit them to production, and track their status.")}</p>
          <div className={styles.heroActions}>
            <a href="#akis" className={styles.primaryLink}>{l("Akışı incele →", "Explore the flow →")}</a>
            <a href="#baslangic" className={styles.secondaryLink}>{l("İlk isteği hazırla", "Prepare your first request")}</a>
          </div>
        </div>
        <div className={styles.heroFlow} aria-label={l("Entegrasyon adımları", "Integration steps")}>
          <span>{l("01 · Ürünleri eşle", "01 · Map products")}</span><span>{l("02 · Sipariş oluştur", "02 · Create order")}</span><span>{l("03 · Dosyaları yükle", "03 · Upload files")}</span><span>{l("04 · Üretime gönder", "04 · Submit to production")}</span><span>{l("05 · Durumu izle", "05 · Track status")}</span>
        </div>
      </header>
      <div className={styles.layout}>
        <nav className={styles.toc} aria-label={l("Dokümantasyon içindekiler", "Documentation table of contents")}>
          <span>{l("İÇİNDEKİLER", "ON THIS PAGE")}</span>
          {navigation.map(([id, tr, en]) => <a key={id} href={"#" + id}>{l(tr, en)}</a>)}
        </nav>
        <main className={styles.content}>
          <Section id="baslangic" eyebrow={l("ÖNCE BUNLARI HAZIRLAYIN", "BEFORE YOU START")} title={l("Başlangıç", "Getting started")}>
            <p>{l("Bu API sunucudan sunucuya kullanılır. CustomerAdmin,", "This is a server-to-server API. A CustomerAdmin creates a key in")} <Link href="/dashboard/settings">Settings → API Configuration</Link>. {l("Anahtar yalnızca oluşturma yanıtında bir kez görünür; sunucu tarafındaki secret yöneticisine kaydedilmelidir.", "The key is shown only once when created; save it in a server-side secret manager.")}</p>
            <div className={styles.factGrid}>
              <div><span>{l("Temel yol", "Base path")}</span><code>{BASE}</code></div>
              <div><span>{l("Kimlik", "Authentication")}</span><code>Authorization: Bearer …</code></div>
              <div><span>{l("POST isteği", "POST request")}</span><code>Idempotency-Key: UUID</code></div>
              <div><span>{l("Yanıt", "Response")}</span><code>application/json</code></div>
            </div>
            <Code title={l("Sunucu ortam değişkenleri", "Server environment variables")}>{examples.env}</Code>
            <p><Inline text={l("`<easyjet-api-host>` yerine size sağlanan gerçek API host adını yazın. Production ortamında HTTPS zorunludur. API anahtarını frontend bundle, mobil uygulama veya kullanıcıya görünen loglara koymayın.", "Replace `<easyjet-api-host>` with the actual API host you were given. Production requires HTTPS. Never place the API key in a frontend bundle, mobile app, or user-visible logs.")} /></p>
            <Callout title={l("Yanıt sarmalayıcısı", "Response envelope")}><Inline text={l("Başarılı API yanıtları `{\"success\":true,\"data\":...}` biçimindedir. Aşağıdaki örneklerde gösterilmeyen ek alanlar dönebilir. Presigned URL'ye yapılan S3 PUT çağrıları EasyJet JSON yanıtı vermez.", "Successful API responses use `{\"success\":true,\"data\":...}`. Responses may contain additional fields beyond the examples below. S3 PUT requests to presigned URLs do not return EasyJet JSON.")} /></Callout>
          </Section>

          <Section id="akis" eyebrow={l("BÜTÜN RESİM", "THE BIG PICTURE")} title={l("Uçtan uca iş akışı", "End-to-end workflow")}>
            <ol className={styles.steps}>
              <li><strong>Catalog</strong><span>{l("Ürün UUID'lerini kendi SKU'larınızla eşleyin; tasarım gereksinimini ve sub-category ID'sini saklayın.", "Map product UUIDs to your own SKUs; save the design requirement and sub-category ID.")}</span></li>
              <li><strong>{l("Taslak", "Draft order")}</strong><span><Inline text={l("Order ve item'ları oluşturun; dönen EasyJet order `id` değerini saklayın.", "Create the order and items; save the returned EasyJet order `id`.")} /></span></li>
              <li><strong>{l("Tasarım", "Design")}</strong><span>{l("Tasarım gerektiren her sub-category için init → part URL → S3 PUT → complete akışını bitirin.", "For every sub-category that requires a design, complete init → part URL → S3 PUT → complete.")}</span></li>
              <li><strong>{l("Etiket", "Label")}</strong><span>{l("PDF/PNG kargo etiketini init → S3 PUT → complete ile yükleyin; session ID'yi saklayın.", "Upload the PDF/PNG shipping label with init → S3 PUT → complete; save the session ID.")}</span></li>
              <li><strong>Submit</strong><span>{l("Tamamlanmış label session ile siparişi production'a gönderin.", "Submit the order to production using the completed label session.")}</span></li>
              <li><strong>{l("Takip", "Poll")}</strong><span>{l("GET çağrılarıyla order, item, design, label ve shipment durumlarını takip edin.", "Use GET requests to track order, item, design, label, and shipment status.")}</span></li>
            </ol>
            <Callout title={l("Sıra önemlidir", "Follow this order")} warning>{l("Siparişi oluşturduktan sonra tasarımları ve etiketi tamamlayın; submit çağrısını en son yapın. Ürün fiyatı, multiplier ve production status alanlarını sipariş isteğine eklemeyin.", "After creating the order, finish designs and the label before calling submit. Do not add product prices, multipliers, or production status to the order request.")}</Callout>
          </Section>

          <Section id="kimlik" eyebrow={l("GÜVENLİ BAĞLANTI", "SECURE CONNECTION")} title={l("Kimlik doğrulama ve sınırlar", "Authentication and limits")}>
            <Code title={l("EasyJet API header'ları", "EasyJet API headers")}>{[
              "Authorization: Bearer ej_live_<keyId>.<secret>",
              "Content-Type: application/json",
              l("Idempotency-Key: <yeni-bir-UUID>  # yalnızca POST isteklerinde", "Idempotency-Key: <new-UUID>  # POST requests only"),
            ].join("\n")}</Code>
            <p><Inline text={l("Aşağıdaki bütün POST body örnekleri aynı çağrı şablonuyla gönderilebilir: JSON'u `request.json` dosyasına kaydedin, `ORDER_ID` değerini sipariş oluşturma yanıtından alın ve `PATH_SUFFIX` için ilgili endpoint'in `transfer-orders/` sonrasındaki bölümünü yazın. Sipariş oluşturma çağrısında tam yol yalnızca `transfer-orders` olur.", "You can send all POST body examples below with this template: save the JSON to `request.json`, take `ORDER_ID` from the create-order response, and set `PATH_SUFFIX` to the part of the endpoint after `transfer-orders/`. For order creation, the full path is simply `transfer-orders`.")} /></p>
            <Code title={l("cURL · diğer POST endpoint'leri için şablon", "cURL · template for other POST endpoints")}>{[
              'ORDER_ID="' + ORDER_ID + '"',
              'PATH_SUFFIX="$ORDER_ID/design-uploads/init"',
              l('IDEMPOTENCY_KEY="<yeni-uuid>"', 'IDEMPOTENCY_KEY="<new-uuid>"'),
              'curl --fail-with-body "$API_BASE_URL/transfer-orders/$PATH_SUFFIX" \\',
              '  -H "Authorization: Bearer $EASYJET_API_KEY" \\',
              '  -H "Content-Type: application/json" \\',
              '  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \\',
              '  --data-binary @request.json',
            ].join("\n")}</Code>
            <p><Inline text={l("Diğer yükleme çağrılarında `PATH_SUFFIX` değerini `$ORDER_ID/design-uploads/part-urls`, `$ORDER_ID/design-uploads/complete`, `$ORDER_ID/design-uploads/abort`, `$ORDER_ID/label-upload/init` veya `$ORDER_ID/label-upload/complete` olarak değiştirin. Her yeni POST işleminde yeni UUID üretin; aynı işlemin ağ sonrası tekrarında aynı UUID'yi koruyun.", "For the other upload calls, set `PATH_SUFFIX` to `$ORDER_ID/design-uploads/part-urls`, `$ORDER_ID/design-uploads/complete`, `$ORDER_ID/design-uploads/abort`, `$ORDER_ID/label-upload/init`, or `$ORDER_ID/label-upload/complete`. Generate a new UUID for every new POST operation; reuse the same UUID when retrying the same operation after a network failure.")} /></p>
            <p><Inline text={l("API anahtarı yalnızca oluşturulduğu customer adına çalışır. V1 scope'ları `catalog:read`, `transfer_orders:read`, `transfer_orders:write`, `assets:write` ve `production:submit` olarak sabittir.", "An API key can only act for the customer that owns it. V1 has fixed scopes: `catalog:read`, `transfer_orders:read`, `transfer_orders:write`, `assets:write`, and `production:submit`.")} /></p>
            <p><Inline text={l("Anahtar 180 gün sonra sona erer; aynı anda en fazla iki aktif anahtar bulunabilir. Credential başına 5 dakikada 300 istek, başarısız anahtar denemelerinde IP başına 15 dakikada 30 deneme sınırı vardır. `429` durumunda isteği yavaşlatıp bekleyin.", "Keys expire after 180 days; a customer may have at most two active keys. The limit is 300 requests per credential per 5 minutes, and 30 failed key attempts per IP per 15 minutes. Slow down and wait after a `429` response.")} /></p>
            <Callout title={l("S3 yüklemesi", "S3 upload")}><Inline text={l("Presigned URL'ye yapılan PUT isteğinde EasyJet API anahtarını veya Idempotency-Key header'ını göndermeyin. URL kısa süreli erişim bilgisidir; loglamayın.", "Do not send the EasyJet API key or Idempotency-Key header to a presigned URL. The URL is a short-lived access credential; do not log it.")} /></Callout>
          </Section>

          <Section id="catalog" eyebrow={l("ADIM 01", "STEP 01")} title={l("Müşteriye açık ürünleri alın", "List available transfer products")}>
            <Endpoint method="GET" path={BASE + "/catalog/transfer-products"} description="Scope: catalog:read" />
            <p><Inline text={l("Yanıt, customer'ın bağlı olduğu şirket ve yetkili kategoriler içindeki aktif transfer ürünleridir. Ürün adını değil `id` UUID'sini eşleme anahtarı olarak kullanın. `without_design: false` ise tasarım yüklemek gerekir.", "The response lists active transfer products in the customer's company and authorized categories. Map products using the `id` UUID, not the display name. A product with `without_design: false` requires a design upload.")} /></p>
            <Code title="cURL · catalog">{examples.catalogCurl}</Code>
            <Code title={l("200 · örnek yanıt (temsili UUID'ler)", "200 · example response (sample UUIDs)")}>{json({
              success: true,
              data: [{
                id: PRODUCT_ID, name: "Transfer Product", without_design: false,
                category: { id: "66666666-6666-4666-8666-666666666666", name: "Transfer" },
                sub_category: { id: SUB_CATEGORY_ID, name: "Standard" },
                updated_at: "2026-09-23T10:00:00.000Z",
              }],
            })}</Code>
            <Fields rows={[
              ["id", "UUID", l("Order item içindeki transfer_product_id olarak kullanılır.", "Use as transfer_product_id in an order item.")],
              ["without_design", "boolean", l("false ise ilgili sub-category için tamamlanmış tasarım gerekir.", "If false, the sub-category needs a completed design.")],
              ["sub_category.id", "UUID", l("Design upload init içindeki sub_category_id değeridir.", "Use as sub_category_id when initializing a design upload.")],
              ["category / sub_category", "object", l("Eşleme ve kullanıcı arayüzü için kategori bilgileri.", "Category details for mapping and display.")],
              ["updated_at", l("ISO tarih", "ISO date"), l("Ürün eşlemesini yenilemek için değişiklik göstergesidir.", "Use to detect changes to your product mapping.")],
            ]} />
          </Section>

          <Section id="order" eyebrow={l("ADIM 02", "STEP 02")} title={l("Taslak transfer order oluşturun", "Create a draft transfer order")}>
            <Endpoint method="POST" path={BASE + "/transfer-orders"} description="Scope: transfer_orders:write · 201" />
            <p><Inline text={l("`external_order_id` müşteri içinde kalıcı olarak benzersizdir. Her item için benzersiz `external_item_id` gönderin. EasyJet ürün fiyatlarını kendi tablolarından hesaplar ve order ile item'ları `newOrder` durumunda oluşturur.", "`external_order_id` must remain unique within the customer. Send a distinct `external_item_id` for each item. EasyJet calculates prices from its own tables and creates the order and items in `newOrder` status.")} /></p>
            <Code title={l("cURL · sipariş oluştur", "cURL · create order")}>{examples.orderCurl}</Code>
            <Fields rows={[
              ["external_order_id", l("zorunlu · string ≤ 255", "required · string ≤ 255"), l("Sizin sisteminizdeki değişmeyen order ID.", "Your stable order ID.")],
              ["order_number", l("zorunlu · string ≤ 200", "required · string ≤ 200"), l("Görünen numara; boşluk içeremez ve customer içinde benzersizdir.", "Display number; no spaces and unique within the customer.")],
              ["order_date", l("zorunlu · ISO 8601", "required · ISO 8601"), l("Tarih/saat; örnekte UTC Z kullanıldı.", "Date and time; the example uses UTC Z.")],
              ["ship_to_street1 / city / state / postal_code / country", l("zorunlu · string", "required · string"), l("Teslimat adresi. Ülke değeri 2–100 karakter.", "Shipping address. Country value is 2–100 characters.")],
              ["ship_to_name", l("opsiyonel · string ≤ 300", "optional · string ≤ 300"), l("Alıcı adı.", "Recipient name.")],
              ["ship_to_company / street2 / phone", l("opsiyonel · string", "optional · string"), l("Ek teslimat bilgileri.", "Additional shipping details.")],
              ["customer_email / notes", l("opsiyonel · email / string", "optional · email / string"), l("E-posta ve en fazla 2000 karakter not.", "Email and notes up to 2,000 characters.")],
              ["items", l("zorunlu · 1–5000 item", "required · 1–5,000 items"), l("Her item aşağıdaki dört alanı içerir; fazladan alan kabul edilmez.", "Each item contains the four fields below; extra fields are rejected.")],
              ["items[].external_item_id", l("zorunlu · string ≤ 255", "required · string ≤ 255"), l("Order içindeki benzersiz satır kimliğiniz.", "Your unique line ID within this order.")],
              ["items[].transfer_product_id", l("zorunlu · UUID", "required · UUID"), l("Catalog yanıtındaki EasyJet ürün ID.", "EasyJet product ID from the catalog.")],
              ["items[].name / quantity", l("zorunlu · string / integer", "required · string / integer"), l("Ad ≤ 500 karakter; quantity 1–100000.", "Name ≤ 500 characters; quantity 1–100,000.")],
            ]} />
            <Code title={l("201 · yanıtın ilgili alanları", "201 · relevant response fields")}>{json({
              success: true,
              data: {
                id: ORDER_ID, external_order_id: "merchant-1001",
                order_number: "INT-1001", order_status: "newOrder",
                items: [{ external_order_item_id: "line-1", transfer_product_id: PRODUCT_ID, quantity: 2, status: "newOrder" }],
              },
            })}</Code>
            <Callout title={l("Fiyat göndermeyin", "Do not send prices")} warning><Inline text={l("İstek şeması strict'tir. `price`, `multiplier`, `order_status`, `item.status` veya başka tanımsız alanlar `400 BAD_REQUEST` ile reddedilir. Tasarımlı ürün fiyatı tasarım tamamlanınca hesaplanır.", "The request schema is strict. `price`, `multiplier`, `order_status`, `item.status`, and other unknown fields return `400 BAD_REQUEST`. The price of a design product is calculated when its design upload completes.")} /></Callout>
          </Section>

          <Section id="design" eyebrow={l("ADIM 03", "STEP 03")} title={l("Gerekli tasarımları yükleyin", "Upload required designs")}>
            <p><Inline text={l("Catalog'da `without_design: false` olan ürünlerin her farklı `sub_category.id` değeri için en az bir tamamlanmış tasarım gerekir. Dosya boyutunu gerçek byte sayısı olarak gönderin; üst sınır 2 GiB. Tasarım ölçüsü ve fiyat kuralları tamamlamada EasyJet tarafından uygulanır.", "At least one completed design is required for each distinct `sub_category.id` with a product whose `without_design` is false. Send the actual byte length, up to 2 GiB. EasyJet applies design dimensions and pricing rules during completion.")} /></p>
            <Endpoint method="POST" path={BASE + "/transfer-orders/{id}/design-uploads/init"} description="Scope: assets:write · 201" />
            <Code title={l("İstek · design init", "Request · design init")}>{json({
              sub_category_id: SUB_CATEGORY_ID, quantity: 2, file_name: "design.png",
              file_size: 48291, content_type: "image/png",
            })}</Code>
            <Code title={l("201 · design init yanıtı", "201 · design init response")}>{json({
              success: true,
              data: {
                upload_session_id: DESIGN_SESSION_ID, part_size: 8388608, total_parts: 1,
                expires_at: "2026-09-23T11:00:00.000Z", s3_key: "<s3-key>",
                multipart_upload_id: "<s3-multipart-id>",
              },
            })}</Code>
            <p><Inline text={l("`part_size` ve `total_parts` sunucu yanıtından okunmalıdır; örnek değerler sabit kabul edilmemelidir. `quantity` verilmezse 1 kabul edilir. Her POST isteğine ayrı idempotency UUID koyun.", "Read `part_size` and `total_parts` from the server response; do not hardcode the sample values. `quantity` defaults to 1. Use a distinct idempotency UUID for each POST operation.")} /></p>
            <Endpoint method="POST" path={BASE + "/transfer-orders/{id}/design-uploads/part-urls"} description="Scope: assets:write" />
            <Code title={l("İstek · part URL", "Request · part URLs")}>{json({ upload_session_id: DESIGN_SESSION_ID, part_numbers: [1] })}</Code>
            <Code title={l("200 · part URL yanıtı", "200 · part URL response")}>{json({
              success: true,
              data: {
                upload_session_id: DESIGN_SESSION_ID, part_size: 8388608, total_parts: 1,
                urls: [{ part_number: 1, url: "https://<presigned-s3-url>" }],
              },
            })}</Code>
            <p><Inline text={l("Dosyayı `part_size` byte'lık parçalara ayırın; son parça daha küçük olabilir. Her parçayı kendi `part_number` URL'sine ham byte olarak PUT edin. S3 yanıtındaki `ETag` header'ını tırnaklarıyla birlikte saklayın. Tarayıcıdan yükleme yapılacaksa S3 CORS ayarı ETag header'ını görünür kılmalıdır.", "Split the file into `part_size` byte chunks; the last part may be smaller. PUT each raw byte chunk to its own `part_number` URL. Save the S3 response `ETag` header, including its quotes. Browser uploads require S3 CORS to expose the ETag header.")} /></p>
            <Code title={l("Tek parçalı örnek · S3 PUT", "Single-part example · S3 PUT")}>{l(examples.s3Put, examples.s3Put.replace("# Yanıt header:", "# Response header:"))}</Code>
            <Endpoint method="POST" path={BASE + "/transfer-orders/{id}/design-uploads/complete"} description="Scope: assets:write" />
            <Code title={l("İstek · design complete", "Request · design complete")}>{json({
              upload_session_id: DESIGN_SESSION_ID,
              parts: [{ part_number: 1, etag: '"<s3-etag>"' }],
            })}</Code>
            <Code title={l("200 · yanıtın ilgili alanları", "200 · relevant response fields")}>{json({
              success: true,
              data: [{
                id: "55555555-5555-4555-8555-555555555555",
                sub_category_id: SUB_CATEGORY_ID,
                quantity: 2, width: "10.0000", height: "12.0000",
                price: "24.0000", design_status: "newOrder",
              }],
            })}</Code>
            <p><Inline text={l("Başarılı yanıttaki `data` bir tasarım kaydı dizisidir. Gerçek genişlik, yükseklik ve fiyat yüklenen dosyaya ve EasyJet fiyat ayarlarına göre değişir. Boyut/fiyat kuralı sağlanmazsa hatayı giderip yeni upload başlatın.", "The successful `data` response is an array of design records. Actual width, height, and price depend on the uploaded file and EasyJet pricing settings. If a dimension or pricing rule fails, fix the cause and start a new upload.")} /></p>
            <Endpoint method="POST" path={BASE + "/transfer-orders/{id}/design-uploads/abort"} description="Scope: assets:write" />
            <p>{l("Yarım kalan yüklemeyi aşağıdaki body ile iptal edin. Tamamlanmış session iptal edilemez.", "Abort an unfinished upload with the body below. A completed session cannot be aborted.")}</p>
            <Code title={l("İstek · design abort", "Request · design abort")}>{json({ upload_session_id: DESIGN_SESSION_ID })}</Code>
            <Code title={l("200 · design abort yanıtının ilgili alanları", "200 · relevant design abort fields")}>{json({
              success: true, data: { upload_session_id: DESIGN_SESSION_ID, status: "aborted" },
            })}</Code>
          </Section>

          <Section id="label" eyebrow={l("ADIM 04", "STEP 04")} title={l("Kargo etiketini yükleyin", "Upload the shipping label")}>
            <p><Inline text={l("Her production aktarımında PDF veya PNG etiket zorunludur. En büyük dosya 10 MiB'dir (10.485.760 byte). §file_size§ gerçek byte sayısı olmalı; dosya başlangıç imzası bildirilen MIME ile eşleşmelidir.", "Every production submission requires a PDF or PNG label. The maximum is 10 MiB (10,485,760 bytes). §file_size§ must be the actual byte length, and the file signature must match the declared MIME type.")} /></p>
            <Endpoint method="POST" path={BASE + "/transfer-orders/{id}/label-upload/init"} description="Scope: assets:write · 201" />
            <Code title={l("İstek · label init", "Request · label init")}>{json({
              file_name: "label.pdf", file_size: 48291, content_type: "application/pdf",
            })}</Code>
            <Code title={l("201 · label init yanıtı", "201 · label init response")}>{json({
              success: true,
              data: {
                upload_session_id: LABEL_SESSION_ID, part_size: 8388608, total_parts: 1,
                expires_at: "2026-09-23T11:00:00.000Z",
                urls: [{ part_number: 1, url: "https://<presigned-s3-url>" }],
              },
            })}</Code>
            <p><Inline text={l("§urls§ dizisindeki her part'ı doğrudan S3'e ham byte olarak PUT edin ve ETag'leri toplayın. Label session ve URL'ler 1 saat geçerlidir. Süresi dolarsa yeni init çağrısı yapın.", "PUT each raw part from the §urls§ array directly to S3 and collect the ETags. The label session and URLs are valid for one hour. If they expire, start a new init request.")} /></p>
            <Code title={l("Tek parçalı PDF · S3 PUT", "Single-part PDF · S3 PUT")}>{[
              'curl --fail-with-body -X PUT "$LABEL_PART_URL" \\',
              '  --data-binary @label.pdf \\',
              "  -D -",
              "",
              l('# Yanıt header: ETag: "<s3-etag>"', '# Response header: ETag: "<s3-etag>"'),
            ].join("\n")}</Code>
            <Endpoint method="POST" path={BASE + "/transfer-orders/{id}/label-upload/complete"} description="Scope: assets:write" />
            <Code title={l("İstek · label complete", "Request · label complete")}>{json({
              upload_session_id: LABEL_SESSION_ID,
              parts: [{ part_number: 1, etag: '"<s3-etag>"' }],
            })}</Code>
            <Code title={l("200 · label complete yanıtı", "200 · label complete response")}>{json({
              success: true,
              data: { upload_session_id: LABEL_SESSION_ID, status: "completed", content_type: "application/pdf" },
            })}</Code>
            <p>{l("Parçaların tamamı ve doğru sıra gönderilmelidir. Sunucu S3'teki gerçek dosya uzunluğunu ve ilk byte'lardaki PDF/PNG imzasını kontrol eder. Bu kontrol dosyanın tüm yapısının sağlam olduğunu garanti etmez; kendi sisteminizde dosyayı ayrıca doğrulayın.", "Send every part in the correct order. The server checks the actual S3 byte length and the initial PDF/PNG signature. This does not guarantee that the entire PDF or PNG structure is valid; validate the file in your own system as well.")}</p>
            <Callout title={l("Session ile credential ilişkisi", "Session and credential ownership")} warning>{l("Label session aynı order, customer ve onu oluşturan API anahtarıyla tamamlanıp submit edilmelidir. Anahtar değiştirmeniz gerekiyorsa yeni anahtarla yeni label session başlatın.", "A label session must be completed and submitted with the same order, customer, and API key that created it. If you rotate the key, start a new label session with the new key.")}</Callout>
          </Section>

          <Section id="submit" eyebrow={l("ADIM 05", "STEP 05")} title={l("Siparişi production'a gönderin", "Submit the order to production")}>
            <Endpoint method="POST" path={BASE + "/transfer-orders/{id}/submit"} description="Scope: production:submit" />
            <Code title="cURL · submit">{examples.submitCurl}</Code>
            <Code title={l("200 · yanıtın ilgili alanları", "200 · relevant response fields")}>{json({
              success: true, data: { id: ORDER_ID, order_status: "processing", label_purchase_option: "has_label" },
            })}</Code>
            <p><Inline text={l("Sunucu, siparişin `newOrder` veya `waitingForDesign` durumunda olduğunu, gerekli her sub-category'de tasarım ve tamamlanmış label bulunduğunu denetler. Başarılı istekte order, item ve design durumları tek transaction içinde `processing` olur ve etiket kaydı iliştirilir. Submit body'sinde yalnızca `label_upload_session_id` bulunur.", "The server checks that the order is in `newOrder` or `waitingForDesign` status and that every required sub-category has a design and a completed label exists. On success, order, item, and design statuses become `processing` in one transaction, and the label is attached. The submit body contains only `label_upload_session_id`.")} /></p>
            <Callout title={l("Başarısız submit", "Failed submission")}>{l("Eksik tasarım veya label varsa hata döner; sipariş production'a geçirilmez. Durumu GET ile okuyup eksik adımı tamamlayın, ardından yeni submit isteği gönderin.", "A missing design or label returns an error and does not move the order into production. Read its status with GET, complete the missing step, then send a new submit request.")}</Callout>
          </Section>

          <Section id="status" eyebrow={l("ADIM 06", "STEP 06")} title={l("Sipariş ve kargo durumunu izleyin", "Track order and shipping status")}>
            <Endpoint method="GET" path={BASE + "/transfer-orders/{id}"} description="Scope: transfer_orders:read" />
            <Endpoint method="GET" path={BASE + "/transfer-orders/by-external-id/{externalOrderId}"} description="Scope: transfer_orders:read" />
            <Code title={l("cURL · kendi order ID'nizle sorgula", "cURL · look up by your external ID")}>{examples.statusCurl}</Code>
            <Code title={l("200 · yanıtın ilgili alanları", "200 · relevant response fields")}>{json({
              success: true,
              data: {
                id: ORDER_ID, external_order_id: "merchant-1001", order_status: "processing",
                fulfillment_status: null,
                items: [{ external_order_item_id: "line-1", status: "processing" }],
                designs: [{ sub_category_id: SUB_CATEGORY_ID, design_status: "processing" }],
                transfer_labels: [{ source: "self_label", status: "active" }],
                shipments: [],
              },
            })}</Code>
            <p><Inline text={l("Bu örnek yalnızca takipte kullanılan alanları gösterir; gerçek order kaydında ek alanlar bulunur. `transfer_labels` dizisi etiket kaydının ilişkilendirildiğini gösterir. Upload session'ın ayrı GET endpoint'i yoktur; label tamamlanma sonucu `label-upload/complete` yanıtında görülür.", "This example shows only the fields used for tracking; the actual order record contains more fields. The `transfer_labels` array shows that the label record is attached. There is no separate GET endpoint for an upload session; the label completion result comes from `label-upload/complete`.")} /></p>
            <p><Inline text={l("V1'de webhook yoktur. İhtiyacınıza göre aralıklı GET çağrısı yapın; `order_status`, `items[].status`, `designs[].design_status`, `shipments[].status` ve `shipments[].fulfillment_status` alanlarını değerlendirin. GET çağrısında idempotency header'ı gerekmez.", "V1 does not provide webhooks. Poll with GET at an appropriate interval and inspect `order_status`, `items[].status`, `designs[].design_status`, `shipments[].status`, and `shipments[].fulfillment_status`. GET requests do not need an idempotency header.")} /></p>
          </Section>

          <Section id="idempotency" eyebrow={l("GÜVENİLİR TEKRAR DENEME", "SAFE RETRIES")} title={l("Idempotency ve benzersiz ID kuralları", "Idempotency and unique ID rules")}>
            <p><Inline text={l("Her EasyJet POST çağrısında UUID biçimli `Idempotency-Key` zorunludur. Her yeni işlem için yeni UUID üretin; timeout veya ağ hatası sonrası aynı işlemi aynı body ve aynı key ile tekrar gönderin. Kayıtlar credential + endpoint + idempotency key kapsamında 7 gün tutulur.", "Every EasyJet POST requires a UUID `Idempotency-Key`. Generate a new UUID for each new operation; after a timeout or network failure, retry the same operation with the same body and key. Records are kept for seven days per credential, endpoint, and idempotency key.")} /></p>
            <Fields headings={l(["Durum", "HTTP", "Sonuç / yapılacak işlem"], ["Scenario", "HTTP", "Result / action"])} rows={[
              [l("Aynı key + aynı payload", "Same key + same payload"), l("önceki HTTP status", "previous HTTP status"), l("Kaydedilmiş yanıt tekrar döner; Idempotency-Replayed: true header'ı eklenir.", "The stored response is returned with Idempotency-Replayed: true.")],
              [l("Aynı key + farklı payload", "Same key + different payload"), "409", l("IDEMPOTENCY_CONFLICT. Yeni işlem için yeni key kullanın.", "IDEMPOTENCY_CONFLICT. Use a new key for a new operation.")],
              [l("İlk işlem henüz sürüyor", "First request still running"), "409", l("IDEMPOTENCY_IN_PROGRESS. Kısa süre sonra aynı istekle tekrar deneyin.", "IDEMPOTENCY_IN_PROGRESS. Retry the same request shortly.")],
              [l("Aynı external_order_id + yeni key", "Same external_order_id + new key"), "409", l("ORDER_ALREADY_EXISTS. details.transfer_order_id ile mevcut order'ı bulun.", "ORDER_ALREADY_EXISTS. Find the existing order using details.transfer_order_id.")],
              [l("Aynı order_number + yeni key", "Same order_number + new key"), "409", l("ORDER_NUMBER_ALREADY_EXISTS. Mevcut order bilgisi details içinde döner.", "ORDER_NUMBER_ALREADY_EXISTS. Details contain the existing order.")],
            ]} />
            <Callout title={l("Önerilen kalıcı kayıt", "What to store")}><Inline text={l("Kendi sisteminizde `external_order_id`, EasyJet `order.id`, her POST için idempotency UUID, design/label session ID ve S3 parça ETag'lerini saklayın. Böylece işlem kaldığı yerden devam eder.", "Store `external_order_id`, EasyJet `order.id`, each POST idempotency UUID, design/label session IDs, and S3 part ETags in your system. This lets you resume after interruptions.")} /></Callout>
          </Section>

          <Section id="errors" eyebrow={l("HATA SÖZLEŞMESİ", "ERROR CONTRACT")} title={l("Hataları nasıl ele alırsınız?", "How to handle errors")}>
            <Code title={l("Hata yanıtı örneği", "Example error response")}>{json({
              success: false,
              error: {
                code: "BAD_REQUEST", message: "Validation error",
                details: { formErrors: [], fieldErrors: { items: ["Required"] } },
                request_id: "<request-id>",
              },
            })}</Code>
            <p><Inline text={l("`details` hata türüne göre değişebilir veya bulunmayabilir. Validation için `fieldErrors` ve `formErrors` alanlarını okuyun. `request_id` değeri ayrıca `X-Request-Id` yanıt header'ında bulunur; destek talebine bunu ekleyin, API key veya presigned URL eklemeyin.", "`details` varies by error type and may be absent. For validation failures, inspect `fieldErrors` and `formErrors`. `request_id` is also in the `X-Request-Id` response header; include it in support requests, but never include an API key or presigned URL.")} /></p>
            <Fields headings={l(["HTTP", "Kod", "Ne yapmalı?"], ["HTTP", "Code", "What to do"])} rows={[
              ["400", "BAD_REQUEST", l("İstek şemasını, ürün/kategori eşlemesini, parçaları veya eksik tasarım/etiketi düzeltin.", "Correct the request schema, product/category mapping, parts, or missing design/label.")],
              ["400", "HTTPS_REQUIRED", l("Production isteğini HTTPS üzerinden yeniden gönderin.", "Retry the production request over HTTPS.")],
              ["401", "UNAUTHORIZED", l("Anahtar biçimini, süresini ve iptal durumunu kontrol edin.", "Check key format, expiry, and revocation.")],
              ["403", "FORBIDDEN", l("Credential scope ve customer yetkilerini kontrol edin.", "Check credential scopes and customer permissions.")],
              ["404", "NOT_FOUND", l("Order/session ID'yi kontrol edin. Başka customer'ın kaynağı da bulunamaz görünür.", "Check the order/session ID. Another customer's resource is also hidden.")],
              ["409", "IDEMPOTENCY_CONFLICT / IDEMPOTENCY_IN_PROGRESS", l("Key'in body içeriğini değiştirmeyin; sürmekte olan isteği bekleyin.", "Do not change a key's request body; wait for the running request.")],
              ["409", "ORDER_ALREADY_EXISTS / ORDER_NUMBER_ALREADY_EXISTS", l("error.details.transfer_order_id ile mevcut order'ı sorgulayın.", "Look up the existing order using error.details.transfer_order_id.")],
              ["409", "ORDER_NOT_SUBMIT_READY", l("Order durumunu GET ile okuyun; zaten production'a gitmiş olabilir.", "Read the order with GET; it may already be in production.")],
              ["429", "TooManyRequestsError", l("İstek sıklığını azaltıp artan bekleme süresiyle tekrar deneyin.", "Reduce request frequency and retry with increasing delays.")],
              ["500", "INTERNAL", l("Aynı POST key ile tekrar deneyin; devam ederse request ID ile destek isteyin.", "Retry with the same POST key; if it persists, contact support with the request ID.")],
            ]} />
            <p>{l("İstek doğrulama hataları tekrar denemeyle düzelmez. Ağ kopması veya geçici sunucu hatasında aynı POST idempotency key'ini koruyun. Yeni business işlemi başlatıyorsanız yeni UUID üretin.", "Validation errors require a corrected request. For a network failure or temporary server error, keep the same POST idempotency key. Generate a new UUID for a new business operation.")}</p>
          </Section>

          <Section id="rotation" eyebrow={l("OPERASYON", "OPERATIONS")} title={l("API anahtarını döndürme", "Rotate an API key")}>
            <ol className={styles.numbered}>
              <li>{l("CustomerAdmin, Settings → API Configuration'da ikinci anahtarı oluşturur ve mevcut parolasını girer.", "The CustomerAdmin creates a second key in Settings → API Configuration and enters their current password.")}</li>
              <li>{l("Bir kez gösterilen secret'ı sunucu secret yöneticisine kaydeder; yeni anahtarı deploy eder.", "Save the one-time secret in a server-side secret manager and deploy the new key.")}</li>
              <li>{l("Catalog ve GET durum çağrılarıyla yeni anahtarın çalıştığını doğrular. Devam eden label upload'ları eski credential'a bağlıysa onları tamamlar veya yeni anahtarla yeniden başlatır.", "Verify the new key with catalog and status GET requests. Finish label uploads tied to the old key, or start new sessions with the new key.")}</li>
              <li>{l("Eski anahtarı ayarlardan iptal eder; iptal anından itibaren istekler reddedilir.", "Revoke the old key in settings. Requests using it are rejected immediately.")}</li>
            </ol>
            <p>{l("Süre bitimine 30 ve 7 gün kala ayarlar ekranı uyarı gösterir. İki aktif anahtar sınırı, geçiş sırasında iki anahtarın çalışmasına izin verir.", "Settings warns you 30 and 7 days before expiry. The two-active-key limit lets both keys work during a rotation.")}</p>
          </Section>

          <Section id="checklist" eyebrow={l("SON KONTROL", "FINAL CHECK")} title={l("Canlıya almadan önce", "Before going live")}>
            <ul className={styles.checklist}>
              <li>{l("API host ve anahtarı sunucu ortam değişkenlerinde tuttum; loglara secret veya presigned URL yazmıyorum.", "I store the API host and key in server environment variables and never log secrets or presigned URLs.")}</li>
              <li>{l("Catalog UUID'leriyle ürün eşlemesini yaptım; tasarım gerektiren sub-category'leri biliyorum.", "I mapped products using catalog UUIDs and know which sub-categories need designs.")}</li>
              <li>{l("Her POST'a yeni UUID veriyor, ağ hatasında aynı key + aynı body ile tekrar deniyorum.", "I give every new POST operation a UUID and reuse the same key and body after a network failure.")}</li>
              <li>{l("Her S3 part'ını doğru byte aralığıyla yükleyip ETag'i saklıyorum.", "I upload each S3 part with the correct byte range and save its ETag.")}</li>
              <li>{l("PDF/PNG label'ı tamamlıyor, ardından submit çağırıyor ve GET ile production durumunu görüyorum.", "I complete the PDF/PNG label, call submit, then verify production status with GET.")}</li>
              <li>{l("401, 409, 429 ve validation hatalarını kodlarına göre ele alıyor; durumu makul aralıkla sorguluyorum.", "I handle 401, 409, 429, and validation errors by code and poll status at a reasonable interval.")}</li>
            </ul>
            <div className={styles.footerLinks}>
              <Link href="/dashboard/settings">{l("API anahtarlarına dön →", "Back to API keys →")}</Link>
              <a href={OPENAPI_URL} target="_blank" rel="noopener noreferrer">{l("Makine okunabilir OpenAPI JSON ↗", "Machine-readable OpenAPI JSON ↗")}</a>
            </div>
          </Section>
        </main>
      </div>
    </div>
  );
}

export default function CustomerApiDocsPage() {
  return <RequireRole anyOfRoles={["customerAdmin"]}><Docs /></RequireRole>;
}
