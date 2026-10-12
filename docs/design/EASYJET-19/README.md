# EASYJET-19 — Tasarım inceleme paketi

Bu PR yalnız doküman ve örnek ekran görüntüleri içerir. Uygulama, API ve iş kuralları değişmedi; tasarım henüz onaylanmadı.

**v0.1 kullanıcı tarafından reddedildi.** Eski beş ekran ve teal token önerisi uygulama referansı değildir. Önce [yeni tek ekran görsel yönünü (v0.2)](visual-direction-v2.md) inceleyin. Bu önerinin de kullanıcı onayı yok; diğer ekranlara yayılmadı. Bu aşamada PR merge edilmemelidir.

1. [Beş ekranın responsive taslakları](wireframes.md): sipariş listesi, detay, tasarım formu, Company üretim ana ekranı ve işlem merkezi.
2. [Tasarım dili ve korunacak akışlar](design-spec.md): token standardı, bileşen davranışları, pilot ve açık kararlar.
3. [96 route / 75 component-helper matrisi](role-route-matrix.md): kaynakta bulunan rol/kategori bildirimleri; backend yetki garantisi değildir.
4. [Doğrulama ve eksik kontroller](verification.md): fixture testleri ile gerçek uygulama testlerinin ayrımı.

Önce renk yönünü, ekran düzenini ve standard sipariş listesi pilotunu inceleyip geri bildirim verin. Gerçek rol/cihaz doğrulaması, açık kullanıcı tasarım onayı ve PR merge'i olmadan EASYJET-19 Done yapılmaz. EASYJET-20 bu onaydan sonra başlayacaktır.

Görseller DEMO veridir; çalışan uygulamanın veya production'ın ekran görüntüleri değildir. Production deployment gerekmez. Rollback gerekirse yalnız bu doküman commit'i geri alınır.
