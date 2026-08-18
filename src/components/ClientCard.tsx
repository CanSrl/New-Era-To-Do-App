import { useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Archive, ArchiveRestore, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useTaskStore } from '../store';
import { CLIENT_NAME_MAX } from '../lib/clients';
import { PROJECT_NAME_MAX } from '../lib/projects';
import type { Client, Project } from '../lib/types';
import { InlineName } from './InlineName';
import { InlineRate } from './InlineRate';
import { ProjectRow } from './ProjectRow';
import { cn } from '../lib/utils';
import {
    AlertDialog,
    AlertDialogTrigger,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogFooter,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogAction,
    AlertDialogCancel,
} from './ui/alert-dialog';

interface ClientCardProps {
    client: Client;
    /** Bu müşterinin projeleri, ekran sırasında. */
    projects: Project[];
    /** Bu müşteriye bağlı görev sayısı. */
    taskCount: number;
    /** Proje id → o projeye bağlı görev sayısı. */
    projectTaskCounts: Record<string, number>;
    /** Bu müşteriye ait zaman kayıtlarının sayısı ve toplam süresi. */
    timeLogs: { count: number; minutes: number };
    /** Proje id → o projeye bağlı zaman kaydı sayısı. */
    projectLogCounts: Record<string, number>;
}

/**
 * Açılan panelin içindeki satırlar sırayla belirir; hepsi aynı anda
 * görünseydi geçiş bir "sıçrama" gibi okunurdu.
 */
const listVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
};

const iconButtonClass =
    'p-2 shrink-0 rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground';

export function ClientCard({
    client,
    projects,
    taskCount,
    projectTaskCounts,
    timeLogs,
    projectLogCounts,
}: ClientCardProps) {
    const { t } = useTranslation();
    const updateClient = useTaskStore((state) => state.updateClient);
    const deleteClient = useTaskStore((state) => state.deleteClient);
    const addProject = useTaskStore((state) => state.addProject);

    const [isExpanded, setIsExpanded] = useState(false);
    const [projectDraft, setProjectDraft] = useState('');
    const panelId = useId();

    // Hareket kullanıcı tercihine saygı duyar: azaltılmış hareket isteyen
    // kullanıcıda panel anında açılır, yükseklik animasyonu hiç koşmaz.
    const reduceMotion = useReducedMotion();
    const duration = reduceMotion ? 0 : 0.3;

    const handleRename = (name: string) => {
        updateClient(client.id, { name });

        // Store adı reddetmiş olabilir: başka bir müşteri zaten bu adı taşıyor.
        const saved = useTaskStore.getState().clients.find((c) => c.id === client.id);
        if (saved?.name !== name) {
            toast.error(t('client.nameTaken', { name }));
            return false;
        }

        toast.success(t('client.updated'));
        return true;
    };

    /**
     * Müşterinin ücreti `not null`, dolayısıyla alan boş bırakılamaz
     * (`allowEmpty` verilmiyor) ve `null` buraya hiç ulaşmaz.
     */
    const handleRate = (rate: number | null) => {
        const next = rate ?? 0;
        updateClient(client.id, { hourlyRate: next });

        // Store reddetmiş olabilir: negatif ücret şemadaki kısıtı ihlal eder.
        const saved = useTaskStore.getState().clients.find((c) => c.id === client.id);
        if (saved?.hourlyRate !== next) {
            toast.error(t('time.rateInvalid'));
            return false;
        }

        toast.success(t('time.rateUpdated'));
        return true;
    };

    const handleCurrency = (raw: string) => {
        updateClient(client.id, { currency: raw });

        // Store üç harfli olmayan kodu reddeder, kalanı büyük harfe çevirir.
        const saved = useTaskStore.getState().clients.find((c) => c.id === client.id);
        if (saved?.currency !== raw.toUpperCase()) {
            toast.error(t('time.currencyInvalid'));
            return false;
        }

        toast.success(t('time.currencyUpdated'));
        return true;
    };

    /**
     * Silme diyaloğundaki süre. `TimeView`'daki ikiziyle aynı; biçim dile
     * bağlı olduğu için `time.hm`/`time.mOnly` anahtarlarına dayanır.
     */
    const formatDuration = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const rest = minutes % 60;
        return hours > 0 ? t('time.hm', { hours, minutes: rest }) : t('time.mOnly', { minutes });
    };

    const handleArchiveToggle = () => {
        const archived = !client.archived;
        updateClient(client.id, { archived });
        toast.success(
            archived
                ? t('client.archived', { name: client.name })
                : t('client.unarchived', { name: client.name })
        );
    };

    const handleDelete = () => {
        deleteClient(client.id);
        toast.success(t('client.deleted', { name: client.name }));
    };

    const handleAddProject = (e: React.FormEvent) => {
        e.preventDefault();

        const trimmed = projectDraft.trim();
        if (!trimmed) {
            toast.error(t('project.nameEmpty'));
            return;
        }

        if (!addProject(client.id, trimmed)) {
            toast.error(t('project.nameTaken', { name: trimmed }));
            return;
        }

        setProjectDraft('');
        toast.success(t('project.added', { name: trimmed }));
    };

    return (
        <li
            className={cn(
                'rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md',
                client.archived && 'opacity-60'
            )}
        >
            <div className="flex items-center gap-1 p-3">
                {/*
                  * Genişletme ayrı bir buton: satırın tamamını tıklanabilir
                  * yapmak, içindeki ad girdisi ve eylem butonlarıyla iç içe
                  * geçerdi — ve `div onClick` klavyeyle hiç açılmazdı.
                  */}
                <button
                    type="button"
                    onClick={() => setIsExpanded((open) => !open)}
                    aria-expanded={isExpanded}
                    aria-controls={panelId}
                    aria-label={
                        isExpanded
                            ? t('client.collapseLabel', { name: client.name })
                            : t('client.expandLabel', { name: client.name })
                    }
                    className={iconButtonClass}
                >
                    <motion.span
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration }}
                        className="block"
                    >
                        <ChevronRight size={18} />
                    </motion.span>
                </button>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <InlineName
                            value={client.name}
                            maxLength={CLIENT_NAME_MAX}
                            label={t('client.nameLabel', { name: client.name })}
                            onCommit={handleRename}
                            className="font-medium"
                        />
                        {client.archived && (
                            <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                {t('common.archived')}
                            </span>
                        )}
                    </div>
                    <p className="px-2 text-xs text-muted-foreground">
                        {t('client.projectCount', { count: projects.length })}
                        {' · '}
                        {t('client.taskCount', { count: taskCount })}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={handleArchiveToggle}
                    aria-label={
                        client.archived
                            ? t('client.unarchiveLabel', { name: client.name })
                            : t('client.archiveLabel', { name: client.name })
                    }
                    className={iconButtonClass}
                >
                    {client.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                </button>

                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <button
                            type="button"
                            aria-label={t('client.deleteLabel', { name: client.name })}
                            className={cn(iconButtonClass, 'hover:bg-destructive/10 hover:text-destructive')}
                        >
                            <Trash2 size={16} />
                        </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                {t('client.deleteConfirmTitle', { name: client.name })}
                            </AlertDialogTitle>
                            {/*
                              * Onay metni veritabanının iki ayrı davranışını da
                              * söyler: projeler cascade ile silinir, görevler
                              * silinmez ama `clear_tasks_for_deleted_client`
                              * tetikleyicisi İKİ bağı birden boşaltır.
                              */}
                            <AlertDialogDescription>
                                {projects.length > 0
                                    ? t('client.deleteConfirmProjects', { count: projects.length })
                                    : t('client.deleteConfirmProjectsNone')}
                                {' '}
                                {taskCount > 0
                                    ? t('client.deleteConfirmTasks', { count: taskCount })
                                    : t('client.deleteConfirmTasksNone')}
                                {' '}
                                {timeLogs.count > 0
                                    ? t('client.deleteConfirmLogs', {
                                        count: timeLogs.count,
                                        duration: formatDuration(timeLogs.minutes),
                                    })
                                    : t('client.deleteConfirmLogsNone')}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete}>
                                {t('common.delete')}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>

            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        id={panelId}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration, ease: [0.04, 0.62, 0.23, 0.98] }}
                        className="overflow-hidden"
                    >
                        <div className="ml-6 space-y-2 border-l border-border px-3 pb-3 pl-3">
                            {/*
                              * Ücret paneldedir, kart başlığında değil: başlık
                              * satırı zaten ad ve üç eylem taşıyor, dar ekranda
                              * taşardı. Para birimi müşteri seviyesindedir —
                              * `projects` tablosunda karşılığı yok, proje
                              * yalnızca ücreti ezebilir.
                              */}
                            <div className="flex items-center gap-2 pb-1">
                                <span className="shrink-0 text-xs text-muted-foreground">
                                    {t('time.rateHeading')}
                                </span>
                                <InlineRate
                                    value={client.hourlyRate}
                                    label={t('time.rateLabel', { name: client.name })}
                                    onCommit={handleRate}
                                    className="w-28 text-sm"
                                />
                                {/*
                                  * Para birimi de satır içi bir metin alanı:
                                  * `InlineName` yalnızca ada özel değil, aynı
                                  * commit/Escape sözleşmesini taşıyan her kısa
                                  * metin için geçerli.
                                  */}
                                <InlineName
                                    value={client.currency}
                                    maxLength={3}
                                    label={t('time.currencyLabel', { name: client.name })}
                                    onCommit={handleCurrency}
                                    className="w-16 text-sm uppercase"
                                />
                            </div>

                            {projects.length > 0 ? (
                                <motion.ul
                                    variants={listVariants}
                                    initial="hidden"
                                    animate="visible"
                                    className="space-y-1"
                                >
                                    {projects.map((project) => (
                                        <ProjectRow
                                            key={project.id}
                                            project={project}
                                            taskCount={projectTaskCounts[project.id] ?? 0}
                                            timeLogCount={projectLogCounts[project.id] ?? 0}
                                            inheritedRate={client.hourlyRate}
                                            currency={client.currency}
                                        />
                                    ))}
                                </motion.ul>
                            ) : (
                                <p className="px-2 py-1 text-sm text-muted-foreground">
                                    {t('project.empty')}
                                </p>
                            )}

                            <form onSubmit={handleAddProject} className="flex items-center gap-2">
                                <input
                                    value={projectDraft}
                                    onChange={(e) => setProjectDraft(e.target.value)}
                                    maxLength={PROJECT_NAME_MAX}
                                    placeholder={t('project.newPlaceholder')}
                                    aria-label={t('project.newNameLabel', { client: client.name })}
                                    className="h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                />
                                <button
                                    type="submit"
                                    aria-label={t('project.addLabel', { client: client.name })}
                                    className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-secondary px-3 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                                >
                                    <Plus size={16} />
                                </button>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </li>
    );
}
