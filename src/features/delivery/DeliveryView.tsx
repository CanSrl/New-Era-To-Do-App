import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase, FolderKanban, PackageOpen } from 'lucide-react';
import { useTaskStore } from '@/store';
import { TaskItem } from '@/components/TaskItem';
import type { Task } from '@/lib/types';
import { filterForDelivery, groupForDelivery } from './grouping';

interface DeliveryViewProps {
    onEditTask: (task: Task) => void;
}

/**
 * Teslim odaklı görünüm: görevler müşteri → proje kırılımında, her grupta
 * teslim tarihine göre sıralı.
 *
 * Görev satırı bilinçli olarak `TaskItem` ile aynı bileşen. Kendi satırını
 * çizseydi tamamlama, silme, öncelik rozeti ve erişilebilirlik etiketleri
 * ikinci bir yerde tekrar edilir ve iki ekran zamanla ayrışırdı.
 *
 * Sürükle-bırak burada YOK: görev listesindeki sıralama `position` alanını
 * yazıyor, oysa bu ekranın sırası teslim tarihinden türüyor. Sürüklemeye izin
 * verilseydi kullanıcı göremediği bir alanı değiştirmiş olurdu.
 */
export function DeliveryView({ onEditTask }: DeliveryViewProps) {
    const { t } = useTranslation();
    const tasks = useTaskStore((state) => state.tasks);
    const clients = useTaskStore((state) => state.clients);
    const projects = useTaskStore((state) => state.projects);
    const searchQuery = useTaskStore((state) => state.searchQuery);
    const filter = useTaskStore((state) => state.filter);

    const groups = useMemo(
        () =>
            groupForDelivery(
                filterForDelivery(tasks, { searchQuery, filter, clients, projects }),
                clients,
                projects
            ),
        [tasks, clients, projects, searchQuery, filter]
    );

    if (groups.length === 0) {
        // Hiç görev yokken ile "filtreye uyan yok" farklı durumlar: ilkinde
        // kullanıcı ne yapacağını, ikincisinde neden boş olduğunu öğrenmeli.
        const isFiltered = searchQuery.trim() !== '' || filter !== 'all';

        return (
            <div className="text-center py-16 px-4">
                <PackageOpen className="w-12 h-12 mx-auto text-muted-foreground/50" aria-hidden />
                <h2 className="mt-4 text-lg font-semibold">
                    {isFiltered ? t('delivery.noResultsTitle') : t('delivery.emptyTitle')}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                    {isFiltered ? t('delivery.noResultsBody') : t('delivery.emptyBody')}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {groups.map((group) => {
                const clientName = group.client?.name ?? t('delivery.noClient');
                const taskCount = group.projects.reduce((sum, p) => sum + p.tasks.length, 0);

                return (
                    <section
                        key={group.client?.id ?? '__noclient__'}
                        /*
                         * `region` + erişilebilir ad: ekran okuyucu kullanıcısı
                         * bölgeler arasında müşteri adıyla gezinebilsin. E2E de
                         * grubu bu adla buluyor.
                         */
                        aria-label={clientName}
                        className="rounded-2xl border border-border bg-card overflow-hidden"
                    >
                        <header className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/30">
                            <Briefcase className="w-4 h-4 text-muted-foreground" aria-hidden />
                            <h2 className="font-semibold tracking-tight">{clientName}</h2>
                            <span className="ml-auto text-xs text-muted-foreground">
                                {t('delivery.taskCount', { count: taskCount })}
                            </span>
                        </header>

                        <div className="divide-y divide-border">
                            {group.projects.map((projectGroup) => (
                                <div
                                    key={projectGroup.project?.id ?? '__noproject__'}
                                    className="px-5 py-4"
                                >
                                    <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
                                        <FolderKanban className="w-3.5 h-3.5" aria-hidden />
                                        {projectGroup.project?.name ?? t('project.none')}
                                    </h3>

                                    <div className="space-y-2">
                                        {projectGroup.tasks.map((task) => (
                                            <TaskItem key={task.id} task={task} onEdit={onEditTask} />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}
