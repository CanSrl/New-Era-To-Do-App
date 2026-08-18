import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Briefcase, Clock, FolderKanban, ListTodo } from 'lucide-react';
import { useTaskStore } from '@/store';
import type { TimeLog } from '@/lib/types';
import { clientsForDisplay } from '@/lib/clients';
import { projectsForDisplay } from '@/lib/projects';
import { isValidDuration, TIME_LOG_NOTE_MAX } from '@/lib/time-logs';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface TimeLogFormProps {
    onClose: () => void;
    logToEdit?: TimeLog;
}

/**
 * Arşivlenmiş kayıtlar seçicide görünmez — tek istisna kaydın hâlihazırdaki
 * bağı. `TaskForm`'daki `selectable()` ile aynı gerekçe: gizlenseydi arşivli
 * müşteriye bağlı bir kaydı düzenlemeye açmak, `select` eşleşen seçeneği
 * bulamadığı için değeri sessizce boşaltır ve kullanıcı yalnızca forma girip
 * çıkarak bağı koparmış olurdu.
 */
function selectable<T extends { id: string; archived: boolean }>(
    items: readonly T[],
    keepId: string | null
): T[] {
    return items.filter((item) => !item.archived || item.id === keepId);
}

const FIELD_CLASS =
    'flex h-11 w-full rounded-xl border border-input bg-card px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50';

/** ISO damgasını `<input type="date">` ve `type="time">` değerlerine böler. */
function splitLocal(iso: string): { date: string; time: string } {
    const value = new Date(iso);
    if (Number.isNaN(value.getTime())) return { date: '', time: '' };

    const pad = (n: number) => String(n).padStart(2, '0');

    return {
        // Yerel alanlar okunuyor, UTC değil: kullanıcı kaydı kendi saatiyle
        // girdi, düzenlemeye açınca da kendi saatini görmeli.
        date: `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`,
        time: `${pad(value.getHours())}:${pad(value.getMinutes())}`,
    };
}

/**
 * Elle zaman kaydı girişi ve mevcut kaydın düzenlenmesi.
 *
 * Sayaçla aynı store eylemlerine (`addTimeLog`/`updateTimeLog`) düşer; iki
 * ayrı kod yolu olsaydı doğrulama kuralları er geç ayrışırdı.
 */
export function TimeLogForm({ onClose, logToEdit }: TimeLogFormProps) {
    const { t } = useTranslation();

    const addTimeLog = useTaskStore((state) => state.addTimeLog);
    const updateTimeLog = useTaskStore((state) => state.updateTimeLog);
    const clients = useTaskStore((state) => state.clients);
    const projects = useTaskStore((state) => state.projects);
    const tasks = useTaskStore((state) => state.tasks);

    const initial = splitLocal(logToEdit?.startedAt ?? new Date().toISOString());

    const [date, setDate] = useState(initial.date);
    const [time, setTime] = useState(initial.time);
    const [durationMinutes, setDurationMinutes] = useState(
        String(logToEdit?.durationMinutes ?? 30)
    );
    const [clientId, setClientId] = useState(logToEdit?.clientId ?? '');
    const [projectId, setProjectId] = useState(logToEdit?.projectId ?? '');
    const [taskId, setTaskId] = useState(logToEdit?.taskId ?? '');
    const [note, setNote] = useState(logToEdit?.note ?? '');

    const clientOptions = selectable(clientsForDisplay(clients), logToEdit?.clientId ?? null);
    const projectOptions = clientId
        ? selectable(projectsForDisplay(projects, clientId), logToEdit?.projectId ?? null)
        : [];

    /*
     * Görev listesi seçili müşteriye göre daralır. Şema bunu zorunlu tutmuyor
     * (`task_id` yalnızca göreve bağlıdır, müşterisine değil) ama başka bir
     * müşterinin görevine kayıt yazmak neredeyse kesinlikle yanlış seçimdir.
     * İstisna, kaydın kendi görevi: aksi halde düzenleme bağı sessizce koparırdı.
     */
    const taskOptions = tasks.filter(
        (task) => task.id === logToEdit?.taskId || (clientId && task.clientId === clientId)
    );

    /**
     * Müşteri değişince proje ve görev sıfırlanır. Şemadaki
     * `time_logs_project_id_client_id_user_id_fkey` üçlüsü projenin
     * müşterisiyle kaydın müşterisinin aynı olmasını zorunlu tutuyor; eski
     * proje bırakılsaydı gönderim 23503 ile düşer ve o turdaki bütün senkron
     * onunla giderdi.
     */
    const handleClientChange = (nextClientId: string) => {
        setClientId(nextClientId);
        setProjectId('');
        setTaskId('');
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();

        if (!clientId) {
            toast.error(t('time.clientRequired'));
            return;
        }

        const minutes = Number(durationMinutes);
        if (!isValidDuration(minutes)) {
            // Aynı sınır veritabanında da var (`duration_minutes > 0 and <= 1440`);
            // geçersiz satır push kuyruğuna girerse o turdaki bütün senkron düşer.
            toast.error(t('time.durationInvalid'));
            return;
        }

        // Tarih ve saat yerel okunup ISO'ya çevrilir; `new Date(y, m, d, h, mi)`
        // yerel saati kastediyor, damga UTC'ye o dönüşümle gider.
        const [year, month, day] = date.split('-').map(Number);
        const [hour, minute] = (time || '00:00').split(':').map(Number);
        const startedAt = new Date(year, month - 1, day, hour, minute).toISOString();

        const payload = {
            clientId,
            projectId: projectId || null,
            taskId: taskId || null,
            startedAt,
            durationMinutes: Math.floor(minutes),
            note: note.trim() || null,
        };

        if (logToEdit) {
            updateTimeLog(logToEdit.id, payload);
            toast.success(t('time.updated'));
        } else {
            addTimeLog(payload);
            toast.success(t('time.created'));
        }

        onClose();
    };

    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {logToEdit ? t('time.editTitle') : t('time.addTitle')}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
                    <div className="p-5 overflow-y-auto flex-1 space-y-5">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label htmlFor="log-date" className="text-sm font-medium">
                                    {t('time.date')}
                                </label>
                                <input
                                    id="log-date"
                                    type="date"
                                    required
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className={FIELD_CLASS}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="log-time" className="text-sm font-medium">
                                    {t('time.startTime')}
                                </label>
                                <input
                                    id="log-time"
                                    type="time"
                                    value={time}
                                    onChange={(e) => setTime(e.target.value)}
                                    className={FIELD_CLASS}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label
                                htmlFor="log-duration"
                                className="flex items-center gap-1.5 text-sm font-medium"
                            >
                                <Clock size={14} className="text-muted-foreground" />
                                {t('time.duration')}
                            </label>
                            <input
                                id="log-duration"
                                type="number"
                                min={1}
                                max={1440}
                                required
                                value={durationMinutes}
                                onChange={(e) => setDurationMinutes(e.target.value)}
                                className={FIELD_CLASS}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label
                                htmlFor="log-client"
                                className="flex items-center gap-1.5 text-sm font-medium"
                            >
                                <Briefcase size={14} className="text-muted-foreground" />
                                {t('time.client')}
                            </label>
                            <select
                                id="log-client"
                                value={clientId}
                                onChange={(e) => handleClientChange(e.target.value)}
                                className={FIELD_CLASS}
                            >
                                {/* Müşteri zorunlu: `time_logs.client_id` `not null`. */}
                                <option value="">{t('time.clientPlaceholder')}</option>
                                {clientOptions.map((client) => (
                                    <option key={client.id} value={client.id}>{client.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label
                                htmlFor="log-project"
                                className="flex items-center gap-1.5 text-sm font-medium"
                            >
                                <FolderKanban size={14} className="text-muted-foreground" />
                                {t('time.project')}
                            </label>
                            <select
                                id="log-project"
                                value={projectId}
                                disabled={!clientId}
                                onChange={(e) => setProjectId(e.target.value)}
                                className={FIELD_CLASS}
                            >
                                <option value="">
                                    {clientId ? t('time.projectNone') : t('project.clientRequired')}
                                </option>
                                {projectOptions.map((project) => (
                                    <option key={project.id} value={project.id}>{project.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label
                                htmlFor="log-task"
                                className="flex items-center gap-1.5 text-sm font-medium"
                            >
                                <ListTodo size={14} className="text-muted-foreground" />
                                {t('time.task')}
                            </label>
                            <select
                                id="log-task"
                                value={taskId}
                                disabled={!clientId}
                                onChange={(e) => setTaskId(e.target.value)}
                                className={FIELD_CLASS}
                            >
                                <option value="">{t('time.taskNone')}</option>
                                {taskOptions.map((task) => (
                                    <option key={task.id} value={task.id}>{task.title}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="log-note" className="text-sm font-medium">
                                {t('time.note')}
                            </label>
                            <input
                                id="log-note"
                                type="text"
                                maxLength={TIME_LOG_NOTE_MAX}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                className={FIELD_CLASS}
                            />
                        </div>
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
                            className="px-6 py-2.5 rounded-xl font-medium bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 active:scale-95 transition-all"
                        >
                            {logToEdit ? t('common.update') : t('common.add')}
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
