import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '../lib/types';
import { useTaskStore } from '../store';
import { GripVertical, Edit2, Trash2, Calendar, Tag, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
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
    'Düşük': 'bg-green-500/10 text-green-600 dark:text-green-500',
    'Orta': 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500',
    'Yüksek': 'bg-red-500/10 text-red-600 dark:text-red-500',
};

export function TaskItem({ task, onEdit }: TaskItemProps) {
    const toggleComplete = useTaskStore(state => state.toggleComplete);
    const deleteTask = useTaskStore(state => state.deleteTask);
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
            className={`group relative flex items-start gap-3 p-4 bg-card border border-border rounded-xl shadow-sm transition-all hover:shadow-md mb-3 ${task.completed ? 'opacity-70 bg-muted/40' : ''} ${isDeleting ? 'scale-95 opacity-0 pointer-events-none' : ''}`}
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
                        ? `"${task.title}" görevini tamamlanmadı olarak işaretle`
                        : `"${task.title}" görevini tamamlandı olarak işaretle`
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

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={() => onEdit(task)}
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                            title="Düzenle"
                            aria-label={`"${task.title}" görevini düzenle`}
                        >
                            <Edit2 size={16} />
                        </button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <button
                                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                                    title="Sil"
                                    aria-label={`"${task.title}" görevini sil`}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Görevi sil</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Bu görevi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>İptal</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleConfirmDelete}>Sil</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${priorityColors[task.priority]}`}>
                        {task.priority}
                    </span>

                    <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                        <Tag size={12} />
                        {task.category}
                    </span>

                    {task.dueDate && (
                        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-md ${isOverdue(task)
                            ? 'text-red-600 bg-red-500/10'
                            : 'text-muted-foreground bg-muted'
                            }`}>
                            <Calendar size={12} />
                            {format(parseISO(task.dueDate), 'd MMM yyyy', { locale: tr })}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
