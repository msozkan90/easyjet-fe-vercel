# EASYJET-19 — Tasarım paketi doğrulaması

12 Ekim 2026. Kapsam yalnız tasarım/doküman/DEMO wireframe; gerçek uygulama acceptance testi değildir.

## Kaynak ve scope

- Base: origin/dev fa2e8847c719a19e7be69f6bad1753d3c61c1790.
- 96 route + 75 component/helper, 8 RoleEnum rolü; source guard/prop/default/category bildirimleri kayıtlı. Dynamic/backend/tenant izinleri çözümlenmiş sayılmıyor.
- src, public, package/lockfile, workflow, API/back-end değişikliği yok.
- Kullanıcı mevcut çalışma dosyaları korunur; ayrı worktree/branch kullanıldı.

## Görsel fixture doğrulaması

- 5 görünüm × 375/768/1440px = 15 PNG.
- Ekran gerçekten seçilmiş mi kontrolü + DOM hazır kontrolü; yatay document taşması yok.
- 5 liste durumu: data/loading/empty/filtered/error.
- Sipariş numarası ve durum filtresi, reset, local demo feedback ve mobile nav state testleri geçti.
- Browser page errors: 0.
- Fixture'da fetch/XHR/WebSocket/HTTP(S)/localStorage/sessionStorage yok; canlı sisteme bağlantı kurmuyor.
- Headless Google Chrome ile fixture render; geçici Playwright1.64.0 yalnız /tmp/easyjet19-qa içinde. Projeye paket/CI bağımlılığı eklenmedi.
- Kullanıcının browser profili/cookie/session'ı kullanılmadı; bağımsız geçici tarayıcılar kapatıldı.
- İlk screenshot denemesinde Chrome window-size ile gerçek mobile viewport farklıydı; cihaz viewport'u ayarlanan headless fixture kontrolüne geçildi. İlk çoklu ekran harness'inde same-document hash navigasyonu yeniden render etmiyordu; hashchange ve seçili görünüm doğrulaması eklenip 15 PNG yeniden üretildi. İlk eksik kontrol sonuçları nihai kanıt olarak kullanılmadı.

## Kontrast örnekleri

Hex çiftleri hesaplandı; gerçek AntD component/state bütünlüğü EASYJET-20'de ayrıca doğrulanır.

| Çift | Oran | Hedef |
|---|---|---|
| Primary #0F766E / #FFFFFF | 5.47:1 | 4.5:1 |
| Text #0F172A / #FFFFFF | 17.85:1 | 4.5:1 |
| Secondary #475569 / #F4F7FA | 7.05:1 | 4.5:1 |
| Control border #7C8DA3 / #FFFFFF | 3.39:1 | 3:1 |
| Success #15803D / #EAF6EC | 4.51:1 | 4.5:1 |
| Warning #92400E / #FFF4DF | 6.50:1 | 4.5:1 |
| Danger #B42318 / #FEF0ED | 5.92:1 | 4.5:1 |
| Info #1D4ED8 / #E8F0FE | 5.85:1 | 4.5:1 |

Başlangıç control border #94A3B8 bu hedef için kullanılmadı; daha okunur #7C8DA3 seçildi. Marka turuncusu body metin/action foreground kontrastı için önerilmiyor.

## Bekleyen / yapılmayan kontroller

Gerçek rol/tenant/category verileriyle login/order/upload/quote/payment/print testi, kullanıcı görüşmesi, screen reader, %200 zoom ve gerçek iOS keyboard testi yapılmadı. Bunlar tasarım onayı ve uygulama aşamasının kabul kapısındadır. Tam WCAG uyumu sertifikası verilmez.

Local application lint/build/security testleri bu doküman-only değişiklik için N/A; mevcut Frontend CI PR'da aynen çalışır. CI sonucu PR/Jira'da ayrıca kaydedilir; başarısız gate atlanmaz. Kullanıcı tasarım onayı ve doküman PR merge'i olmadan Done yok; EASYJET-20 başlamaz.
