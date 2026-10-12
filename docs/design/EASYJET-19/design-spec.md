# EASYJET-19 — EasyJet Connect tasarım önerisi v0.1

Durum: **v0.1 görsel yönü kullanıcı tarafından reddedildi; görsel uygulama referansı değildir**. Uygulama kodu/API/veritabanı değişmedi. Yeni tek ekran önerisi [visual-direction-v2.md](visual-direction-v2.md) içinde; renk/token kararı onaydan sonra yeniden tamamlanacak. Aşağıdaki business-contract ve kaynak matrisi bilgileri korunur, görsel kararlar onaylanmış sayılmaz.
Epic: [EASYJET-18](https://easyjetconnect.atlassian.net/browse/EASYJET-18).
Görev: [EASYJET-19](https://easyjetconnect.atlassian.net/browse/EASYJET-19).
Kaynak snapshot: origin/dev fa2e8847c719a19e7be69f6bad1753d3c61c1790.

## 1. Tasarım kararı

“Sakin operasyon merkezi”: kullanıcı siparişin durumunu ve güvenli sonraki adımı kolayca görür. Mevcut EasyJet Connect logosu ve Roboto Flex korunur. Nötr light yüzeyler, koyu teal birincil işlem, turuncu yalnız marka vurgusu; dekoratif gradient/glass/3D yok. Bu renk yönü henüz marka onayı değildir.

Ant Design 5/Icons, Next/Redux/API transport korunur. Ayrı UI framework, mikrofrontend, yeni KPI endpoint'i veya tasarım sistemi yayın altyapısı yok. Prototype AntD'nin uygulanmış bir kopyası değil, bileşen niyetini gösteren bağımsız fixture'dır. Sistem fontuna düşebilir; Roboto Flex'in production davranışı sonraki DS görevinde doğrulanır.

## 2. Token standardı — öneri, production'a uygulanmadı

| Alan | Karar | Kullanım |
|---|---|---|
| Primary | #0F766E; onPrimary #FFFFFF | Tek baskın ana işlem, aktif link/focus |
| Canvas/surface | #F4F7FA / #FFFFFF | İç içe kart değil, tek liste/form yüzeyi |
| Text/secondary | #0F172A / #475569 | Ana metin / yardımcı bilgi |
| Control border | #7C8DA3 | Gerekli input/button sınırı; gerçek state çiftleri ölçülecek |
| Decorative divider | #E2E8F0 | Semantik kontrol sınırı olarak kullanılmaz |
| Success | #15803D / #EAF6EC | Metin + durum adı; sadece renk değil |
| Warning | #92400E / #FFF4DF | Ön koşul eksik; danger ile karıştırılmaz |
| Error | #B42318 / #FEF0ED | Kalıcı hata ve gerçek yıkıcı işlem |
| Info | #1D4ED8 / #E8F0FE | Devam eden işlem, tarafsız açıklama |
| Brand | Mevcut logo; #FF7A1A yalnız vurgu | Turuncu zeminde beyaz küçük metin kullanılmaz |
| Type | Roboto Flex/system; body14/22, mobile fields16 | Page24/32, section18/26, yardımcı12/18 |
| Weight | 400 / 500; tablo sayıları tabular | Kalınlık yerine yerleşim ve kontrast |
| Space | 4/8/12/16/24/32/48 | Desktop page24, mobile16, field16, group24 |
| Radius | Control8, Surface12 | Pill sadece küçük status/avatar |
| Density | Comfortable40; compact32 kontrollü tablo | Mobile kritik touch hedef44 |
| Icons | Mevcut Ant Design Icons; icon-only accessible name | Aynı eyleme aynı ikon, tooltip tek açıklama değil |
| Overlay | Sheet/dialog üstünde task paneli yok | Gerçek z-index/modal focus ilişkisi EASYJET-22/25'te testli |

WCAG 2.2 AA hedefi: normal text >=4.5:1; büyük text ve anlamlı kontrol görselleri >=3:1. 44px öneridir, WCAG minimum24px/spacing istisnalarının yerine geçen yanlış bir zorunluluk değildir. Prototype kontrast ve overflow kontrolleri tam WCAG sertifikası değildir.
Kaynak: [W3C](https://www.w3.org/TR/WCAG22/), [AntD v5 tema](https://5x.ant.design/docs/react/customize-theme/).

## 3. Bilgi mimarisi

Mevcut URL ve role/category guards değiştirilmez. Menüyü tüm rollere aynı gösterme yerine role-aware mevcut rotalar:

- Operasyon: mevcut sipariş/havuz/tarama/üretim/gönderi/PDF/hata kayıtları.
- Katalog: mevcut ürün/varyasyon/stok/fiyat/mapping bölümleri, yalnız izinli roller.
- Finans: mevcut wallet/topup/payment/funding-account; owner/admin review ayrımı.
- Yönetim: mevcut company/partner/customer/users/permissions.
- Çalışma alanı: mevcut integrations/notifications/profile.
- İşlem merkezi: mevcut upload/download state motorları için tek presentation yüzeyi; bu taslak yeni production route ekleme onayı değildir.

Genel arama yalnız mevcut OrderSearchAPI.resolve akışını kullanacak. Mobile nav drawer; desktop aktif URL + parent açık durum + breadcrumb. Gerçek kategori/subcategory isimleri mevcut taxonomy'den; transfer ve standard sipariş aynı domain'e dönüştürülmez.

Rol/kategori/sayfa kanıtı: [role-route-matrix.md](role-route-matrix.md). 8 rol; 96 route ve 75 component/helper kaydı. Matris UI bildirim auditidir, backend yetki garantisi değildir.

## 4. Bileşen ve durum standardı

| Bileşen | Sunum kararı | Değişmeyecek sözleşme |
|---|---|---|
| PageHeader/Surface | Başlık, breadcrumb, entity scope, bir primary | Route ve veri sahibi |
| Button/RowActions | Primary/secondary/tertiary/danger; text veya accessible label | Handler, disabled/loading ön koşulu |
| Table/FilterBar | Durum/kimlik önceliği, yerel x-scroll, görünür uygulanmış filtre | Server page/filter/sort, rowKey ve selection politikası |
| FormSection/FieldHelp | Kalıcı label, birim/required/help/error; ilk hataya focus | Form names/rules/domain validation ve payload |
| Modal/Drawer | Uzun görevde viewport-safe sheet; focus trap/restore | Unsaved-close ve side-effect confirmation |
| Badge/Metric | Metin + ikon/renk; unknown/zero/failed ayrı | Domain status/KPI tanımı |
| Preview | Thumbnail → preview → original download | Boyut/format/validation ve mevcut fallback |
| Activity view | Tek panel/sheet; type/status/progress/cancel/retry | Provider, session/idempotency/concurrency ve beforeunload |

Loading: skeleton veya açıklamalı spinner. Empty: gerçek boş vs filtre sonucu ayrı. Error: kalıcı yerel açıklama + güvenli retry, hata “0 sipariş” değil. Refresh: eski veriyi gösteriyorsa stale bilgi açık. Ödeme/label/production gibi side-effect otomatik retry olmaz.

Domain mapping: standard newOrder/waitingForDesign/processing/pdf/designFlaw/completed/shipped/cancel; transfer ek olarak readyForProduction/downloaded/printed/refund/remake. Yeni business status eklenmez. Customer-facing metin çeviri sözlüğünden, domain key aynen kalır.

## 5. Beş ana wireframe

[Görseller ve ekran davranışları](wireframes.md). Her ekran için 375/768/1440px örneği. Veriler DEMO fixture; KPI sayıları gerçek prod ölçümü değil.

1. Sipariş listesi — önce kimlik/durum/sonraki eylem; detay sütunları mobile'da gizlenirse detaydan erişilir. Search/status/reset ve loading/empty/error örnekleri.
2. Sipariş detayı — durum + sonraki adım; ürün/tasarım, teslimat, geçmiş. Uzun tasarım/kargo akışı ayrı görünür sheet, her durumda ilk başlık aynı.
3. Tasarım formu — ürün/item bağlamı, konum/adet/dosya/not + işlem özeti. Kaydet/cancel ve error/focus standardı. Gerçek dosya seçimi/upload yok.
4. Ana ekran — Company örneği; mevcut NormalProductionUrgencyDashboard'ın 72+ / 48–72 / 24–48 / 0–24 saat grupları ve order_count/item_count/quantity_total modeli. System/Partner/Customer için olmayan KPI icat etmek yerine mevcut izinli rota kısayolu.
5. İşlem merkezi — standard/transfer/PDF upload ve download aynı görünümde; processing ile ready ayrımı. Motorlar birleştirilmez.

375px: menü/filtreler stacked, uzun form tek kolon; kritik touch44. 768px: iki kolon uygun olduğu yerde, kompakt navigation. 1440px: sidebar + geniş liste, ayrı detay/summary sütunu. %200 zoom/gerçek iOS keyboard ve screen-reader testleri bu tur yapılmadı.

## 6. Akış korunumu / pilot kabul

| Akış | Korunacak | Tasarım doğrulaması |
|---|---|---|
| Login/bootstrap/refresh/logout | Cookie/CSRF/refresh queue/role route | Loading çözülmeden yanlış 403 yok; transport testleri uygulama aşamasında |
| Liste→detay | OrderSearch.resolve ve mevcut route params | Kimlik/durum/CTA anlaşılır, route/category/affiliated bağlamı açık |
| Bulk approve/cancel/restore | Kayıt/tenant kapsamı ve existing selection reset policy | Seçili adet + sonuç + confirmation; kırmızı yalnız gerçek yıkıcı işlem |
| Design upload→complete→ready | item/client/group/position/qty/routing, multipart session/idempotency | “Yüklendi” ve “hazır” ayrı; active task route değişiminde kaybolmaz |
| Adres→quote→label→production | Provider/service/currency/quantity ve side-effect ön koşulu | Seçilen adres/hizmet/ücret ve sonuç açık; double-submit engeli |
| Transfer ölçü→production | Normalized x/y/w/h, MIN_PERCENT, birim ve kategori | Drag için eşdeğer numeric/keyboard; API değerleri aynı |
| Payment/topup/refund/remake | Tutar/currency/rounding/owner/review/status | Karar kapsamı ve repeat/reconciliation davranışı korunur |
| Scanner/PDF/print/flaw | Enter/focus/duplicate scan/print/download payload | Operatör feedback ve focus dönüşü; gerçek baskı bu görevde yapılmaz |
| Permissions/integrations | Role/tenant/category/API secret sözleşmesi | Görsel gizleme permission vermek değildir; secret test/veri yok |

Pilot EASYJET-26 (standard orders/pre-orders) → önce kullanıcı görsel/işlevsel kabulü, sonra diğer aileler. EASYJET-19 onayı pilot uygulamasının tamamlandığı anlamına gelmez.

## 7. Geri bildirim ve açık kararlar

Bu tur kullanıcı görüşmesi veya rol hesaplarıyla uygulama QA yapılmadı. Açık konular:

- Teal primary + mevcut turuncu logo yönü kabul ediliyor mu, yoksa mevcut mavi primary korunmalı mı?
- İlk pilot gerçekten standard orders/pre-orders mı; günlük en yoğun kullanıcı CompanyAdmin mi CustomerAdmin mi?
- Liste density comfortable mı, operatör compact seçeneği gerekli mi?
- CompanyWorker ve CustomerWorker için gerçek görev/menu beklentileri nedir? Rolü başka admin rolüne eşitleme yok.
- Uzun tasarım/kargo formu için desktop sheet ve mobile full viewport yaklaşımı kabul ediliyor mu?
- Mevcut verification15sn redirect değişimi istenirse ayrıca açık iş kuralı onayı alınacak.

Gerekli mevcut ekran örnekleri: CompanyAdmin pending + bir tasarım/quote modalı; CustomerAdmin order detail; CompletedWorker printer; ShipmentWorker shipped search. Paylaşılırsa müşteri/adres/secret/tutar hassas bilgileri maskelenmeli. Bu görseller bulunmadan statik audit varsayımlarına “live validated” yazılmayacak.

## 8. Kabul durumu

- [x] 96 route / 75 component-helper kaynak envanteri ve role/category bildirim matrisi hazır.
- [x] Token/type/space/density/status önerisi ve 5 ekran için 375/768/1440px fixture wireframe hazır.
- [ ] Gerçek uygulama rol/tenant/cihaz ve kullanıcı geri bildirimi doğrulaması tamamlandı.
- [ ] Kullanıcı tasarım dilini ve pilot/akış korunumu matrisini açıkça onayladı.
- [ ] Doküman PR'ı dev'e merge edildi.

Bu nedenle Jira Done değil; tasarım incelemesi aşamasında kalır. EASYJET-20 veya başka uygulama task'ı başlatılmaz.
