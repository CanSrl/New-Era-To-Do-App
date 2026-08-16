import { useTranslation } from 'react-i18next';
import { FilterBar } from '../components/FilterBar';
import { DeliveryView } from '../features/delivery/DeliveryView';
import { useUiStore } from '../store/ui';

/**
 * Teslim odaklı görünümün sayfa kabuğu.
 *
 * Rota `NICHE_MODULE` kapılıdır (bkz. `router.tsx`); bayrak kapalıyken bu
 * sayfa hiç kaydedilmez ve paketten tamamen elenir, dolayısıyla burada ayrıca
 * bayrak kontrolü yok.
 *
 * `FilterBar` görev listesiyle aynı bileşen ve aynı store alanlarını okuyor:
 * kullanıcı iki ekran arasında geçerken filtresi ve araması korunur. Bu
 * bilinçli — arama kutusunu sıfırlamak, aynı işi iki kez yazdırırdı.
 */
export function DeliveryPage() {
    const { t } = useTranslation();

    // Form kabukta (AppLayout) render edilir; burada yalnızca açılır.
    const openTaskForm = useUiStore((state) => state.openTaskForm);

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-bold tracking-tight">{t('delivery.title')}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{t('delivery.subtitle')}</p>
            </header>

            <FilterBar />

            <DeliveryView onEditTask={(task) => openTaskForm(task.id)} />
        </div>
    );
}
