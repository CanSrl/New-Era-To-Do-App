import { TimeView } from '../features/time/TimeView';

/**
 * Zaman kayıtları sayfasının kabuğu.
 *
 * Rota `NICHE_MODULE` kapılıdır (bkz. `router.tsx`); bayrak kapalıyken bu
 * sayfa hiç kaydedilmez ve paketten tamamen elenir, dolayısıyla burada ayrıca
 * bayrak kontrolü yok.
 *
 * `FilterBar` bilinçli olarak YOK: görev listesindeki arama/durum filtresi
 * görevlere ait, zaman kayıtlarına değil. Aynı çubuğu buraya koymak "aktif /
 * tamamlandı" gibi bu ekranda karşılığı olmayan bir kavramı taşırdı; ekranın
 * kendi filtresi müşteri, proje ve tarih aralığı.
 */
export function TimePage() {
    return <TimeView />;
}
