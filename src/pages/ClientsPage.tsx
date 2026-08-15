import { useId, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useTaskStore } from '../store';
import { CLIENT_NAME_MAX, clientsForDisplay } from '../lib/clients';
import { projectsForDisplay } from '../lib/projects';
import { ClientCard } from '../components/ClientCard';

/**
 * Müşteri ve proje yönetimi — niş modülün yönetim ekranı.
 *
 * Rota `features.nicheModule` kapılıdır (bkz. `router.tsx`); bayrak kapalıysa
 * bu sayfa hiç kaydedilmez, dolayısıyla burada ayrıca bayrak kontrolü yok.
 *
 * Store aboneliği tek yerde toplanır ve sayaçlar burada hesaplanıp aşağı
 * geçirilir: her kart `tasks` dizisine ayrı ayrı abone olsaydı tek bir görev
 * değişikliği bütün kartları yeniden render ederdi.
 */
export function ClientsPage() {
    const { t } = useTranslation();
    const clients = useTaskStore((state) => state.clients);
    const projects = useTaskStore((state) => state.projects);
    const tasks = useTaskStore((state) => state.tasks);
    const addClient = useTaskStore((state) => state.addClient);

    const [draft, setDraft] = useState('');
    const fieldId = useId();

    const ordered = useMemo(() => clientsForDisplay(clients), [clients]);

    const { clientTaskCounts, projectTaskCounts } = useMemo(() => {
        const byClient: Record<string, number> = {};
        const byProject: Record<string, number> = {};

        for (const task of tasks) {
            if (task.clientId) byClient[task.clientId] = (byClient[task.clientId] ?? 0) + 1;
            if (task.projectId) byProject[task.projectId] = (byProject[task.projectId] ?? 0) + 1;
        }

        return { clientTaskCounts: byClient, projectTaskCounts: byProject };
    }, [tasks]);

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();

        const trimmed = draft.trim();
        if (!trimmed) {
            toast.error(t('client.nameEmpty'));
            return;
        }

        if (!addClient(trimmed)) {
            toast.error(t('client.nameTaken', { name: trimmed }));
            return;
        }

        setDraft('');
        toast.success(t('client.added', { name: trimmed }));
    };

    return (
        <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight">{t('client.pageTitle')}</h2>
            <p className="mb-6 mt-1 text-sm text-muted-foreground">{t('client.pageDescription')}</p>

            {ordered.length > 0 ? (
                <ul className="space-y-3">
                    {ordered.map((client) => (
                        <ClientCard
                            key={client.id}
                            client={client}
                            projects={projectsForDisplay(projects, client.id)}
                            taskCount={clientTaskCounts[client.id] ?? 0}
                            projectTaskCounts={projectTaskCounts}
                        />
                    ))}
                </ul>
            ) : (
                <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    {t('client.empty')}
                </p>
            )}

            <form onSubmit={handleAdd} className="mt-4 flex items-center gap-2">
                <label htmlFor={`${fieldId}-name`} className="sr-only">
                    {t('client.newNameLabel')}
                </label>
                <input
                    id={`${fieldId}-name`}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={CLIENT_NAME_MAX}
                    placeholder={t('client.newPlaceholder')}
                    className="h-10 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
                <button
                    type="submit"
                    className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-secondary px-4 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                >
                    <Plus size={16} />
                    {t('common.add')}
                </button>
            </form>
        </div>
    );
}
