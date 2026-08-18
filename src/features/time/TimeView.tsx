import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { Clock, Edit2, Plus, Trash2 } from 'lucide-react';
import { useTaskStore } from '@/store';
import type { TimeLog } from '@/lib/types';
import { dateLocaleFor } from '@/i18n';
import { clientsForDisplay } from '@/lib/clients';
import { projectsForDisplay } from '@/lib/projects';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { byStartedAtDesc, filterLogs, groupTotals, sumByCurrency } from './totals';
import { TimeLogForm } from './TimeLogForm';

const FIELD_CLASS =
    'flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Zaman ekranı: filtre, kayıt listesi ve müşteri → proje toplamları.
 *
 * Filtre `filterLogs` ile uygulanıyor — CSV dışa aktarımı (Görev 8) **aynı**
 * fonksiyonu kullanacak, böylece kullanıcı ekranda ne görüyorsa onu dışa
 * aktarır.
 */
export function TimeView() {
    const { t, i18n } = useTranslation();

    const timeLogs = useTaskStore((state) => state.timeLogs);
    const clients = useTaskStore((state) => state.clients);
    const projects = useTaskStore((state) => state.projects);
    const tasks = useTaskStore((state) => state.tasks);
    const deleteTimeLog = useTaskStore((state) => state.deleteTimeLog);

    const [clientId, setClientId] = useState('');
    const [projectId, setProjectId] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Düzenlenen kayıt id üzerinden çözülür: açık formdaki kopya senkron
    // turunda bayatlayabilir (`AppLayout`'taki görev formuyla aynı gerekçe).
    const editingLog = editingId ? timeLogs.find((log) => log.id === editingId) : undefined;

    const visible = useMemo(
        () => filterLogs(timeLogs, { clientId, projectId, from, to }).sort(byStartedAtDesc),
        [timeLogs, clientId, projectId, from, to]
    );

    const totals = useMemo(
        () => groupTotals(visible, clients, projects),
        [visible, clients, projects]
    );
    const currencyTotals = useMemo(() => sumByCurrency(totals), [totals]);

    const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
    const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
    const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

    const locale = dateLocaleFor(i18n.language);
    const formatDay = (iso: string) => format(parseISO(iso), 'd MMM yyyy HH:mm', { locale });

    /** Süreyi okunur biçime çevirir; saat basamağı yoksa yalnızca dakika. */
    const formatMinutes = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const rest = minutes % 60;
        return hours > 0 ? t('time.hm', { hours, minutes: rest }) : t('time.mOnly', { minutes });
    };

    /**
     * Tutar `Intl` ile biçimlenir: para birimi simgesi ve ayraçlar dile göre
     * değişir, çeviri dosyasında sabitlenemez. Para birimi bilinmiyorsa
     * (müşterisi çözülemeyen kayıt) tutar hiç gösterilmez — 0 yazmak
     * "ücretsiz" gibi okunurdu.
     */
    const formatAmount = (amount: number, currency: string | null) =>
        currency
            ? new Intl.NumberFormat(i18n.language, { style: 'currency', currency }).format(amount)
            : '—';

    const handleDelete = (log: TimeLog) => {
        deleteTimeLog(log.id);
        toast.success(t('time.deleted'));
    };

    const openEdit = (log: TimeLog) => {
        setEditingId(log.id);
        setIsFormOpen(true);
    };

    const closeForm = () => {
        setIsFormOpen(false);
        setEditingId(null);
    };

    // Proje seçicisi seçili müşteriye daralır; müşteri seçilmemişken bütün
    // projeleri listelemek farklı müşterilerin aynı adlı projelerini
    // ayırt edilemez hale getirirdi.
    const projectOptions = clientId ? projectsForDisplay(projects, clientId) : [];

    return (
        <div className="space-y-6">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">{t('time.pageTitle')}</h2>
                    <p className="text-sm text-muted-foreground">{t('time.pageDescription')}</p>
                </div>

                <button
                    type="button"
                    onClick={() => { setEditingId(null); setIsFormOpen(true); }}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 active:scale-95"
                >
                    <Plus size={18} />
                    {t('time.add')}
                </button>
            </header>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                    <label htmlFor="filter-client" className="text-xs font-medium text-muted-foreground">
                        {t('time.client')}
                    </label>
                    <select
                        id="filter-client"
                        value={clientId}
                        onChange={(e) => { setClientId(e.target.value); setProjectId(''); }}
                        className={FIELD_CLASS}
                    >
                        <option value="">{t('time.filterAllClients')}</option>
                        {clientsForDisplay(clients).map((client) => (
                            <option key={client.id} value={client.id}>{client.name}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-1">
                    <label htmlFor="filter-project" className="text-xs font-medium text-muted-foreground">
                        {t('time.project')}
                    </label>
                    <select
                        id="filter-project"
                        value={projectId}
                        disabled={!clientId}
                        onChange={(e) => setProjectId(e.target.value)}
                        className={FIELD_CLASS}
                    >
                        <option value="">{t('time.filterAllProjects')}</option>
                        {projectOptions.map((project) => (
                            <option key={project.id} value={project.id}>{project.name}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-1">
                    <label htmlFor="filter-from" className="text-xs font-medium text-muted-foreground">
                        {t('time.filterFrom')}
                    </label>
                    <input
                        id="filter-from"
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                        className={FIELD_CLASS}
                    />
                </div>

                <div className="space-y-1">
                    <label htmlFor="filter-to" className="text-xs font-medium text-muted-foreground">
                        {t('time.filterTo')}
                    </label>
                    <input
                        id="filter-to"
                        type="date"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        className={FIELD_CLASS}
                    />
                </div>
            </div>

            {visible.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-10 text-center">
                    <Clock size={32} className="mx-auto mb-3 text-muted-foreground/50" />
                    <h3 className="font-semibold">
                        {timeLogs.length === 0 ? t('time.emptyTitle') : t('time.noResultsTitle')}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {timeLogs.length === 0 ? t('time.emptyBody') : t('time.noResultsBody')}
                    </p>
                </div>
            ) : (
                <>
                    <ul className="space-y-2">
                        {visible.map((log) => {
                            const client = clientById.get(log.clientId);
                            const project = log.projectId ? projectById.get(log.projectId) : undefined;
                            const task = log.taskId ? taskById.get(log.taskId) : undefined;
                            const day = formatDay(log.startedAt);

                            return (
                                <li
                                    key={log.id}
                                    className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-medium">
                                            {task?.title ?? log.note ?? t('time.noTask')}
                                        </p>
                                        <p className="truncate text-xs text-muted-foreground">
                                            {[
                                                client?.name ?? t('time.unknownClient'),
                                                project?.name,
                                            ].filter(Boolean).join(' · ')}
                                        </p>
                                        {task && log.note && (
                                            <p className="truncate text-xs text-muted-foreground">{log.note}</p>
                                        )}
                                    </div>

                                    <div className="shrink-0 text-right">
                                        <p className="font-mono text-sm tabular-nums">
                                            {formatMinutes(log.durationMinutes)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">{day}</p>
                                    </div>

                                    <div className="flex shrink-0 items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => openEdit(log)}
                                            aria-label={t('time.editLabel', { date: day })}
                                            className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-primary/10 hover:text-primary group-hover:opacity-100 focus-visible:opacity-100"
                                        >
                                            <Edit2 size={16} />
                                        </button>

                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <button
                                                    type="button"
                                                    aria-label={t('time.deleteLabel', { date: day })}
                                                    className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>
                                                        {t('time.deleteConfirmTitle')}
                                                    </AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        {t('time.deleteConfirmBody')}
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(log)}>
                                                        {t('common.delete')}
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>

                    <section className="rounded-xl border border-border bg-card/50 p-4">
                        <h3 className="mb-3 font-semibold">{t('time.totals')}</h3>

                        <ul className="space-y-3">
                            {totals.map((total) => (
                                <li key={total.client?.id ?? 'bagsiz'}>
                                    <div className="flex items-baseline justify-between gap-3">
                                        <span className="font-medium">
                                            {total.client?.name ?? t('time.unknownClient')}
                                        </span>
                                        <span className="font-mono text-sm tabular-nums">
                                            {formatMinutes(total.minutes)} ·{' '}
                                            {formatAmount(total.amount, total.currency)}
                                        </span>
                                    </div>

                                    <ul className="mt-1 space-y-0.5 pl-4">
                                        {total.projects.map((group) => (
                                            <li
                                                key={group.project?.id ?? 'projesiz'}
                                                className="flex items-baseline justify-between gap-3 text-sm text-muted-foreground"
                                            >
                                                <span className="truncate">
                                                    {group.project?.name ?? t('time.projectNone')}
                                                </span>
                                                <span className="font-mono tabular-nums">
                                                    {formatMinutes(group.minutes)} ·{' '}
                                                    {formatAmount(group.amount, total.currency)}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </li>
                            ))}
                        </ul>

                        {/*
                          * Genel toplam para birimi BAŞINA verilir; kur dönüşümü
                          * yok. 1000 TL ile 100 USD'yi toplayan tek bir sayı,
                          * hangi kurdan çevrildiği belirsiz olduğu için faturaya
                          * esas alınamaz.
                          */}
                        <div className="mt-4 space-y-1 border-t border-border pt-3">
                            {currencyTotals.map((total) => (
                                <div
                                    key={total.currency}
                                    className="flex items-baseline justify-between gap-3 font-medium"
                                >
                                    <span>{total.currency}</span>
                                    <span className="font-mono tabular-nums">
                                        {formatMinutes(total.minutes)} ·{' '}
                                        {formatAmount(total.amount, total.currency)}
                                    </span>
                                </div>
                            ))}
                            <p className="pt-1 text-xs text-muted-foreground">
                                {t('time.logCount', { count: visible.length })}
                            </p>
                        </div>
                    </section>
                </>
            )}

            {isFormOpen && <TimeLogForm onClose={closeForm} logToEdit={editingLog} />}
        </div>
    );
}
