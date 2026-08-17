import { useTranslation } from 'react-i18next';
import { Square, Timer, X } from 'lucide-react';
import { useTaskStore } from '../../store';
import { formatElapsed } from '../../lib/time-logs';
import { useElapsed } from './useElapsed';

/**
 * Çalışan sayacın her sayfada görünen çubuğu.
 *
 * "Unutulmuş açık sayaç" bu ürün kategorisinin klasik veri hatasıdır: sayaç
 * yalnızca başlatıldığı ekranda görünseydi kullanıcı başka bir sayfaya geçip
 * unutur, ertesi gün 14 saatlik bir kayıt bulurdu. Tek gerçek savunması
 * görünürlük — bu yüzden çubuk kabukta yaşar, sayfada değil.
 *
 * Sayaç kapalıyken hiçbir şey render edilmez; boş bir çubuk yer kaplardı.
 */
export function ActiveTimerBar() {
    const { t } = useTranslation();

    const activeTimer = useTaskStore((state) => state.activeTimer);
    const stopTimer = useTaskStore((state) => state.stopTimer);
    const discardTimer = useTaskStore((state) => state.discardTimer);

    const task = useTaskStore((state) =>
        activeTimer?.taskId ? state.tasks.find((item) => item.id === activeTimer.taskId) : undefined
    );
    const client = useTaskStore((state) =>
        activeTimer ? state.clients.find((item) => item.id === activeTimer.clientId) : undefined
    );
    const project = useTaskStore((state) =>
        activeTimer?.projectId
            ? state.projects.find((item) => item.id === activeTimer.projectId)
            : undefined
    );

    // Kanca koşulsuz çağrılır (React kuralı); sayaç yokken zaten interval
    // kurmuyor ve 0 dönüyor.
    const elapsed = useElapsed(activeTimer?.startedAt ?? null);

    if (!activeTimer) return null;

    const label = task?.title ?? t('time.noTask');
    const scope = [client?.name, project?.name].filter(Boolean).join(' · ');

    return (
        <div
            role="status"
            /*
             * Canlı bölge KAPALI: `role="status"` varsayılan olarak politely
             * duyurur ve saniyede bir değişen bir süre, ekran okuyucuyu
             * sürekli konuşturup uygulamayı kullanılamaz hale getirirdi.
             * Süre yine de okunabilir (aria-hidden değil), yalnızca kendi
             * kendine duyurulmaz.
             */
            aria-live="off"
            aria-label={t('time.running', { name: label })}
            className="sticky top-0 z-30 flex items-center gap-3 border-b border-primary/30 bg-primary/10 px-4 py-2 backdrop-blur-md"
        >
            <Timer size={16} className="shrink-0 text-primary" />

            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{label}</p>
                {scope && <p className="truncate text-xs text-muted-foreground">{scope}</p>}
            </div>

            {/* `tabular-nums`: rakam genişlikleri eşit, sayaç akarken metin oynamaz. */}
            <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">
                {formatElapsed(elapsed)}
            </span>

            <button
                type="button"
                onClick={() => stopTimer()}
                aria-label={t('time.stopAndSave')}
                className="shrink-0 rounded-md bg-primary px-2.5 py-1.5 text-primary-foreground transition-colors hover:bg-primary/90"
            >
                <Square size={14} fill="currentColor" />
            </button>

            {/*
              * Atma ayrı bir eylem: yanlışlıkla başlatılmış sayacı durdurmak,
              * kullanıcının hiç yapmadığı bir işi faturaya yazardı. Durdurmak
              * kaydeder, atmak kaydetmez — ikisi geri alınamaz biçimde farklı,
              * bu yüzden tek butonda birleştirilmedi.
              */}
            <button
                type="button"
                onClick={() => discardTimer()}
                aria-label={t('time.discard')}
                className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
                <X size={16} />
            </button>
        </div>
    );
}
