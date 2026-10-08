# EASYJET-12 — Frontend CSRF uyumu

- Ortak Axios client ilk yazmadan önce `/auth/csrf` token'ını alır; eşzamanlı seed isteklerini birleştirir.
- Cookie okunamayan cross-site API ortamında public CSRF token yalnız bellekte tutulur; authentication token'ları Web Storage'a taşınmaz.
- Login/refresh sonrası `X-CSRF-Token` header'ı yeni token'ı bildirir. Backend bu header'ı CORS ile expose eder. Logout cache'i temizler.
- Yalnız backend middleware'inin iş handler'ı çalışmadan döndürdüğü **CSRF_INVALID** 403 yazması bir kere reseed + retry yapabilir. Normal rol 403'ü, keyfi 500 veya başarısız yazmalar otomatik tekrar edilmez. Seed GET'in kendisi tekrar döngüsüne alınmaz.
- Signed S3 direct uploads ortak API client'ı kullanmadığı için bu akış değişmez.

Local `.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:3000/api`. Başlatma: `yarn install --frozen-lockfile`, `yarn dev` (localhost:3001). Backend'in ilgili EASYJET-12 branch'i de çalışmalı. Backend local cookie/CORS/Redis ayarları ve manuel test rehberi `easyjet-be/docs/auth-security.md` içindedir.

Test: `yarn test:security`, `yarn lint`, `yarn build`. Browser smoke: login → liste → test kaydı güncelleme → reload → logout. Network'te GET `/auth/csrf` ve yazmalarda `x-csrf-token` görülür; cookie/token değerlerini paylaşmayın.

Merge ve production rollout ayrı işlerdir. **Frontend önce, backend sonra** alınmalıdır. Eski backend'de seed endpoint'i bulunmadığından yalnız 404 için legacy cookie kullanımı korunur; boş cookie eski backend'in mevcut login akışında çalışır. 403/429/503/network hatası veya bozuk 200 cevabı downgrade yapmaz. Yeni backend token'sız yazmaları her durumda reddeder; bu uyumluluk dalı backend enforcement'ını bypass edemez. Yeni frontend, backend geçişinde eski random cookie'yi CSRF_INVALID sonrası imzalı token'a yükseltir. Eski frontend bundle'ları enforcement öncesi reload edilmelidir; tüm eski tab'lara kesintisiz destek ayrı iki aşamalı endpoint/enforcement rollout işidir. Rollback önce backend, gerekiyorsa frontend; backend rollback'i güvenlik gerilemesidir. Bu PR production deployment başlatmaz.
