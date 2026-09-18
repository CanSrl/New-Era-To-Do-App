import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTaskStore } from '../store';
import { PRIORITIES, type Task, type Priority } from '../lib/types';
import { byCategoryPosition } from '../lib/categories';
import { clientsForDisplay } from '../lib/clients';
import { projectsForDisplay } from '../lib/projects';
import { NICHE_MODULE } from '../config/features';
import { Briefcase, Calendar as CalendarIcon, FolderKanban, Tag } from 'lucide-react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
} from './ui/dialog';

interface TaskFormProps {
    onClose: () => void;
    taskToEdit?: Task;
}

/**
 * Arşivlenmiş kayıtlar seçicilerde görünmez — arşivlemenin amacı zaten günlük
 * işten çekilmeleri. Tek istisna görevin hâlihazırdaki bağıdır: gizlenseydi
 * form açıldığında `select` eşleşen seçeneği bulamaz, değeri sessizce boşalır
 * ve kullanıcı yalnızca düzenlemeye girip çıkarak bağı koparmış olurdu.
 */
function selectable<T extends { id: string; archived: boolean }>(
    items: readonly T[],
    keepId: string | null
): T[] {
    return items.filter((item) => !item.archived || item.id === keepId);
}

const PRIORITY_STYLES: Record<Priority, string> = {
    low: 'bg-success/10 text-success border-success/25',
    medium: 'bg-warning/10 text-warning border-warning/25',
    high: 'bg-destructive/10 text-destructive border-destructive/25',
};

export function TaskForm({ onClose, taskToEdit }: TaskFormProps) {
    const { t } = useTranslation();
    const addTask = useTaskStore(state => state.addTask);
    const updateTask = useTaskStore(state => state.updateTask);
    const categories = useTaskStore(state => state.categories);
    const clients = useTaskStore(state => state.clients);
    const projects = useTaskStore(state => state.projects);

    const sortedCategories = [...categories].sort(byCategoryPosition);

    const titleRef = useRef<HTMLInputElement>(null);
    const [title, setTitle] = useState(taskToEdit?.title || '');
    const [description, setDescription] = useState(taskToEdit?.description || '');
    const [priority, setPriority] = useState<Priority>(taskToEdit?.priority || 'medium');
    // Boş metin "Kategorisiz" demek: select değeri null taşıyamaz.
    const [categoryId, setCategoryId] = useState<string>(taskToEdit?.categoryId ?? '');
    // dueDate zaten 'YYYY-MM-DD' — date input'unun beklediği biçimle aynı.
    const [dueDate, setDueDate] = useState<string>(taskToEdit?.dueDate ?? '');
    const [clientId, setClientId] = useState<string>(taskToEdit?.clientId ?? '');
    const [projectId, setProjectId] = useState<string>(taskToEdit?.projectId ?? '');

    const clientOptions = selectable(clientsForDisplay(clients), taskToEdit?.clientId ?? null);
    const projectOptions = clientId
        ? selectable(projectsForDisplay(projects, clientId), taskToEdit?.projectId ?? null)
        : [];

    /**
     * Müşteri değişince proje sıfırlanır. Şemadaki
     * `tasks_project_id_client_id_user_id_fkey` üçlüsü projenin müşterisiyle
     * görevin müşterisinin aynı olmasını zorunlu tutuyor; eski proje bırakılsa
     * gönderim 23503 ile düşer ve o turdaki bütün senkron onunla giderdi.
     */
    const handleClientChange = (nextClientId: string) => {
        setClientId(nextClientId);
        setProjectId('');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim()) {
            toast.error(t('taskForm.titleRequired'));
            return;
        }

        // Müşterisiz proje şemada imkânsız (`tasks_project_requires_client`);
        // seçici zaten engelliyor ama bağ burada da kesilir.
        const links = {
            clientId: clientId || null,
            projectId: clientId ? projectId || null : null,
        };

        if (taskToEdit) {
            updateTask(taskToEdit.id, {
                title,
                description,
                priority,
                categoryId: categoryId || null,
                ...links,
                dueDate: dueDate || undefined
            });
            toast.success(t('taskForm.updated'));
        } else {
            addTask({
                title,
                description,
                priority,
                categoryId: categoryId || null,
                ...links,
                completed: false,
                dueDate: dueDate || undefined
            });
            toast.success(t('taskForm.created'));
        }

        onClose();
    };

    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            {/*
              * Odak başlık alanına Radix'in açılış kancasıyla veriliyor, `autoFocus`
              * ile değil: `n` kısayoluyla açan kullanıcı hemen yazabilmeli, ama
              * Radix varsayılanı içerideki İLK odaklanabilir öğeyi (kapatma
              * butonu) seçerdi. `autoFocus` prop'u ise `jsx-a11y/no-autofocus`
              * tarafından yasak — kural sayfa yüklenirken kayan odağı hedefliyor,
              * kullanıcının bilerek açtığı diyaloğu değil.
              */}
            <DialogContent
                onOpenAutoFocus={(event) => {
                    // Ref boşsa varsayılan engellenmemeli: `preventDefault` çalışıp
                    // odaklanacak alan da bulunamazsa odak diyaloğun tamamen
                    // dışında kalır ve klavye kullanıcısı içeri hiç giremez.
                    if (!titleRef.current) return;
                    event.preventDefault();
                    titleRef.current.focus();
                }}
            >
                <DialogHeader>
                    <DialogTitle>
                        {taskToEdit ? t('taskForm.editTitle') : t('taskForm.createTitle')}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
                    <div className="p-5 overflow-y-auto flex-1 space-y-5">
                        <div className="space-y-1.5">
                            <label htmlFor="title" className="text-sm font-medium">
                                {t('taskForm.title')} <span className="text-destructive">*</span>
                            </label>
                            <input
                                id="title"
                                ref={titleRef}
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder={t('taskForm.titlePlaceholder')}
                                className="flex h-11 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="description" className="text-sm font-medium">
                                {t('taskForm.description')}{' '}
                                <span className="text-muted-foreground font-normal">
                                    {t('common.optional')}
                                </span>
                            </label>
                            <textarea
                                id="description"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder={t('taskForm.descriptionPlaceholder')}
                                className="flex min-h-[80px] w-full rounded-xl border border-input bg-transparent px-3 py-2 justify-start text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label htmlFor="dueDate" className="text-sm font-medium flex items-center gap-1.5">
                                    <CalendarIcon size={14} className="text-muted-foreground" />
                                    {t('taskForm.dueDate')}
                                </label>
                                <input
                                    id="dueDate"
                                    type="date"
                                    value={dueDate}
                                    onChange={e => setDueDate(e.target.value)}
                                    className="flex h-11 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="category" className="text-sm font-medium flex items-center gap-1.5">
                                    <Tag size={14} className="text-muted-foreground" />
                                    {t('taskForm.category')}
                                </label>
                                <select
                                    id="category"
                                    value={categoryId}
                                    onChange={e => setCategoryId(e.target.value)}
                                    className="flex h-11 w-full rounded-xl border border-input bg-card px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                >
                                    <option value="">{t('category.uncategorized')}</option>
                                    {sortedCategories.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/*
                          * Niş modül bloğu. Bayrak kapalıyken hiç basılmaz —
                          * `task-mapping.ts` de o durumda client_id/project_id
                          * sütunlarını göndermiyor, yani seçici gösterilseydi
                          * kullanıcı hiçbir yere yazılmayan bir bağ kurardı.
                          */}
                        {NICHE_MODULE && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label htmlFor="client" className="text-sm font-medium flex items-center gap-1.5">
                                        <Briefcase size={14} className="text-muted-foreground" />
                                        {t('taskForm.client')}
                                    </label>
                                    <select
                                        id="client"
                                        value={clientId}
                                        onChange={e => handleClientChange(e.target.value)}
                                        className="flex h-11 w-full rounded-xl border border-input bg-card px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                    >
                                        <option value="">{t('client.none')}</option>
                                        {clientOptions.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label htmlFor="project" className="text-sm font-medium flex items-center gap-1.5">
                                        <FolderKanban size={14} className="text-muted-foreground" />
                                        {t('taskForm.project')}
                                    </label>
                                    <select
                                        id="project"
                                        value={projectId}
                                        disabled={!clientId}
                                        onChange={e => setProjectId(e.target.value)}
                                        className="flex h-11 w-full rounded-xl border border-input bg-card px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <option value="">
                                            {clientId ? t('project.none') : t('project.clientRequired')}
                                        </option>
                                        {projectOptions.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        <fieldset className="space-y-2">
                            <legend className="text-sm font-medium mb-2">{t('taskForm.priority')}</legend>
                            <div className="flex gap-2">
                                {PRIORITIES.map(p => (
                                    <button
                                        type="button"
                                        key={p}
                                        onClick={() => setPriority(p)}
                                        aria-pressed={priority === p}
                                        className={`flex-1 py-2 px-3 rounded-xl border text-sm font-medium transition-all ${priority === p
                                            ? `${PRIORITY_STYLES[p]} ring-2 ring-primary/20 shadow-sm`
                                            : 'border-border bg-card text-muted-foreground hover:bg-muted font-normal'
                                            }`}
                                    >
                                        {t(`priority.${p}`)}
                                    </button>
                                ))}
                            </div>
                        </fieldset>
                    </div>

                    <DialogFooter>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl font-medium text-foreground hover:bg-muted transition-colors border border-transparent hover:border-border"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2.5 rounded-xl font-medium bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 hover:shadow-primary/30 active:scale-95 transition-all"
                        >
                            {taskToEdit ? t('taskForm.submitEdit') : t('taskForm.submitCreate')}
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
