// Turkish content of the API docs page; `operations` translates endpoint summaries.
const tr = {
  title: "EasyJet API",
  subtitle:
    "Kendi sisteminizden sipariş oluşturun, tasarım gönderin ve kargo etiketi alın. Üretim ve kargoyu EasyJet yapar.",
  nav: { guides: "Rehberler", reference: "API referansı" },
  ui: {
    baseUrl: "Temel URL",
    version: "Sürüm",
    downloadPostman: "Postman koleksiyonunu indir",
    manageKeys: "API anahtarlarını yönet",
    copy: "Kopyala",
    copied: "Kopyalandı",
    required: "zorunlu",
    optional: "isteğe bağlı",
    nullable: "null olabilir",
    field: "Alan",
    type: "Tip",
    description: "Açıklama",
    parameter: "Parametre",
    location: "Konum",
    status: "Durum",
    code: "Kod",
    requestBody: "İstek gövdesi",
    responses: "Yanıtlar",
    parameters: "Parametreler",
    example: "Örnek",
    codeSamples: "Kod örnekleri",
    loading: "API referansı yükleniyor…",
    loadError: "API referansı yüklenemedi.",
    retry: "Tekrar dene",
    search: "Endpoint ara",
    onThisPage: "Bu sayfada",
  },
  guides: [
    {
      id: "overview",
      title: "Genel bakış",
      blocks: [
        {
          p: "EasyJet API ile EasyJet üretimini kendi panelinizden yönetirsiniz: siparişleriniz ve tasarımlarınız sizde kalır, baskı, paketleme ve kargoyu EasyJet yapar. Her istek EasyJet hesabınıza ait bir API anahtarıyla yapılır; ürünler, fiyatlar ve kurallar EasyJet panelindekiyle aynıdır.",
        },
        { h: "Akış" },
        {
          steps: [
            "Kataloğu okuyun: ürünler, varyantlar, baskı pozisyonları ve fiyatlarınız.",
            "Siparişi satırlarıyla oluşturun (durum `newOrder`).",
            "Her satırın tasarımlarını gönderin: herkese açık https URL'leri (önerilen) veya dosya yükleme.",
            "Paketiniz için EasyJet etiket ücretlerini alın ya da kendi etiketinizi hazırlayın.",
            "Toplamı quote ile kontrol edin, ardından fulfill edin: etiket alınır, bakiyenizden düşülür ve satırlar `processing` durumuna geçer.",
            "Üretimi EasyJet devralır. Sipariş durumunu ve kargo takip numarasını izleyin.",
          ],
        },
        {
          note: "Fulfill sonrasında sipariş EasyJet üretimindedir. API ile artık yalnızca okuyabilir ve (kargolanmadıysa) iptal edebilirsiniz.",
        },
      ],
    },
    {
      id: "quickstart",
      title: "Hızlı başlangıç",
      blocks: [
        {
          p: "1. Ayarlar → API Anahtarları'ndan bir **test** anahtarı oluşturun. Test anahtarları hiçbir şey üretmez ve para çekmez.",
        },
        { p: "2. Anahtarı kontrol edin:" },
        {
          code: 'curl {{baseUrl}}/me -H "Authorization: Bearer $EASYJET_API_KEY"',
          lang: "bash",
        },
        { p: "3. Bir ürün varyantı ve baskı pozisyonu seçin:" },
        {
          code: 'curl "{{baseUrl}}/products?expand=variants,positions&page_size=5" -H "Authorization: Bearer $EASYJET_API_KEY"',
          lang: "bash",
        },
        { p: "4. Sipariş oluşturun:" },
        {
          code: 'curl -X POST {{baseUrl}}/orders \\\n  -H "Authorization: Bearer $EASYJET_API_KEY" \\\n  -H "Idempotency-Key: $(uuidgen)" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"reference":"ERP-1001","ship_to":{"name":"Jane Doe","street1":"1 Market St","city":"San Francisco","state":"CA","postal_code":"94105","country":"US"},"items":[{"product_id":"…","size_id":"…","color_id":"…","quantity":1}]}\'',
          lang: "bash",
        },
        {
          p: "5. Tasarımı URL ile gönderin, ardından ücret alın, quote ve fulfill yapın. Her adım aşağıdaki rehberlerde ve API referansında anlatılıyor.",
        },
        { p: "Postman koleksiyonu bu akışın tamamını istek istek çalıştırır." },
      ],
    },
    {
      id: "authentication",
      title: "Kimlik doğrulama",
      blocks: [
        {
          p: "API anahtarınızı `Authorization` başlığında gönderin: `Authorization: Bearer ej_test_…`. Anahtar yalnızca oluşturulduğunda gösterilir; EasyJet sadece hash'ini saklar.",
        },
        {
          table: {
            head: ["Anahtar", "Ortam"],
            rows: [
              [
                "`ej_test_…`",
                "Sandbox: aynı kurallar ve yanıtlar; hiçbir şey üretilmez, S3'e kaydedilmez veya tahsil edilmez.",
              ],
              [
                "`ej_live_…`",
                "Canlı: gerçek siparişler, tasarımlar, etiketler ve bakiye tahsilatı. EasyJet canlı erişimi onayladıktan sonra açılır.",
              ],
            ],
          },
        },
        { h: "Yetkiler (scope)" },
        {
          p: "Her anahtarın seçtiğiniz yetkileri vardır. Gerekli yetki yoksa `403 INSUFFICIENT_SCOPE` döner.",
        },
        {
          table: {
            head: ["Yetki", "İzin verir"],
            rows: [
              ["`catalog:read`", "Ürünler, varyantlar, fiyatlar, pozisyonlar"],
              ["`orders:read`", "Siparişler ve tasarım importları"],
              ["`orders:write`", "Sipariş oluşturma, güncelleme ve iptal"],
              ["`designs:write`", "Tasarım ekleme ve silme"],
              ["`shipping:read`", "Etiket ücretleri ve quote"],
              ["`shipping:purchase`", "Fulfill (bakiyeden düşer)"],
              ["`wallet:read`", "Bakiye ve hareketler"],
              ["`webhooks:manage`", "Webhook adresleri"],
            ],
          },
        },
        { h: "Öneriler" },
        {
          list: [
            "Anahtarları yalnızca sunucunuzda tutun; tarayıcıda veya mobil uygulamada asla kullanmayın.",
            "Canlı anahtarları sunucu IP'lerinizle sınırlayın (IP izin listesi) ve her sisteme ayrı anahtar verin.",
            "Anahtarı Ayarlar'dan yenileyin: eski anahtar 24 saat daha çalışır.",
          ],
        },
      ],
    },
    {
      id: "sandbox",
      title: "Sandbox (test anahtarları)",
      blocks: [
        {
          p: "Test anahtarları canlı anahtarlarla aynı endpoint'leri, doğrulamaları, fiyatları ve durumları kullanır; verileri gerçek siparişlerden ayrı tutulur.",
        },
        {
          list: [
            "Sandbox siparişleri son değişiklikten 30 gün sonra silinir; hesap başına en fazla 500. `POST /sandbox/reset` hepsini siler.",
            "Tasarım URL'leri indirilip kontrol edilir ama kopyalanmaz; yüklenen dosyalar kontrol edilip atılır.",
            "Etiket ücretleri paketten hesaplanan test ücretleridir. Teslimat posta kodu `00000` ise ücret dönmez.",
            "Sandbox bakiyesi 1000.00 USD ile başlar; fulfill ve iadeler gerçek bakiye gibi işler.",
            "Sandbox'ta EasyJet üretimi çalışmaz: `POST /sandbox/orders/{id}/advance` siparişi `processing → completed → shipped` olarak ilerletir, böylece sonraki adımları test edebilirsiniz.",
          ],
        },
      ],
    },
    {
      id: "conventions",
      title: "İstekler ve yanıtlar",
      blocks: [
        {
          p: "İstek ve yanıtlar JSON'dur (tasarım ve kendi etiketiniz multipart olabilir). Her yanıt aynı yapıdadır:",
        },
        {
          code: '{\n  "success": true,\n  "data": { … },\n  "pagination": { "page": 1, "page_size": 25, "total": 120, "total_pages": 5 },\n  "meta": { "request_id": "6e3f9a4c-…" }\n}',
          lang: "json",
        },
        {
          list: [
            "Listeler `page` ve `page_size` (en fazla 100) alır.",
            'Tutarlar USD, 4 ondalıklı string: `"12.5000"`.',
            "Tarihler UTC, ISO 8601.",
            "Destek için `meta.request_id` (aynı zamanda `X-Request-Id` başlığı) değerini saklayın.",
          ],
        },
        { h: "Sipariş durumları" },
        {
          table: {
            head: ["Durum", "Anlamı"],
            rows: [
              [
                "`newOrder`",
                "Oluşturuldu; tasarımlar değiştirilebilir; tasarımlar tamamlanınca fulfill edilebilir.",
              ],
              [
                "`waitingForDesign`",
                "Tarafınızdan tasarım bekliyor olarak işaretlendi.",
              ],
              ["`readyForProduction`", "EasyJet üretiminde sırada."],
              ["`processing`", "Etiket alındı; üretimde."],
              ["`pdf`", "Baskı dosyaları hazırlandı; üretimde."],
              ["`designFlaw`", "EasyJet tasarımda sorun buldu."],
              ["`completed`", "Üretildi, kargoya verilmeyi bekliyor."],
              ["`shipped`", "Kargoya verildi."],
              ["`cancel`", "İptal edildi."],
              ["`refund`", "İade edildi."],
              ["`remake`", "Yeniden üretildi."],
            ],
          },
        },
        {
          p: "Sevkiyatlar `preparing`, `processing`, `completed`, `shipped`, `label_required` ve `canceled` durumlarını kullanır.",
        },
      ],
    },
    {
      id: "errors",
      title: "Hatalar",
      blocks: [
        {
          p: "Hatalar `success: false` ile döner: kod tarafında kullanabileceğiniz sabit bir `error.code`, okunabilir bir `message` ve gerektiğinde `details` (ör. geçersiz her alan).",
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
      title: "Rate limit",
      blocks: [
        {
          p: "Limitler API anahtarı ve dakika başınadır; `GET /me` sizinkini gösterir. Yanıtlarda `RateLimit` ve `RateLimit-Policy` başlıkları vardır; `429 RATE_LIMITED` yanıtı `Retry-After` içerir.",
        },
        {
          table: {
            head: ["Sınıf", "Standart", "Yüksek"],
            rows: [
              ["Okuma (GET)", "120", "600"],
              ["Yazma", "30", "120"],
              ["Yükleme ve tasarım importu", "20", "60"],
              ["Fulfill", "10", "40"],
            ],
          },
        },
        {
          p: "Bir IP'den tekrarlanan geçersiz anahtar istekleri 15 dakika engellenir.",
        },
      ],
    },
    {
      id: "idempotency",
      title: "Idempotency",
      blocks: [
        {
          p: "POST isteklerinde bir `Idempotency-Key` başlığı (ör. UUID) gönderin. Ağ hatasında aynı anahtarla tekrar deneyin: ilk yanıt geri döner (`Idempotent-Replayed: true`) ve hiçbir şey iki kez oluşturulmaz veya tahsil edilmez. Anahtarlar API anahtarı başına 24 saat saklanır.",
        },
        {
          list: [
            "`POST /orders/{id}/fulfill` için zorunludur.",
            "Aynı anahtar farklı gövdeyle gelirse `409 IDEMPOTENCY_KEY_REUSED` döner.",
            "İlk istek sürerken yapılan tekrar `409 IDEMPOTENCY_REQUEST_IN_PROGRESS` döner.",
          ],
        },
      ],
    },
    {
      id: "designs",
      title: "Tasarımlar",
      blocks: [
        {
          p: "Fulfill öncesi her satırın en az bir tasarımı olmalıdır. Tasarım ürünün bir baskı pozisyonuna aittir (`front`, `back`, …).",
        },
        { h: "URL ile (önerilen)" },
        {
          p: "Herkese açık https URL'lerini JSON olarak gönderin. EasyJet her dosyayı arka planda indirir, kontrol eder ve kendi kopyasını saklar; URL'inizin yalnızca import tamamlanana kadar çalışması yeterlidir. Yanıt `202` ve bir tasarım importudur; durumunu `GET /design-imports/{id}` veya satırdaki `design_imports` ile izleyin.",
        },
        {
          code: '{\n  "designs": [\n    { "url": "https://cdn.example.com/front.png", "position": "front" },\n    { "url": "https://cdn.example.com/back.png", "position": "back" }\n  ]\n}',
          lang: "json",
        },
        {
          list: [
            "Yalnızca 443 portunda https; özel veya iç ağ adresleri reddedilir.",
            "İstek başına en fazla 20 URL, dosya başına 2 GB. İndirme sorunları tekrar denenir; kalıcı sorunlar (404, yanlış dosya tipi) açık bir hata koduyla başarısız olur.",
            "Kabul edilen tipler: png, jpg, pdf, svg, tiff, webp, gif, bmp, avif, heic, dst.",
          ],
        },
        { h: "Dosya olarak" },
        {
          p: "Ya da dosyaları multipart/form-data ile, pozisyon başına bir alanla yükleyin: `-F front=@front.png`. En fazla 20 dosya, dosya başına 200 MB.",
        },
        { h: "Kurallar" },
        {
          list: [
            "Yeni tasarım, pozisyonundaki tasarımın yerine geçer.",
            "İlk pozisyondan sonraki her pozisyon satıra `additional_position_price × adet` ekler.",
            "`requires_routing_selection: true` olan ürünlerde her satırın ilk tasarımında `routing_sub_category_id` (ürünün `sub_categories` değerlerinden biri) gerekir.",
            "Adedi 1'den fazla olan kişiselleştirilmiş satırlarda her birim grubu için ayrı tasarım seti kullanılabilir: `designs` içinde `group` ve `quantity` gönderin; adetlerin toplamı satır adedine eşit olmalıdır.",
          ],
        },
      ],
    },
    {
      id: "shipping",
      title: "Kargo ve üretim",
      blocks: [
        {
          steps: [
            "`POST /orders/{id}/shipping/rates` paket ağırlığı ve ölçüleriyle EasyJet etiket ücretlerini döner. Her `rate_id` 15 dakika geçerlidir.",
            "`POST /orders/{id}/shipping/quote` sipariş bedelini, kargo ücretini, toplamı ve bakiyenizin yetip yetmediğini gösterir.",
            '`POST /orders/{id}/fulfill` `{ "rate_id" }` ile etiketi satın alır ya da kendi etiketinizi multipart `label_file` olarak gönderirsiniz (kargo ücreti alınmaz). Bakiyeden düşülür ve satırlar `processing` olur.',
          ],
        },
        {
          p: "Yalnızca tasarımları tamamlanmış `newOrder` satırları üretime geçer. Quote bakiyenin yetmediğini söylerse EasyJet panelinden bakiye yükleyin.",
        },
        { h: "İptal" },
        {
          p: "Fulfill öncesi iptal ücretsizdir. Fulfill sonrasında etiket iptal edilir ve kargo ücreti iade edilir, sipariş (üretim) bedeli iade edilmez. Kargolanmış siparişler iptal edilemez.",
        },
      ],
    },
    {
      id: "webhooks",
      title: "Webhook'lar",
      blocks: [
        {
          p: "Sürekli sorgulamak yerine, bir şey olduğunda EasyJet'in sizin https adresinizi çağırmasını sağlayın. Adresleri `POST /webhooks` (yetki `webhooks:manage`) ile veya Ayarlar → API Anahtarları'ndan oluşturun. Adres, onu oluşturan anahtarın ortamına aittir: test anahtarları sandbox olaylarını, canlı anahtarlar canlı olayları alır.",
        },
        {
          table: {
            head: ["Olay", "Ne zaman"],
            rows: [
              [
                "`order.status_changed`",
                "Sipariş durumu değişti (data: `previous_status`, `status`, `order`). `designFlaw`, `completed`, `cancel`… dahil.",
              ],
              [
                "`shipment.label_created`",
                "Fulfill sırasında etiket alındı veya yüklendi (data: `order`, `shipment`).",
              ],
              [
                "`order.shipped`",
                "Sevkiyat takip numarasıyla kargoya verildi (data: `order`, `shipment`).",
              ],
              [
                "`design_import.completed`",
                "URL'lerden tasarımlar kaydedildi (data: `design_import`, `order`).",
              ],
              [
                "`design_import.failed`",
                "Tasarım importu tekrar denemelere rağmen başarısız oldu (data: `error` ile `design_import`).",
              ],
              ["`webhook.test`", "`POST /webhooks/{id}/test` ile gönderilir."],
            ],
          },
        },
        { h: "Gövde" },
        {
          p: "Her olay bir JSON POST'tur. `data.order`, olay gönderildiği andaki siparişi `GET /orders/{id}` ile aynı yapıda içerir. Olayın `id` değeri tekrar denemelerde değişmez: tekrarları ayıklamak için kullanın.",
        },
        {
          code: '{\n  "id": "9b1c…",\n  "type": "order.status_changed",\n  "created_at": "2026-10-19T12:00:00.000Z",\n  "environment": "live",\n  "data": {\n    "previous_status": "processing",\n    "status": "completed",\n    "order": { "id": "…", "order_number": "API-ERP-1001", "status": "completed", "items": [ … ], "shipments": [ … ] }\n  }\n}',
          lang: "json",
        },
        { h: "İmzayı doğrulama" },
        {
          p: "Her istekte `EasyJet-Signature: t=<unix zamanı>,v1=<hex>` başlığı vardır: `<t>.<ham gövde>` değerinin adres gizli anahtarınızla (`whsec_…`, oluşturma veya yenilemede bir kez gösterilir) HMAC-SHA256'sı. İmzası yanlış veya zaman damgası 5 dakikadan eski istekleri reddedin. `EasyJet-Event-Id`, `EasyJet-Event-Type` ve `EasyJet-Delivery-Id` başlıkları da gönderilir.",
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
        { h: "Gönderim" },
        {
          list: [
            "10 saniye içinde herhangi bir 2xx ile yanıt verin; işi sonrasında yapın.",
            'Başarısız gönderimler yaklaşık 2 saat tekrar denenir (30sn, 1dk, 2dk … 64dk). Arka arkaya 20 başarısız gönderimden sonra adres devre dışı kalır; `PATCH /webhooks/{id}` `{"enabled": true}` ile tekrar açın.',
            "Olaylar sırasız veya birden fazla kez gelebilir. `created_at` ve siparişin güncel `status` değerini kullanın.",
            "Her deneme 30 gün boyunca `GET /webhooks/{id}/deliveries` içinde listelenir; `POST …/deliveries/{deliveryId}/retry` ile tekrar gönderebilirsiniz.",
            "Adresler herkese açık https URL'leri olmalıdır (port 443).",
          ],
        },
      ],
    },
    {
      id: "postman",
      title: "Postman",
      blocks: [
        {
          p: "Koleksiyonu indirip Postman'e aktarın, `apiKey` koleksiyon değişkenine bir test anahtarı girin ve klasörleri sırayla çalıştırın. Yanıtlardaki id'ler (ürün, sipariş, satır, ücret…) otomatik kaydedilir ve POST isteklerine `Idempotency-Key` eklenir.",
        },
        { postman: true },
      ],
    },
  ],
  operations: {
    "GET /me": {
      summary: "API anahtarını getir",
      description:
        "Anahtarı, müşteriyi, ortamı, yetkileri ve limitleri döner. Entegrasyonu doğrulamak için kullanın. Yetki gerekmez.",
    },
    "GET /products": {
      summary: "Ürünleri listele",
      description:
        "En az bir beden/renk için aktif fiyatınız olan ürünler. Fiyatlar hesap çarpanınızı içerir. `catalog:read` gerekir.",
    },
    "GET /products/{id}": {
      summary: "Ürünü getir",
      description:
        "Sipariş verilebilir tüm varyantlar, baskı pozisyonları ve fiyatlarla ürün. `catalog:read` gerekir.",
    },
    "GET /products/{id}/positions": {
      summary: "Baskı pozisyonlarını listele",
      description:
        "Tasarım yüklenebilecek pozisyonlar ve baskı alanları. `catalog:read` gerekir.",
    },
    "GET /sizes": {
      summary: "Bedenleri listele",
      description:
        "Sipariş verilebilir bedenler, isteğe bağlı olarak tek ürün için. `catalog:read` gerekir.",
    },
    "GET /colors": {
      summary: "Renkleri listele",
      description:
        "Sipariş verilebilir renkler, isteğe bağlı olarak tek ürün için. `catalog:read` gerekir.",
    },
    "GET /prices": {
      summary: "Varyant fiyatlarını listele",
      description:
        "Ürün/beden/renk başına birim fiyatınız. `catalog:read` gerekir.",
    },
    "GET /additional-prices": {
      summary: "Ek pozisyon fiyatlarını listele",
      description:
        "Ürün başına, ilk pozisyondan sonraki her pozisyon için birim fiyat. `catalog:read` gerekir.",
    },
    "GET /wallet": {
      summary: "Bakiyeyi getir",
      description:
        "Siparişler ve etiketler üretime gönderilirken bu ön ödemeli bakiyeden ödenir. Test anahtarları 1000.00 ile başlayan sandbox bakiyesini görür. `wallet:read` gerekir.",
    },
    "GET /wallet/transactions": {
      summary: "Bakiye hareketlerini listele",
      description: "Yeniden eskiye. `wallet:read` gerekir.",
    },
    "POST /orders": {
      summary: "Sipariş oluştur",
      description:
        "Siparişi satırlarıyla `newOrder` durumunda oluşturur. Fiyatlar katalog fiyatlarınızdan gelir. Ardından tasarımları gönderin ve siparişi üretime gönderin. `orders:write` gerekir.",
    },
    "GET /orders": {
      summary: "Siparişleri listele",
      description: "Yeniden eskiye. `orders:read` gerekir.",
    },
    "GET /orders/{id}": {
      summary: "Siparişi getir",
      description:
        "Satırlar, fiyatlar, tasarımlar, sevkiyatlar ve toplamlarla sipariş. `orders:read` gerekir.",
    },
    "PATCH /orders/{id}": {
      summary: "Teslimat adresini güncelle",
      description:
        "Siparişte `newOrder` veya `waitingForDesign` satırı varken. `orders:write` gerekir.",
    },
    "POST /orders/{id}/cancel": {
      summary: "Siparişi iptal et",
      description:
        "Tüm satırları iptal eder. Kargolandıktan sonra mümkün değildir. Etiket alındıysa iptal edilir ve kargo ücreti iade edilir. `orders:write` gerekir.",
    },
    "POST /orders/{id}/items": {
      summary: "Satır ekle",
      description: "Sipariş üretime geçene kadar. `orders:write` gerekir.",
    },
    "PATCH /orders/{id}/items/{itemId}": {
      summary: "Satır durumunu veya notunu güncelle",
      description:
        "Satır üretime geçmediyse durum `newOrder`, `waitingForDesign` ve `cancel` arasında değişebilir; iptal edilen satır `newOrder` ile geri alınabilir. `orders:write` gerekir.",
    },
    "DELETE /orders/{id}/items/{itemId}": {
      summary: "Satırı sil",
      description:
        "Sipariş üretime geçene kadar; son satır silinemez. `orders:write` gerekir.",
    },
    "POST /orders/{id}/items/{itemId}/designs": {
      summary: "Tasarım ekle (URL veya dosya)",
      description:
        "**Önerilen: herkese açık https URL'lerinizle application/json.** EasyJet dosyaları arka planda indirir, kontrol eder ve kopyalar (202). **Ya da** multipart/form-data ile dosya yükleyin (201). `designs:write` gerekir.",
    },
    "GET /design-imports/{id}": {
      summary: "Tasarım importunu getir",
      description: "URL importunun durumu. `orders:read` gerekir.",
    },
    "DELETE /orders/{id}/items/{itemId}/designs/{designId}": {
      summary: "Tasarımı sil",
      description:
        "Kişiselleştirilmiş satırlarda tasarımın tüm birim grubu silinir. `designs:write` gerekir.",
    },
    "POST /orders/{id}/shipping/rates": {
      summary: "EasyJet etiket ücretlerini al",
      description:
        "Üretime hazır satırlar için paket ağırlığı ve ölçülerinden EasyJet etiket ücretleri. Her `rate_id` 15 dakika geçerlidir. `shipping:read` gerekir.",
    },
    "POST /orders/{id}/shipping/quote": {
      summary: "Üretim öncesi toplamı al",
      description:
        "Bir ücret (veya kendi etiket) için sipariş bedeli + kargo, fulfill'in tahsil edeceği toplam ve bakiyenin yetip yetmediği. `shipping:read` gerekir.",
    },
    "POST /orders/{id}/fulfill": {
      summary: "Etiketi al ve üretime gönder",
      description:
        "JSON `{ rate_id }` EasyJet etiketini satın alır; multipart `label_file` kendi etiketinizi kullanır (kargo ücreti yok). Bakiyeden düşülür ve satırlar `processing` olur. `Idempotency-Key` zorunludur. `shipping:purchase` gerekir.",
    },
    "GET /webhooks": {
      summary: "Webhook adreslerini listele",
      description:
        "`webhooks:manage` gerekir. Adresler anahtarın ortamına (canlı veya test) aittir.",
    },
    "POST /webhooks": {
      summary: "Webhook adresi oluştur",
      description:
        "İmzalı olayları (`EasyJet-Signature` başlığı) alan https adresi. Gizli anahtar yalnızca bir kez döner. Ortam başına en fazla 5 adres. `webhooks:manage` gerekir.",
    },
    "GET /webhooks/{id}": {
      summary: "Webhook adresini getir",
      description: "`webhooks:manage` gerekir.",
    },
    "PATCH /webhooks/{id}": {
      summary: "Webhook adresini güncelle",
      description:
        "URL veya olayları değiştirin ya da açıp kapatın. `webhooks:manage` gerekir.",
    },
    "DELETE /webhooks/{id}": {
      summary: "Webhook adresini sil",
      description: "`webhooks:manage` gerekir.",
    },
    "POST /webhooks/{id}/rotate-secret": {
      summary: "Gizli anahtarı yenile",
      description:
        "Yeni gizli anahtar döner; eskisi hemen geçersiz olur. `webhooks:manage` gerekir.",
    },
    "POST /webhooks/{id}/test": {
      summary: "Test olayı gönder",
      description:
        "Bu adrese bir `webhook.test` olayı sıraya alır. `webhooks:manage` gerekir.",
    },
    "GET /webhooks/{id}/deliveries": {
      summary: "Gönderimleri listele",
      description:
        "Bu adrese yapılan gönderim denemeleri, yeniden eskiye (30 gün saklanır). `webhooks:manage` gerekir.",
    },
    "POST /webhooks/{id}/deliveries/{deliveryId}/retry": {
      summary: "Gönderimi tekrarla",
      description: "Aynı olayı tekrar gönderir. `webhooks:manage` gerekir.",
    },
    "POST /sandbox/reset": {
      summary: "Sandbox verisini sıfırla",
      description:
        "Hesabınızın tüm sandbox siparişlerini siler. Yalnızca test anahtarları.",
    },
    "POST /sandbox/orders/{id}/advance": {
      summary: "Sandbox siparişini ilerlet",
      description:
        "Yalnızca test anahtarları. Canlıda müşterinin yapamadığı, EasyJet'in fulfill sonrası yaptığı adımları taklit eder: `processing → completed → shipped`. `orders:write` gerekir.",
    },
  },
};

export default tr;
