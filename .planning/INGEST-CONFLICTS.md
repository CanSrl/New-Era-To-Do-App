## Conflict Detection Report

Mode: new (no existing PROJECT.md / REQUIREMENTS.md / ROADMAP.md / CONTEXT.md to check against)
Precedence: ADR > SPEC > PRD > DOC. Both ingested docs classified SPEC with no
per-doc override and `locked: false`, so precedence rules cannot rank them
against each other.
Cross-ref graph: 2 nodes, depth 2, no cycles.

### BLOCKERS (0)

Yok. Hiçbir doküman `locked: true` değil, hiçbir sınıflandırma UNKNOWN /
low-confidence değil, çapraz referans döngüsü yok ve merge modunda değiliz.

### WARNINGS (1)

[WARNING] Competing variants for birleştirme fonksiyonu yapısı (mergeClients / mergeProjects)
  Found: docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md (§3.1)
    requires "`categories`'in senkron kodu çoğaltılır ... genelleştirme
    bilinçli olarak zaman kaydı dilimine erteleniyor" — yani mergeClients ve
    mergeProjects, mergeCategories'in tam kopyaları
  Found: docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md
    ("Spec'ten Sapma — Görev 4'te Onayınıza Sunulan"; Görev 4 Adım 3)
    requires "`mergeNamed` adında tek bir jenerik çekirdek çıkarılır ve üç
    varlığın hepsi onu kullanır" — dönüş şekli NamedMergePlan<T>, plan alanı
    adı `items`
  Impact: İki kaynak da SPEC ve eşit precedence taşıyor; precedence kuralları
    kazananı seçemez. Seçim sonuca sızıyor: VARYANT B'de runSync
    `clientPlan.items` / `projectPlan.items` okur ve mergeCategories ince bir
    sarmalayıcıya döner, VARYANT A'da kategori dönüş şekli varlık başına
    kopyalanır. Sentezin birini seçmesi diğerinin niyetini kaybettirirdi.
    Ayrıca SPEC-PLAN bu sapmayı kendi metninde "onayınıza sunulan" olarak
    işaretliyor — yani henüz onaylanmamış bir karar.
  → Kullanıcı bir varyant seçmeli. Seçim yapılmadan yönlendirme (routing)
    yapılmamalı. VARYANT B reddedilirse SPEC-PLAN Görev 4 Adım 3 atlanır,
    mergeClients/mergeProjects mergeCategories'in tam kopyaları olarak yazılır;
    SPEC-PLAN'a göre plan başka hiçbir yerde bu karara bağlı değil. VARYANT B
    kabul edilirse CLAUDE.md sapma günlüğüne ikinci satır eklenir
    (SPEC-PLAN Görev 10 Adım 4).
    İki varyant da korundu: .planning/intel/constraints.md → CON-35a, CON-35b

### INFO (3)

[INFO] Auto-resolved: `clear_tasks_for_deleted_client` içinde `set search_path = ''`
  Note: docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md
    (§1.4) tetikleyici fonksiyonu `set search_path` olmadan gösteriyor;
    docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md (Görev 1
    Adım 1) aynı fonksiyona `set search_path = ''` ekliyor. Bu bir çelişki
    değil, spec'in sessiz kaldığı bir yerde yapılan sıkılaştırma —
    SPEC-DESIGN'ın `security definer` kullanmama kararıyla da çelişmiyor.
    Sentezlenen intel SPEC-PLAN'ın sıkılaştırılmış biçimini taşıyor
    (CON-09), fark açıkça işaretlendi.

[INFO] `remapTaskLinks` imzası iki kaynakta farklı yazılmış
  Note: docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md
    (§3.4) `remapTaskLinks(tasks, clientIdRemap, projectIdRemap,
    geçerliIdKümeleri)` diyor — "geçerli id kümeleri" tek ve belirsiz bir
    argüman. docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md
    (Görev 4, Görev 5 Adım 5) bunu `remapTaskLinks(tasks, clientIdRemap,
    projectIdRemap, validClientIds, validProjectIds)` olarak somutlaştırıyor.
    Spec çelişmiyor, yalnızca belirsiz; somut imza intel'e alındı (CON-20).

[INFO] SPEC-PLAN sınıflandırması medium confidence
  Note: .planning/intel/classifications/2026-08-14-nis-modul-musteri-proje-a3f91c07.json
    dokümanı SPEC olarak medium confidence ile etiketliyor ve rakip DOC
    (görev listesi / uygulama kılavuzu) ile ADR (Spec'ten Sapma bölümü)
    sinyallerini not ediyor. Sınıflandırıcı ADR precedence'ını uygulamadı
    çünkü bölümde Status alanı yok ve sapma kabul edilmiş değil, onaya
    sunulmuş. Bu, yukarıdaki WARNING'in neden BLOCKER'a yükselmediğini de
    açıklıyor: ortada locked bir karar yok. Sapma onaylanıp bir ADR'ye
    dönüşürse yeniden ingest edildiğinde precedence ADR > SPEC olarak
    uygulanır ve varyant otomatik çözülür.

---

## RESOLUTION (2026-08-14)

[RESOLVED] Competing variants for birleştirme fonksiyonu yapısı
  Chosen: **CON-35b (VARYANT B)** — jenerik `mergeNamed` çekirdeği.
  Decided by: user, at the ingest conflict gate.
  Rationale: Spec'in erteleme gerekçesi "iki örnekten soyutlama çıkmaz, üçten
    çıkar" idi; bu dilim üçüncü örneği (kategoriler + müşteriler + projeler)
    tek başına getiriyor. Ertelenen asıl borç — runSync, repository ve store'un
    varlık başına elle yazılması — duruyor.
  Consequences:
    - SPEC-PLAN Görev 4 Adım 3 uygulanır; `mergeCategories` ince sarmalayıcıya
      döner ve imzası/dönüş şekli değişmez (mevcut testleri refactor'ı korur).
    - runSync `clientPlan.items` / `projectPlan.items` okur.
    - SPEC-PLAN Görev 10 Adım 4 gereği CLAUDE.md sapma günlüğüne ikinci satır
      eklenir.
    - SPEC-DESIGN §3.1'in "kodu çoğalt" yönergesi bu dilim için geçersizdir;
      spec bir sonraki düzenlemesinde güncellenmelidir.
  Status: karar onaylandı ancak henüz bir ADR'ye dönüştürülmedi. ADR yazılırsa
    yeniden ingest'te precedence (ADR > SPEC) varyantı otomatik çözer.
