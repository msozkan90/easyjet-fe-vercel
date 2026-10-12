# EASYJET-19 — Rol × kategori × sayfa kaynak matrisi

Kaynak: origin/dev fa2e8847c719a19e7be69f6bad1753d3c61c1790; 12 Ekim 2026. 96 page.js girişi / 75 component-helper dosyası.

## Okuma kuralları

- Bu tablo bir backend yetki matrisi değildir. **Menüde görünmek, UI guard ve backend izinleri ayrı kontrollerdir.**
- D: sayfa dosyasında guard/requireRoles bildirimi; H: içe aktarılan ortak görünümde bildirim. H'deki default, D'deki prop ile daraltılabilir/genişletilebilir. Bütün bildirimi birleştirip kullanıcıya erişim izni verilmez.
- Satır numaraları mevcut snapshot'a aittir. Nested aksiyon guard'ları ve sayfa guard'ı birlikte kayıtlıdır; bunlar aynı erişim seviyesi değildir.
- Literal olmayan ifade, user/tenant/category/subcategory/affiliated durumu ve backend filtreleri için runtime doğrulaması gerekli. Çözümlenmemiş ifade '?' olarak kalır; 'herkese açık' varsayımı yoktur.
- Alias/redirect/wrapper bağımsız ekran değil; route ve props korunur. Yetki/currency/status/hata davranışı bu görevde değiştirilmez.
- Gerçek kullanıcılarla doğrulama yapılmadı; örnek taslak yalnız CompanyAdmin sunumunu temsil eder. Diğer roller için aşağıdaki bekleyen test matrisi kullanılır.

## Roller ve kategori sınırları

| Rol | Mevcut kaynak / deneyim | Tasarım odağı / doğrulama |
|---|---|---|
| SystemAdmin | Entity ve finans admin guard'ları; home registry fallback | Sistem bağlamı ve admin scope; diğer rollere yetki aktarılmaz |
| CompanyAdmin | Standard ve Transfers menüsü user_categories'e bağlı; home normal üretim | Operasyon, katalog, kullanıcı/partner/customer ve bulk scope |
| PartnerAdmin | Standard/Transfers kategori koşulları; affiliated default guard | Bağlı müşteri/sipariş; mevcut erişim sınırları |
| CustomerAdmin | Kategori/subcategory routes; mapper koşulu; refund ve finance | Tasarım yükleme, takip, ödeme, doğru sonraki adım |
| CompanyCompletedWorker | Print/Apparel/Engraving veya Transfers registry varyantları | Scanner focus, design/PDF/production; iki kategori karışımında iki bölüm |
| CompanyShipmentWorker | Kategoriye göre registry; shipped printer/search | Kargo/etiket/print scope; mevcut status koşulları |
| CompanyWorker | RoleEnum'da mevcut; özel dashboard registry eşleşmesi görünmüyor | Menü/guard/gerçek çalışan görevleri kullanıcıdan doğrulanmalı; yeni yetki icat edilmez |
| CustomerWorker | RoleEnum; transfer shipped/refund list/detail props'unda mevcut | CustomerAdmin'e eşitlenmez; mevcut dar scope runtime testle doğrulanmalı |

## 96 route için bildirim kanıtı

| Route | Tür | Sayfa bildirimi (D) | Delegated görünüm kanıtı (H) / kategori |
|---|---|---|---|
| `/auth/login` | Özel/redirect; auth ve backend scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | — |
| `/auth/verify-failed` | Özel/redirect; auth ve backend scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | — |
| `/auth/verify-success` | Özel/redirect; auth ve backend scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | — |
| `/dashboard/company/admins` | Sayfa + olası nested guards | anyOfRoles=["systemadmin"] (L256); anyOfRoles=["systemadmin"] (L274) | — |
| `/dashboard/company` | Sayfa + olası nested guards | anyOfRoles=["systemadmin"] (L256); anyOfRoles=["systemadmin"] (L270) | — |
| `/dashboard/company/permissions` | Özel/redirect; auth ve backend scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | — |
| `/dashboard/company/user-metrics` | Sayfa + olası nested guards | anyOfRoles=["companyadmin"] (L535) | — |
| `/dashboard/company/users` | Sayfa + olası nested guards | anyOfRoles=["companyadmin"] (L260); anyOfRoles=["companyadmin"] (L276) | — |
| `/dashboard/customer/admins` | Sayfa + olası nested guards | anyOfRoles=["companyAdmin", "partnerAdmin"] (L257); anyOfRoles=["companyAdmin", "partnerAdmin"] (L275) | — |
| `/dashboard/customer` | Sayfa + olası nested guards | anyOfRoles=["companyAdmin", "partnerAdmin"] (L298); anyOfRoles=["companyAdmin", "partnerAdmin"] (L312) | — |
| `/dashboard/customer/permissions` | Özel/redirect; auth ve backend scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | — |
| `/dashboard/financial/admin/funding-accounts` | Sayfa + olası nested guards | anyOfRoles=["systemadmin"] (L231) | — |
| `/dashboard/financial/admin/topups/[id]` | Sayfa + olası nested guards | anyOfRoles=["systemadmin"] (L145) | —; kategori/parametre/veri koşulu ayrıca doğrulanır |
| `/dashboard/financial/admin/topups` | Sayfa + olası nested guards | anyOfRoles=["systemadmin"] (L260) | — |
| `/dashboard/financial/topups/[id]` | Sayfa + olası nested guards | anyOfRoles=["companyAdmin", "partnerAdmin", "customerAdmin"] (L111) | —; kategori/parametre/veri koşulu ayrıca doğrulanır |
| `/dashboard/financial/topups` | Sayfa + olası nested guards | anyOfRoles=["companyAdmin", "partnerAdmin", "customerAdmin"] (L263) | — |
| `/dashboard/order-report` | Sayfa + olası nested guards | anyOfRoles=["companyAdmin", "customerAdmin"] (L724) | —; kategori/parametre/veri koşulu ayrıca doğrulanır |
| `/dashboard/order/detail/[orderNumber]` | Sayfa + olası nested guards | anyOfRoles=[ "systemAdmin", "companyAdmin", "customerAdmin", "companyCompletedWorker", "companyShipmentWorker", "partnerAdmin", ] (L1719) | —; kategori/parametre/veri koşulu ayrıca doğrulanır |
| `/dashboard/orders/[categoryId]/[subCategoryId]/design-flaw-records` | Özel/redirect; auth ve backend scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | —; kategori/parametre/veri koşulu ayrıca doğrulanır |
| `/dashboard/orders/[categoryId]/[subCategoryId]/design-flaws` | Özel/redirect; auth ve backend scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | —; kategori/parametre/veri koşulu ayrıca doğrulanır |
| `/dashboard/orders/[categoryId]/[subCategoryId]/pdfs` | Özel/redirect; auth ve backend scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | —; kategori/parametre/veri koşulu ayrıca doğrulanır |
| `/dashboard/orders/[categoryId]/[subCategoryId]/printer` | Özel/redirect; auth ve backend scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | —; kategori/parametre/veri koşulu ayrıca doğrulanır |
| `/dashboard/orders/[categoryId]/[subCategoryId]/report-scrape` | Özel/redirect; auth ve backend scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | —; kategori/parametre/veri koşulu ayrıca doğrulanır |
| `/dashboard/orders/[categoryId]/[subCategoryId]/view-order` | Özel/redirect; auth ve backend scope doğrulanacak | requireRoles=["companyCompletedWorker"] (L131) | src/app/(dashboard)/dashboard/orders/OrdersStatusListPage.jsx: requireRoles=["companyAdmin", "customerAdmin"] (L71); anyOfRoles=requireRoles (L766); kategori/parametre/veri koşulu ayrıca doğrulanır |
| `/dashboard/orders/[categoryId]/design-flaw-records` | Özel/redirect; auth ve backend scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | — |
| `/dashboard/orders/[categoryId]/design-flaws` | Özel/redirect; auth ve backend scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | — |
| `/dashboard/orders/[categoryId]/pdfs` | Özel/redirect; auth ve backend scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | — |
| `/dashboard/orders/[categoryId]/printer` | Özel/redirect; auth ve backend scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | — |
| `/dashboard/orders/[categoryId]/report-scrape` | Özel/redirect; auth ve backend scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | — |
| `/dashboard/orders/[categoryId]/view-order` | Özel/redirect; auth ve backend scope doğrulanacak | requireRoles=["companyCompletedWorker"] (L120) | src/app/(dashboard)/dashboard/orders/OrdersStatusListPage.jsx: requireRoles=["companyAdmin", "customerAdmin"] (L71); anyOfRoles=requireRoles (L766); kategori/parametre/veri koşulu ayrıca doğrulanır |
| `/dashboard/orders/affiliated/completed` | Wrapper/paylaşılan görünüm; runtime scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | src/app/(dashboard)/dashboard/orders/AffiliatedOrdersStatusListPage.jsx: requireRoles=["companyAdmin", "partnerAdmin"] (L15); requireRoles=requireRoles (L102)<br>src/app/(dashboard)/dashboard/orders/OrdersStatusListPage.jsx: requireRoles=["companyAdmin", "customerAdmin"] (L71); anyOfRoles=requireRoles (L766) |
| `/dashboard/orders/affiliated/production` | Wrapper/paylaşılan görünüm; runtime scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | src/app/(dashboard)/dashboard/orders/AffiliatedOrdersStatusListPage.jsx: requireRoles=["companyAdmin", "partnerAdmin"] (L15); requireRoles=requireRoles (L102)<br>src/app/(dashboard)/dashboard/orders/OrdersStatusListPage.jsx: requireRoles=["companyAdmin", "customerAdmin"] (L71); anyOfRoles=requireRoles (L766) |
| `/dashboard/orders/affiliated/refund-remake/[id]` | Özel/redirect; auth ve backend scope doğrulanacak | requireRoles=["companyAdmin"] (L8) | — |
| `/dashboard/orders/affiliated/refund-remake` | Özel/redirect; auth ve backend scope doğrulanacak | requireRoles=["companyAdmin"] (L8) | — |
| `/dashboard/orders/affiliated/shipped` | Wrapper/paylaşılan görünüm; runtime scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | src/app/(dashboard)/dashboard/orders/AffiliatedOrdersStatusListPage.jsx: requireRoles=["companyAdmin", "partnerAdmin"] (L15); requireRoles=requireRoles (L102)<br>src/app/(dashboard)/dashboard/orders/OrdersStatusListPage.jsx: requireRoles=["companyAdmin", "customerAdmin"] (L71); anyOfRoles=requireRoles (L766) |
| `/dashboard/orders/cancel` | Sayfa + olası nested guards | anyOfRoles=["companyAdmin", "customerAdmin"] (L601) | — |
| `/dashboard/orders/completed` | Wrapper/paylaşılan görünüm; runtime scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | src/app/(dashboard)/dashboard/orders/OrdersStatusListPage.jsx: requireRoles=["companyAdmin", "customerAdmin"] (L71); anyOfRoles=requireRoles (L766) |
| `/dashboard/orders/in-production` | Wrapper/paylaşılan görünüm; runtime scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | src/app/(dashboard)/dashboard/orders/OrdersStatusListPage.jsx: requireRoles=["companyAdmin", "customerAdmin"] (L71); anyOfRoles=requireRoles (L766) |
| `/dashboard/orders/pending` | Wrapper/paylaşılan görünüm; runtime scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | src/app/(dashboard)/dashboard/orders/OrdersStatusListPage.jsx: requireRoles=["companyAdmin", "customerAdmin"] (L71); anyOfRoles=requireRoles (L766) |
| `/dashboard/orders/printer` | Özel/redirect; auth ve backend scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | — |
| `/dashboard/orders/refund-remake/[id]` | Özel/redirect; auth ve backend scope doğrulanacak | requireRoles=["customerAdmin"] (L8) | — |
| `/dashboard/orders/refund-remake` | Özel/redirect; auth ve backend scope doğrulanacak | requireRoles=["customerAdmin"] (L8) | — |
| `/dashboard/orders/shipped` | Wrapper/paylaşılan görünüm; runtime scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | src/app/(dashboard)/dashboard/orders/OrdersStatusListPage.jsx: requireRoles=["companyAdmin", "customerAdmin"] (L71); anyOfRoles=requireRoles (L766) |
| `/dashboard/orders/view-order` | Özel/redirect; auth ve backend scope doğrulanacak | requireRoles=["companyShipmentWorker"] (L18) | src/app/(dashboard)/dashboard/orders/OrdersStatusListPage.jsx: requireRoles=["companyAdmin", "customerAdmin"] (L71); anyOfRoles=requireRoles (L766) |
| `/dashboard` | Özel/redirect; auth ve backend scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | — |
| `/dashboard/partner/admins` | Sayfa + olası nested guards | anyOfRoles=["companyAdmin"] (L256); anyOfRoles=["companyAdmin"] (L274) | — |
| `/dashboard/partner` | Sayfa + olası nested guards | anyOfRoles=["companyAdmin"] (L255); anyOfRoles=["companyAdmin"] (L269) | — |
| `/dashboard/partner/permissions` | Özel/redirect; auth ve backend scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | — |
| `/dashboard/payment-management/completed` | Sayfa + olası nested guards | anyOfRoles=["companyAdmin", "partnerAdmin"] (L274) | — |
| `/dashboard/payment-management` | Sayfa + olası nested guards | anyOfRoles=["companyAdmin"] (L325) | — |
| `/dashboard/payment-management/processing` | Sayfa + olası nested guards | anyOfRoles=["companyAdmin", "partnerAdmin"] (L335) | — |
| `/dashboard/pre-orders/cancelled` | Wrapper/paylaşılan görünüm; runtime scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | src/app/(dashboard)/dashboard/pre-orders/page.js: anyOfRoles=["companyAdmin", "customerAdmin"] (L1207) |
| `/dashboard/pre-orders` | Sayfa + olası nested guards | anyOfRoles=["companyAdmin", "customerAdmin"] (L1207) | — |
| `/dashboard/product-mapper/colors` | Sayfa + olası nested guards | anyOfRoles=["customerAdmin"] (L358) | — |
| `/dashboard/product-mapper/customizations` | Sayfa + olası nested guards | anyOfRoles=["customerAdmin"] (L114) | — |
| `/dashboard/product-mapper` | Özel/redirect; auth ve backend scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | — |
| `/dashboard/product-mapper/products` | Sayfa + olası nested guards | anyOfRoles=["customerAdmin"] (L335) | — |
| `/dashboard/product-mapper/sizes` | Sayfa + olası nested guards | anyOfRoles=["customerAdmin"] (L358) | — |
| `/dashboard/product-variation/additional-prices` | Sayfa + olası nested guards | anyOfRoles=["companyAdmin"] (L374) | — |
| `/dashboard/product-variation/colors` | Sayfa + olası nested guards | anyOfRoles=["companyAdmin"] (L378) | — |
| `/dashboard/product-variation` | Özel/redirect; auth ve backend scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | — |
| `/dashboard/product-variation/partner-prices` | Sayfa + olası nested guards | anyOfRoles=["partnerAdmin"] (L260) | — |
| `/dashboard/product-variation/partner-to-customer-prices` | Sayfa + olası nested guards | anyOfRoles=["partnerAdmin"] (L359) | — |
| `/dashboard/product-variation/positions` | Sayfa + olası nested guards | anyOfRoles=["companyAdmin"] (L232) | — |
| `/dashboard/product-variation/prices` | Sayfa + olası nested guards | anyOfRoles=["companyAdmin"] (L438) | — |
| `/dashboard/product-variation/products` | Sayfa + olası nested guards | anyOfRoles=["companyAdmin"] (L306) | —; kategori/parametre/veri koşulu ayrıca doğrulanır |
| `/dashboard/product-variation/sizes` | Sayfa + olası nested guards | anyOfRoles=["companyAdmin"] (L314) | — |
| `/dashboard/product-variation/stock` | Sayfa + olası nested guards | anyOfRoles=["companyAdmin"] (L476) | — |
| `/dashboard/profile` | Özel/redirect; auth ve backend scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | — |
| `/dashboard/settings` | Sayfa + olası nested guards | anyOfRoles=["companyAdmin", "partnerAdmin", "customerAdmin"] (L743); anyOfRoles=["companyAdmin", "partnerAdmin", "customerAdmin"] (L782) | — |
| `/dashboard/shipment-report` | Sayfa + olası nested guards | anyOfRoles=["systemAdmin", "companyAdmin", "customerAdmin"] (L229) | — |
| `/dashboard/transfer-order-report` | Sayfa + olası nested guards | anyOfRoles=["companyAdmin", "customerAdmin"] (L630) | —; kategori/parametre/veri koşulu ayrıca doğrulanır |
| `/dashboard/transfer-orders/[categoryId]/[subCategoryId]/printer` | Wrapper/paylaşılan görünüm; runtime scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | src/app/(dashboard)/dashboard/transfer-orders/orders/TransferPrinterOrderSearchPage.jsx: anyOfRoles=["companyAdmin", "companyCompletedWorker"] (L230); kategori/parametre/veri koşulu ayrıca doğrulanır |
| `/dashboard/transfer-orders/[categoryId]/[subCategoryId]/view-order` | Özel/redirect; auth ve backend scope doğrulanacak | requireRoles=["companyAdmin", "companyCompletedWorker"] (L126) | src/app/(dashboard)/dashboard/transfer-orders/orders/TransferOrdersStatusListPage.jsx: requireRoles=["companyAdmin", "partnerAdmin", "customerAdmin"] (L276); anyOfRoles=requireRoles (L1029); kategori/parametre/veri koşulu ayrıca doğrulanır |
| `/dashboard/transfer-orders/affiliated/production` | Özel/redirect; auth ve backend scope doğrulanacak | requireRoles=["companyAdmin", "companyShipmentWorker", "partnerAdmin"] (L12) | src/app/(dashboard)/dashboard/transfer-orders/orders/TransferOrdersStatusListPage.jsx: requireRoles=["companyAdmin", "partnerAdmin", "customerAdmin"] (L276); anyOfRoles=requireRoles (L1029) |
| `/dashboard/transfer-orders/affiliated/refund-remake/[id]` | Özel/redirect; auth ve backend scope doğrulanacak | requireRoles=["companyAdmin"] (L9) | — |
| `/dashboard/transfer-orders/affiliated/refund-remake` | Özel/redirect; auth ve backend scope doğrulanacak | requireRoles=["companyAdmin"] (L9) | — |
| `/dashboard/transfer-orders/orders/[orderNumber]` | Sayfa + olası nested guards | anyOfRoles=[ "companyAdmin", "companyCompletedWorker", "companyShipmentWorker", "partnerAdmin", "customerAdmin", ] (L899); anyOfCategories=["Transfers"] (L906) | —; kategori/parametre/veri koşulu ayrıca doğrulanır |
| `/dashboard/transfer-orders/orders/cancel` | Wrapper/paylaşılan görünüm; runtime scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | src/app/(dashboard)/dashboard/transfer-orders/orders/TransferOrdersStatusListPage.jsx: requireRoles=["companyAdmin", "partnerAdmin", "customerAdmin"] (L276); anyOfRoles=requireRoles (L1029) |
| `/dashboard/transfer-orders/orders/in-production` | Wrapper/paylaşılan görünüm; runtime scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | src/app/(dashboard)/dashboard/transfer-orders/orders/TransferOrdersStatusListPage.jsx: requireRoles=["companyAdmin", "partnerAdmin", "customerAdmin"] (L276); anyOfRoles=requireRoles (L1029) |
| `/dashboard/transfer-orders/orders` | Wrapper/paylaşılan görünüm; runtime scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | src/app/(dashboard)/dashboard/transfer-orders/orders/TransferOrdersStatusListPage.jsx: requireRoles=["companyAdmin", "partnerAdmin", "customerAdmin"] (L276); anyOfRoles=requireRoles (L1029); kategori/parametre/veri koşulu ayrıca doğrulanır |
| `/dashboard/transfer-orders/orders/printed` | Özel/redirect; auth ve backend scope doğrulanacak | requireRoles=["companyAdmin", "customerAdmin"] (L13) | src/app/(dashboard)/dashboard/transfer-orders/orders/TransferOrdersStatusListPage.jsx: requireRoles=["companyAdmin", "partnerAdmin", "customerAdmin"] (L276); anyOfRoles=requireRoles (L1029) |
| `/dashboard/transfer-orders/orders/refund-remake/[id]` | Özel/redirect; auth ve backend scope doğrulanacak | requireRoles=["customerAdmin", "customerWorker"] (L9) | — |
| `/dashboard/transfer-orders/orders/refund-remake` | Özel/redirect; auth ve backend scope doğrulanacak | requireRoles=["customerAdmin", "customerWorker"] (L9) | — |
| `/dashboard/transfer-orders/orders/shipped` | Özel/redirect; auth ve backend scope doğrulanacak | requireRoles=["companyAdmin", "customerAdmin", "customerWorker"] (L149) | src/app/(dashboard)/dashboard/transfer-orders/orders/TransferOrdersStatusListPage.jsx: requireRoles=["companyAdmin", "partnerAdmin", "customerAdmin"] (L276); anyOfRoles=requireRoles (L1029) |
| `/dashboard/transfer-orders` | Özel/redirect; auth ve backend scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | — |
| `/dashboard/transfer-orders/pool/cancelled` | Özel/redirect; auth ve backend scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | — |
| `/dashboard/transfer-orders/printer` | Wrapper/paylaşılan görünüm; runtime scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | src/app/(dashboard)/dashboard/transfer-orders/orders/TransferShippedPrinterSearchPage.jsx: anyOfRoles=["companyShipmentWorker"] (L549) |
| `/dashboard/transfer-orders/view-order` | Özel/redirect; auth ve backend scope doğrulanacak | requireRoles=["companyShipmentWorker"] (L11) | src/app/(dashboard)/dashboard/transfer-orders/orders/TransferOrdersStatusListPage.jsx: requireRoles=["companyAdmin", "partnerAdmin", "customerAdmin"] (L276); anyOfRoles=requireRoles (L1029) |
| `/dashboard/transfer-payments/completed` | Wrapper/paylaşılan görünüm; runtime scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | src/app/(dashboard)/dashboard/transfer-payments/pending/page.js: anyOfRoles=["customerAdmin"] (L318) |
| `/dashboard/transfer-payments/pending` | Sayfa + olası nested guards | anyOfRoles=["customerAdmin"] (L318) | — |
| `/dashboard/transfer-payments/processing` | Wrapper/paylaşılan görünüm; runtime scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | src/app/(dashboard)/dashboard/transfer-payments/pending/page.js: anyOfRoles=["customerAdmin"] (L318) |
| `/dashboard/transfer-product-variation/prices` | Sayfa + olası nested guards | anyOfRoles=["companyAdmin"] (L343); anyOfCategories=["Transfers"] (L343) | —; kategori/parametre/veri koşulu ayrıca doğrulanır |
| `/dashboard/transfer-product-variation/products` | Sayfa + olası nested guards | anyOfRoles=["companyAdmin"] (L229); anyOfCategories=["Transfers"] (L230) | —; kategori/parametre/veri koşulu ayrıca doğrulanır |
| `/dashboard/wallet-transactions` | Sayfa + olası nested guards | anyOfRoles=["companyAdmin", "partnerAdmin", "customerAdmin", "systemAdmin"] (L170) | — |
| `/` | Özel/redirect; auth ve backend scope doğrulanacak | Açık literal guard bulunmadı — izin verildiği anlamına gelmez | — |

## 75 component/helper bildirimi

| Dosya | UI guard / requireRoles / kategori bildirimleri |
|---|---|
| `src/components/audit/EntityAuditTimeline.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/common/Access/RequireRole.jsx` | anyOfRoles=[] (L10); anyOfPerms=[] (L11); anyOfCategories=[] (L12) |
| `src/components/common/LanguageSwitcher.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/common/Modal/ImportResultModal.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/common/actions/SelectionFloatActions.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/common/forms/CompanyAdminForm.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/common/forms/CompanyForm.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/common/forms/CompanyUserForm.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/common/forms/CustomerAdminForm.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/common/forms/CustomerForm.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/common/forms/DesignAreaSelector.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/common/forms/GooglePlacesAutocomplete.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/common/forms/PartnerAdminForm.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/common/forms/PartnerForm.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/common/forms/PartnerProductPriceForm.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/common/forms/ProductAdditionalPriceForm.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/common/forms/ProductColorForm.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/common/forms/ProductColorMapperForm.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/common/forms/ProductForm.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/common/forms/ProductMapperForm.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/common/forms/ProductPositionForm.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/common/forms/ProductPriceForm.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/common/forms/ProductSizeForm.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/common/forms/ProductSizeMapperForm.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/common/forms/ProductStockForm.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/common/forms/TransferProductPriceForm.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/common/media/DesignThumbnailImage.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/common/media/ImagePreviewGate.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/common/permissions/EntityPermissionsPage.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/common/shipstation/ShipStationStoreStatusCard.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/common/table/CrudTable.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/dashboard/CompanyCompletedWorkerOperationsDashboard.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/dashboard/CompanyShipmentWorkerOperationsDashboard.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/dashboard/DashboardDateFilter.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/dashboard/DashboardSubCategoryFilter.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/dashboard/DashboardSummaryCard.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/dashboard/NormalProductionUrgencyDashboard.jsx` | requireRoles=["companyAdmin", "companyCompletedWorker", "companyShipmentWorker"] (L245) |
| `src/components/dashboard/dashboardRegistry.js` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/dashboard/worker/CompanyCompletedWorkerTransferDashboard.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/dashboard/worker/CompanyShipmentWorkerTransferDashboard.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/downloads/DownloadQueueProvider.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/layout/HeaderBar.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/layout/PageContainer.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/layout/ScrollToTopButton.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/layout/Sidebar.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/modals/AddressEditorModal.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/modals/ManualOrderModal.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/modals/OrderDesignModal.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/modals/OrderItemRematchModal.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/modals/RemakeShippingRatesModal.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/modals/ShippingRatesModal.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/modals/TransferProductionModal.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/modals/TransferShippingRatesModal.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/orders-pdf/OrdersPdfDesignUploadQueueProvider.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/orders-pdf/OrdersPdfPage.jsx` | anyOfRoles=["companyAdmin", "companyCompletedWorker"] (L432) |
| `src/components/orders/OrderDesignUploadQueueProvider.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/orders/OrderItemDesignPreview.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/orders/PrinterOrderSearchPage.jsx` | anyOfRoles=["companyCompletedWorker", "companyadmin"] (L806) |
| `src/components/orders/ShippedOrderPrinterSearchPage.jsx` | anyOfRoles=["companyShipmentWorker", "companyadmin"] (L377) |
| `src/components/orders/design-flaws/DesignFlawItemsPage.jsx` | requireRoles=["companyCompletedWorker", "companyAdmin"] (L101) |
| `src/components/orders/design-flaws/DesignFlawModal.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/orders/design-flaws/DesignFlawRecordsPage.jsx` | anyOfRoles=["companyAdmin", "companyCompletedWorker"] (L358) |
| `src/components/orders/refund-remake/RefundRemakeCreateModal.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/orders/refund-remake/RefundRemakeRequestDetailPage.jsx` | requireRoles=["customerAdmin"] (L44); anyOfRoles=requireRoles (L268) |
| `src/components/orders/refund-remake/RefundRemakeRequestsListPage.jsx` | requireRoles=["customerAdmin"] (L40); anyOfRoles=requireRoles (L232) |
| `src/components/reports/ReportExportButton.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/settings/IntegrationsPlaceholder.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/settings/NotificationSettingsTable.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/settings/SettingsHero.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/settings/SettingsSideMenu.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/settings/ShipStationCard.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/settings/settings.constants.js` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/settings/settings.helpers.js` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/transfer-orders/TransferDesignUploadQueueProvider.jsx` | Açık literal guard bulunmadı — izin verildiği anlamına gelmez |
| `src/components/transfer-orders/TransferOrderPoolListPage.jsx` | anyOfRoles=["companyAdmin", "partnerAdmin", "customerAdmin"] (L847); anyOfCategories=["Transfers"] (L848) |

## Runtime doğrulama matrisi — henüz yapılmadı

Her rol için mevcut fixture hesabıyla: direkt URL + menü + back/refresh + kategori Print/Apparel/Engraving/Transfers + subcategory + affiliated + tenant scope. Çalışan roller için scanner enter/focus, CustomerWorker için shipped/refund örnekleri ayrıca. Beklenen backend 403/404 sonucu değiştirilmeyecek. Yetkisiz hesap farklı entity'nin siparişini görmemeli. Bunlar test planıdır; başarılı sonuç olarak işaretlenmemiştir.

| Senaryo | Beklenen korunacak davranış | Bu tur durum |
|---|---|---|
| Auth bootstrap → protected deep link | Gerçek auth çözülmeden yanlış izin/hata gösterilmez | Statik risk; runtime bekliyor |
| CompanyAdmin standard + Transfers | Mevcut category menüleri, role ve item scopes korunur | Kaynak bildirimi kaydedildi; runtime bekliyor |
| CompanyCompleted/ShipmentWorker tek/iki kategori | Mevcut dashboard registry ve printer role ayrımı korunur | Kaynak doğrulandı; canlı test yok |
| Partner/Customer/System home | Mevcut fallback'ın yerine sadece mevcut izinli rota yönlendirmesi önerisi | Tasarım önerisi; uygulama yok |
| CustomerWorker transfer shipped/refund | Mevcut özel requireRoles props uygulanır | Kaynak kaydedildi; fixture/live doğrulaması bekliyor |
| CompanyWorker | Yeni özel ekran/permission otomatik eklenmez | Rol sahibiyle görev/erişim doğrulaması gerekli |
| Yetki yönetimi sayfaları | Kaynakta literal page guard yoksa backend izinleri yine otoritedir | UI audit bulgusu; izin genişletme/refactor yok |
