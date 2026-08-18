import { motion } from 'framer-motion';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useTaskStore } from '../store';
import { PROJECT_NAME_MAX } from '../lib/projects';
import type { Project } from '../lib/types';
import { InlineName } from './InlineName';
import { InlineRate } from './InlineRate';
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

/**
 * Üst listedeki `staggerChildren` bu varyantları sırayla tetikler; adları
 * ("hidden"/"visible") ebeveynle eşleştiği için ayrıca bağlamak gerekmez.
 */
const projectRowVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0 },
};

const iconButtonClass =
    'p-2 shrink-0 rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground';

interface ProjectRowProps {
    project: Project;
    /** Bu projeye bağlı görev sayısı. */
    taskCount: number;
    /** Bu projeye bağlı zaman kaydı sayısı. */
    timeLogCount: number;
    /** Müşterinin ücreti — override boşken yer tutucuda gösterilir. */
    inheritedRate: number;
    /** Müşterinin para birimi; projede ayrı bir sütun yok. */
    currency: string;
}

export function ProjectRow({
    project,
    taskCount,
    timeLogCount,
    inheritedRate,
    currency,
}: ProjectRowProps) {
    const { t, i18n } = useTranslation();
    const updateProject = useTaskStore((state) => state.updateProject);
    const deleteProject = useTaskStore((state) => state.deleteProject);

    const handleRename = (name: string) => {
        updateProject(project.id, { name });

        // Store adı reddetmiş olabilir: aynı müşterinin başka bir projesi
        // zaten bu adı taşıyordur.
        const saved = useTaskStore.getState().projects.find((p) => p.id === project.id);
        if (saved?.name !== name) {
            toast.error(t('project.nameTaken', { name }));
            return false;
        }

        toast.success(t('project.updated'));
        return true;
    };

    const handleArchiveToggle = () => {
        const archived = !project.archived;
        updateProject(project.id, { archived });
        toast.success(
            archived
                ? t('project.archived', { name: project.name })
                : t('project.unarchived', { name: project.name })
        );
    };

    /**
     * `null` mirası geri getirir, `0` projeyi ücretsiz yapar — ikisi farklı,
     * bu yüzden boş alan `0`'a çevrilmez.
     */
    const handleRate = (rate: number | null) => {
        updateProject(project.id, { hourlyRate: rate });

        // Store reddetmiş olabilir (negatif ücret şemadaki kısıtı ihlal eder).
        const saved = useTaskStore.getState().projects.find((p) => p.id === project.id);
        if (saved?.hourlyRate !== rate) {
            toast.error(t('time.rateInvalid'));
            return false;
        }

        toast.success(t('time.rateUpdated'));
        return true;
    };

    const handleDelete = () => {
        deleteProject(project.id);
        toast.success(t('project.deleted', { name: project.name }));
    };

    return (
        <motion.li
            variants={projectRowVariants}
            className={cn(
                'flex items-center gap-2 rounded-lg py-1 pl-2 pr-1 transition-colors hover:bg-muted/40',
                project.archived && 'opacity-60'
            )}
        >
            <InlineName
                value={project.name}
                maxLength={PROJECT_NAME_MAX}
                label={t('project.nameLabel', { name: project.name })}
                onCommit={handleRename}
                className="text-sm"
            />

            {project.archived && (
                <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {t('common.archived')}
                </span>
            )}

            <InlineRate
                value={project.hourlyRate}
                label={t('time.projectRateLabel', { name: project.name })}
                placeholder={t('time.inheritedRate', {
                    rate: new Intl.NumberFormat(i18n.language, {
                        style: 'currency',
                        currency,
                    }).format(inheritedRate),
                })}
                allowEmpty
                onCommit={handleRate}
                className="w-32 shrink-0 text-right text-sm"
            />

            <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {t('project.taskCount', { count: taskCount })}
            </span>

            <button
                type="button"
                onClick={handleArchiveToggle}
                aria-label={
                    project.archived
                        ? t('project.unarchiveLabel', { name: project.name })
                        : t('project.archiveLabel', { name: project.name })
                }
                className={iconButtonClass}
            >
                {project.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
            </button>

            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <button
                        type="button"
                        aria-label={t('project.deleteLabel', { name: project.name })}
                        className={cn(iconButtonClass, 'hover:bg-destructive/10 hover:text-destructive')}
                    >
                        <Trash2 size={15} />
                    </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t('project.deleteConfirmTitle', { name: project.name })}
                        </AlertDialogTitle>
                        {/*
                          * Onay metni veritabanının yaptığını birebir söyler:
                          * `on delete set null (project_id)` yalnızca proje
                          * bağını koparır, müşteri bağı yerinde kalır.
                          */}
                        <AlertDialogDescription>
                            {taskCount > 0
                                ? t('project.deleteConfirmTasks', { count: taskCount })
                                : t('project.deleteConfirmTasksNone')}
                            {timeLogCount > 0 && (
                                <> {t('project.deleteConfirmLogs', { count: timeLogCount })}</>
                            )}
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
        </motion.li>
    );
}
