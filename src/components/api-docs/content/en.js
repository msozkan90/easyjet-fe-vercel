// English content of the API docs page. Endpoint texts come from the OpenAPI document.
const en = {
  title: "EasyJet API",
  subtitle:
    "Create orders, send designs and buy shipping labels from your own system. EasyJet produces and ships them.",
  nav: { guides: "Guides", reference: "API reference" },
  ui: {
    baseUrl: "Base URL",
    version: "Version",
    downloadPostman: "Download Postman collection",
    manageKeys: "Manage API keys",
    copy: "Copy",
    copied: "Copied",
    required: "required",
    optional: "optional",
    nullable: "nullable",
    field: "Field",
    type: "Type",
    description: "Description",
    parameter: "Parameter",
    location: "In",
    status: "Status",
    code: "Code",
    requestBody: "Request body",
    responses: "Responses",
    parameters: "Parameters",
    example: "Example",
    codeSamples: "Code samples",
    loading: "Loading the API reference…",
    loadError: "The API reference could not be loaded.",
    retry: "Retry",
    search: "Search endpoints",
    onThisPage: "On this page",
  },
  guides: [
    {
      id: "overview",
      title: "Overview",
      blocks: [
        {
          p: "The EasyJet API lets you run EasyJet fulfillment from your own panel: you keep your orders and designs, EasyJet prints, packs and ships them. Every request is made with an API key of your EasyJet account; prices, products and rules are the same as in the EasyJet panel.",
        },
        { h: "The flow" },
        {
          steps: [
            "Read the catalog: products, variants, print positions and your prices.",
            "Create an order with its items (status `newOrder`).",
            "Send the designs of each item: public https URLs (recommended) or file uploads.",
            "Get EasyJet label rates for your package, or prepare your own label.",
            "Check the total with a quote, then fulfill: the label is bought, your wallet is charged and the items move to `processing`.",
            "EasyJet takes over production. Follow the order status and the shipment tracking number.",
          ],
        },
        {
          note: "After fulfillment the order belongs to EasyJet production. Through the API you can then only read it and cancel it (not after it shipped).",
        },
      ],
    },
    {
      id: "quickstart",
      title: "Quickstart",
      blocks: [
        {
          p: "1. Create a **test** key in Settings → API Keys. Test keys never produce anything or charge money.",
        },
        { p: "2. Check the key:" },
        {
          code: 'curl {{baseUrl}}/me -H "Authorization: Bearer $EASYJET_API_KEY"',
          lang: "bash",
        },
        { p: "3. Pick a product variant and a print position:" },
        {
          code: 'curl "{{baseUrl}}/products?expand=variants,positions&page_size=5" -H "Authorization: Bearer $EASYJET_API_KEY"',
          lang: "bash",
        },
        { p: "4. Create an order:" },
        {
          code: 'curl -X POST {{baseUrl}}/orders \\\n  -H "Authorization: Bearer $EASYJET_API_KEY" \\\n  -H "Idempotency-Key: $(uuidgen)" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"reference":"ERP-1001","ship_to":{"name":"Jane Doe","street1":"1 Market St","city":"San Francisco","state":"CA","postal_code":"94105","country":"US"},"items":[{"product_id":"…","size_id":"…","color_id":"…","quantity":1}]}\'',
          lang: "bash",
        },
        {
          p: "5. Send the design by URL, then get rates, quote and fulfill. Each step is described in the guides below and in the API reference.",
        },
        {
          p: "The Postman collection runs this whole flow request by request.",
        },
      ],
    },
    {
      id: "authentication",
      title: "Authentication",
      blocks: [
        {
          p: "Send your API key in the `Authorization` header: `Authorization: Bearer ej_test_…`. Keys are shown once when created; EasyJet stores only a hash.",
        },
        {
          table: {
            head: ["Key", "Environment"],
            rows: [
              [
                "`ej_test_…`",
                "Sandbox: same rules and responses, nothing is produced, stored in S3 or charged.",
              ],
              [
                "`ej_live_…`",
                "Live: real orders, designs, labels and wallet charges. Available after EasyJet approves live access.",
              ],
            ],
          },
        },
        { h: "Scopes" },
        {
          p: "Each key has the scopes you selected. A request without the needed scope returns `403 INSUFFICIENT_SCOPE`.",
        },
        {
          table: {
            head: ["Scope", "Allows"],
            rows: [
              ["`catalog:read`", "Products, variants, prices, positions"],
              ["`orders:read`", "Orders and design imports"],
              ["`orders:write`", "Create, update and cancel orders"],
              ["`designs:write`", "Add and delete designs"],
              ["`shipping:read`", "Label rates and quotes"],
              ["`shipping:purchase`", "Fulfillment (charges the wallet)"],
              ["`wallet:read`", "Balance and transactions"],
              ["`webhooks:manage`", "Webhook endpoints"],
            ],
          },
        },
        { h: "Good practice" },
        {
          list: [
            "Keep keys on your server only, never in a browser or mobile app.",
            "Restrict live keys to your server IPs (IP allowlist) and give each system its own key.",
            "Rotate a key from Settings: the old key keeps working for 24 hours.",
          ],
        },
      ],
    },
    {
      id: "sandbox",
      title: "Sandbox (test keys)",
      blocks: [
        {
          p: "Test keys use the same endpoints, validation, prices and statuses as live keys, but their data is kept apart from real orders.",
        },
        {
          list: [
            "Sandbox orders expire 30 days after their last change; up to 500 per account. `POST /sandbox/reset` deletes them.",
            "Design URLs are downloaded and checked, but not copied; uploaded files are checked and discarded.",
            "Label rates are test rates calculated from the package. A ship-to postal code `00000` returns no rates.",
            "A sandbox wallet starts at 1000.00 USD; fulfillment and refunds move it like the real wallet.",
            "EasyJet production does not run in the sandbox: `POST /sandbox/orders/{id}/advance` moves an order `processing → completed → shipped` so you can test what happens next.",
          ],
        },
      ],
    },
    {
      id: "conventions",
      title: "Requests and responses",
      blocks: [
        {
          p: "Requests and responses are JSON (designs and own labels may be multipart). Every response has the same envelope:",
        },
        {
          code: '{\n  "success": true,\n  "data": { … },\n  "pagination": { "page": 1, "page_size": 25, "total": 120, "total_pages": 5 },\n  "meta": { "request_id": "6e3f9a4c-…" }\n}',
          lang: "json",
        },
        {
          list: [
            "Lists accept `page` and `page_size` (max 100).",
            'Money is a string with 4 decimals in USD, e.g. `"12.5000"`.',
            "Dates are ISO 8601 in UTC.",
            "Keep `meta.request_id` (also the `X-Request-Id` header) when contacting support.",
          ],
        },
        { h: "Order statuses" },
        {
          table: {
            head: ["Status", "Meaning"],
            rows: [
              [
                "`newOrder`",
                "Created; designs can be changed; ready for fulfillment once designs are complete.",
              ],
              ["`waitingForDesign`", "Marked by you as waiting for designs."],
              ["`readyForProduction`", "Waiting in EasyJet production."],
              ["`processing`", "Label bought; in production."],
              ["`pdf`", "Print files prepared; in production."],
              ["`designFlaw`", "EasyJet found a design problem."],
              ["`completed`", "Produced, waiting to ship."],
              ["`shipped`", "Handed to the carrier."],
              ["`cancel`", "Cancelled."],
              ["`refund`", "Refunded."],
              ["`remake`", "Remade."],
            ],
          },
        },
        {
          p: "Shipments use `preparing`, `processing`, `completed`, `shipped`, `label_required` and `canceled`.",
        },
      ],
    },
    {
      id: "errors",
      title: "Errors",
      blocks: [
        {
          p: "Errors return `success: false` with a stable `error.code` you can branch on, a readable `message` and, when useful, `details` (for example every invalid field).",
        },
        {
          code: '{\n  "success": false,\n  "error": {\n    "code": "VALIDATION_ERROR",\n    "message": "Validation error",\n    "details": [{ "path": "items.0.quantity", "message": "Too small" }]\n  },\n  "meta": { "request_id": "…" }\n}',
          lang: "json",
        },
        { errorCodes: true },
      ],
    },
    {
      id: "rate-limits",
      title: "Rate limits",
      blocks: [
        {
          p: "Limits are per API key and minute; `GET /me` shows yours. Responses carry `RateLimit` and `RateLimit-Policy` headers; a `429 RATE_LIMITED` response has `Retry-After`.",
        },
        {
          table: {
            head: ["Class", "Standard", "High"],
            rows: [
              ["Reads (GET)", "120", "600"],
              ["Writes", "30", "120"],
              ["Uploads and design imports", "20", "60"],
              ["Fulfillment", "10", "40"],
            ],
          },
        },
        {
          p: "Repeated requests with invalid keys from one IP are blocked for 15 minutes.",
        },
      ],
    },
    {
      id: "idempotency",
      title: "Idempotency",
      blocks: [
        {
          p: "Send an `Idempotency-Key` header (for example a UUID) with POST requests. If the network fails, retry with the same key: you get the first response back (`Idempotent-Replayed: true`) and nothing is created or charged twice. Keys are kept for 24 hours per API key.",
        },
        {
          list: [
            "Required for `POST /orders/{id}/fulfill`.",
            "The same key with a different body returns `409 IDEMPOTENCY_KEY_REUSED`.",
            "While the first request is still running, a retry returns `409 IDEMPOTENCY_REQUEST_IN_PROGRESS`.",
          ],
        },
      ],
    },
    {
      id: "designs",
      title: "Designs",
      blocks: [
        {
          p: "Each item needs at least one design before fulfillment. A design belongs to a print position of the product (`front`, `back`, …).",
        },
        { h: "From URLs (recommended)" },
        {
          p: "Send public https URLs as JSON. EasyJet downloads each file in the background, checks it and keeps its own copy, so your URL only has to work until the import completes. The response is `202` with a design import; follow it with `GET /design-imports/{id}` or `design_imports` on the item.",
        },
        {
          code: '{\n  "designs": [\n    { "url": "https://cdn.example.com/front.png", "position": "front" },\n    { "url": "https://cdn.example.com/back.png", "position": "back" }\n  ]\n}',
          lang: "json",
        },
        {
          list: [
            "https on port 443 only; private or internal addresses are refused.",
            "Up to 20 URLs per request and 2 GB per file. Download problems are retried; permanent ones (404, wrong file type) fail with a clear error code.",
            "Accepted types: png, jpg, pdf, svg, tiff, webp, gif, bmp, avif, heic, dst.",
          ],
        },
        { h: "As files" },
        {
          p: "Or upload files as multipart/form-data, one field per position: `-F front=@front.png`. Up to 20 files of 200 MB.",
        },
        { h: "Rules" },
        {
          list: [
            "A new design replaces the design of its position.",
            "Each position after the first adds `additional_position_price × quantity` to the item.",
            "Products with `requires_routing_selection: true` need `routing_sub_category_id` (one of the product's `sub_categories`) on the first design of each item.",
            "Personalized items with quantity > 1 can use one design set per unit group: send `designs` with `group` and `quantity`; the quantities must add up to the item quantity.",
          ],
        },
      ],
    },
    {
      id: "shipping",
      title: "Shipping and production",
      blocks: [
        {
          steps: [
            "`POST /orders/{id}/shipping/rates` with the package weight and dimensions returns EasyJet label rates. Each `rate_id` is valid for 15 minutes.",
            "`POST /orders/{id}/shipping/quote` shows the order price, shipping price, total and whether your wallet covers it.",
            '`POST /orders/{id}/fulfill` with `{ "rate_id" }` buys the label, or send your own label as multipart `label_file` (no shipping charge). The wallet is charged and items move to `processing`.',
          ],
        },
        {
          p: "Only items in `newOrder` with complete designs go to production. Top up the wallet in the EasyJet panel if the quote says it is not sufficient.",
        },
        { h: "Cancellation" },
        {
          p: "Before fulfillment, cancelling costs nothing. After fulfillment the label is voided and the shipping price is refunded, but the production price is not. Shipped orders cannot be cancelled.",
        },
      ],
    },
    {
      id: "webhooks",
      title: "Webhooks",
      blocks: [
        {
          p: "Instead of polling, let EasyJet call your https endpoint when something happens. Create endpoints with `POST /webhooks` (scope `webhooks:manage`) or in Settings → API Keys. An endpoint belongs to the environment of the key that created it: test keys receive sandbox events, live keys live events.",
        },
        {
          table: {
            head: ["Event", "When"],
            rows: [
              [
                "`order.status_changed`",
                "The order status changed (data: `previous_status`, `status`, `order`). Includes `designFlaw`, `completed`, `cancel`…",
              ],
              [
                "`shipment.label_created`",
                "A label was bought or uploaded at fulfillment (data: `order`, `shipment`).",
              ],
              [
                "`order.shipped`",
                "A shipment was handed to the carrier, with its tracking number (data: `order`, `shipment`).",
              ],
              [
                "`design_import.completed`",
                "Designs from URLs were stored (data: `design_import`, `order`).",
              ],
              [
                "`design_import.failed`",
                "A design import failed after retries (data: `design_import` with `error`).",
              ],
              ["`webhook.test`", "Sent by `POST /webhooks/{id}/test`."],
            ],
          },
        },
        { h: "Payload" },
        {
          p: "Every event is a JSON POST. `data.order` is the order as it is when the event is sent, in the same shape as `GET /orders/{id}`. The event `id` stays the same across retries: use it to ignore duplicates.",
        },
        {
          code: '{\n  "id": "9b1c…",\n  "type": "order.status_changed",\n  "created_at": "2026-10-19T12:00:00.000Z",\n  "environment": "live",\n  "data": {\n    "previous_status": "processing",\n    "status": "completed",\n    "order": { "id": "…", "order_number": "API-ERP-1001", "status": "completed", "items": [ … ], "shipments": [ … ] }\n  }\n}',
          lang: "json",
        },
        { h: "Verifying the signature" },
        {
          p: "Each request has an `EasyJet-Signature: t=<unix time>,v1=<hex>` header: an HMAC-SHA256 of `<t>.<raw body>` with your endpoint secret (`whsec_…`, shown once when created or rotated). Reject requests with a wrong signature or a timestamp older than 5 minutes. `EasyJet-Event-Id`, `EasyJet-Event-Type` and `EasyJet-Delivery-Id` headers are also sent.",
        },
        {
          code: 'import crypto from "node:crypto";\n\n// Use the raw request body, before JSON parsing.\nfunction verifyEasyJetSignature(rawBody, header, secret, toleranceSeconds = 300) {\n  const parts = Object.fromEntries(header.split(",").map((part) => part.split("=")));\n  const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex");\n  const fresh = Math.abs(Date.now() / 1000 - Number(parts.t)) <= toleranceSeconds;\n  return fresh && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1 ?? ""));\n}',
          lang: "javascript",
        },
        {
          code: "function verifyEasyJetSignature(string $rawBody, string $header, string $secret): bool {\n    parse_str(str_replace(',', '&', $header), $parts);\n    $expected = hash_hmac('sha256', $parts['t'] . '.' . $rawBody, $secret);\n    return abs(time() - (int) $parts['t']) <= 300 && hash_equals($expected, $parts['v1'] ?? '');\n}",
          lang: "php",
        },
        {
          code: 'import hashlib, hmac, time\n\ndef verify_easyjet_signature(raw_body: bytes, header: str, secret: str) -> bool:\n    parts = dict(part.split("=", 1) for part in header.split(","))\n    expected = hmac.new(secret.encode(), f"{parts[\'t\']}.".encode() + raw_body, hashlib.sha256).hexdigest()\n    return abs(time.time() - int(parts["t"])) <= 300 and hmac.compare_digest(expected, parts.get("v1", ""))',
          lang: "python",
        },
        { h: "Delivery" },
        {
          list: [
            "Answer with any 2xx status within 10 seconds; do the work afterwards.",
            'Failed deliveries are retried for about 2 hours (30s, 1m, 2m … 64m). After 20 failed deliveries in a row the endpoint is disabled; enable it again with `PATCH /webhooks/{id}` `{"enabled": true}`.',
            "Events can arrive out of order or more than once. Use `created_at` and the order's current `status`.",
            "Every attempt is listed in `GET /webhooks/{id}/deliveries` for 30 days; resend one with `POST …/deliveries/{deliveryId}/retry`.",
            "Endpoints must be public https URLs (port 443).",
          ],
        },
      ],
    },
    {
      id: "postman",
      title: "Postman",
      blocks: [
        {
          p: "Download the collection, import it into Postman, set the `apiKey` collection variable to a test key and run the folders in order. Ids found in responses (product, order, item, rate…) are stored automatically, and POST requests get an `Idempotency-Key`.",
        },
        { postman: true },
      ],
    },
  ],
  operations: {},
};

export default en;
