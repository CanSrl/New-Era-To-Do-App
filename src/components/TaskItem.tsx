import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '../lib/types';
import { useTaskStore } from '../store';
import { GripVertical, Edit2, Trash2, Calendar, Tag, Check, Briefcase, Play, Square } from 'lucide-react';
import { NICHE_MODULE } from '../config/features';
import { format, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { dateLocaleFor } from '../i18n';
import { isOverdue } from '../lib/tasks';
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

interface TaskItemProps {
    task: Task;
    onEdit: (task: Task) => void;
}

const priorityColors = {
    low: 'bg-green-500/10 text-green-600 dark:text-green-500',
    medium: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500',
    high: 'bg-red-500/10 text-red-600 dark:text-red-500',
};

export function TaskItem({ task, onEdit }: TaskItemProps) {
    const { t, i18n } = useTranslation();
    const toggleComplete = useTaskStore(state => state.toggleComplete);
    const deleteTask = useTaskStore(state => state.deleteTask);
    const category = useTaskStore(state =>
        task.categoryId === null
            ? undefined
            : state.categories.find(c => c.id === task.categoryId)
    );
    // Bayrak kapalıyken bağlar hiç okunmaz: niş modülü kapatmış kurulumda
    // eski yerel veride kalmış bir bağ ekranda görünmemeli.
    const client = useTaskStore(state =>
        !NICHE_MODULE || task.clientId === null
            ? undefined
            : state.clients.find(c => c.id === task.clientId)
    );
    const project = useTaskStore(state =>
        !NICHE_MODULE || task.projectId === null
            ? undefined
            : state.projects.find(p => p.id === task.projectId)
    );
    // Sayaç durumu bayrak kapalıyken hiç okunmaz; aşağıdaki blok da o zaman
    // hiç render edilmiyor.
    const isTimerRunning = useTaskStore(state =>
        NICHE_MODULE && state.activeTimer?.taskId === task.id
    );
    const startTimer = useTaskStore(state => state.startTimer);
    const stopTimer = useTaskStore(state => state.stopTimer);
    const [isDeleting, setIsDeleting] = useState(false);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: task.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : 1,
    };

    const handleConfirmDelete = () => {
        setIsDeleting(true);
        setTimeout(() => deleteTask(task.id), 200); // Wait for exit animation
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            /*
              * Çalışan satır çerçeveyle işaretlenir; renk token'lardan gelir
              * (sabit renk açık/koyu temanın birinde okunmaz olurdu) ve tek
              * gösterge değildir — satırdaki durdur butonu ve kabuktaki sayaç
              * çubuğu aynı bilgiyi metinle de taşır.
              */
            className={`group relative flex items-start gap-3 p-4 bg-card border rounded-xl shadow-sm transition-all hover:shadow-md mb-3 ${isTimerRunning ? 'border-primary ring-1 ring-primary/40' : 'border-border'} ${task.completed ? 'opacity-70 bg-muted/40' : ''} ${isDeleting ? 'scale-95 opacity-0 pointer-events-none' : ''}`}
        >
            <div
                {...attributes}
                {...listeners}
                className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-foreground transition-colors p-1 -ml-2 rounded-lg hover:bg-muted"
            >
                <GripVertical size={18} />
            </div>

            <button
                onClick={() => toggleComplete(task.id)}
                aria-pressed={task.completed}
                aria-label={
                    task.completed
                        ? t('taskItem.markIncomplete', { title: task.title })
                        : t('taskItem.markComplete', { title: task.title })
                }
                className={`mt-0.5 shrink-0 flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all ${task.completed
                    ? 'bg-green-500 border-green-500 text-white shadow-sm'
                    : 'border-muted-foreground/30 hover:border-primary hover:bg-primary/5'
                    }`}
            >
                {task.completed && <Check size={14} strokeWidth={3} />}
            </button>

            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h4 className={`font-semibold text-base transition-colors ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                            {task.title}
                        </h4>
                        {task.description && (
                            <p className={`text-sm mt-1 line-clamp-2 ${task.completed ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>
                                {task.description}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {/*
                          * Sayaç butonu diğer eylemlerin aksine çalışırken
                          * HER ZAMAN görünür: durdurmanın hover'a bağlı olması,
                          * unutulmuş sayacı görünmez kılardı — bu ürün
                          * kategorisinin klasik veri hatası tam olarak budur.
                          *
                          * Müşterisiz görevde buton kapalıdır çünkü
                          * `time_logs.client_id` zorunlu; sebebi `title` ile
                          * söylenmezse buton "bozuk" görünür.
                          */}
                        {NICHE_MODULE && (
                            <button
                                onClick={() => isTimerRunning
                                    ? stopTimer()
                                    : startTimer({
                                        taskId: task.id,
                                        clientId: task.clientId ?? '',
                                        projectId: task.projectId,
                                    })}
                                disabled={!task.clientId}
                                title={task.clientId ? undefined : t('time.needsClient')}
                                aria-label={isTimerRunning
                                    ? t('time.stopFor', { title: task.title })
                                    : t('time.startFor', { title: task.title })}
                                className={`p-1.5 rounded-md transition-all disabled:cursor-not-allowed disabled:opacity-30 ${isTimerRunning
                                    ? 'text-primary bg-primary/10 opacity-100'
                                    : 'text-muted-foreground hover:text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 disabled:group-hover:opacity-30'
                                    }`}
                            >
                                {isTimerRunning
                                    ? <Square size={16} fill="currentColor" />
                                    : <Play size={16} />}
                            </button>
                        )}

                        <button
                            onClick={() => onEdit(task)}
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-all opacity-0 group-hover:opacity-100"
                            title={t('common.edit')}
                            aria-label={t('taskItem.edit', { title: task.title })}
                        >
                            <Edit2 size={16} />
                        </button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <button
                                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all opacity-0 group-hover:opacity-100"
                                    title={t('common.delete')}
                                    aria-label={t('taskItem.delete', { title: task.title })}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>{t('taskItem.deleteConfirmTitle')}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        {t('taskItem.deleteConfirmBody')}
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleConfirmDelete}>
                                        {t('common.delete')}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${priorityColors[task.priority]}`}>
                        {t(`priority.${task.priority}`)}
                    </span>

                    {/*
                      * Kategorisiz görevlerde rozet hiç basılmaz: "Kategorisiz"
                      * yazmak listeyi gereksiz doldururdu.
                      *
                      * Renk bilginin tek taşıyıcısı değil — kategori adı her
                      * zaman yanında yazar; renk yalnızca tarama kolaylığı için.
                      */}
                    {category && (
                        <span
                            className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md"
                            style={{
                                color: category.color,
                                backgroundColor: `${category.color}1a`,
                            }}
                        >
                            <Tag size={12} />
                            {category.name}
                        </span>
                    )}

                    {/*
                      * Müşteri ve proje tek rozette birleşir: ikisi ayrı ayrı
                      * basılsaydı rozet sırası zaten kalabalık olan satırı
                      * ikiye bölerdi. Proje müşterisiz olamaz, dolayısıyla
                      * rozetin varlığı müşteriye bağlıdır.
                      */}
                    {client && (
                        <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md text-muted-foreground bg-muted">
                            <Briefcase size={12} />
                            {project ? `${client.name} · ${project.name}` : client.name}
                        </span>
                    )}

                    {task.dueDate && (
                        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-md ${isOverdue(task)
                            ? 'text-red-600 bg-red-500/10'
                            : 'text-muted-foreground bg-muted'
                            }`}>
                            <Calendar size={12} />
                            {format(parseISO(task.dueDate), 'd MMM yyyy', { locale: dateLocaleFor(i18n.language) })}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
