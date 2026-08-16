import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTaskStore } from '../store';
import { TaskItem } from './TaskItem';
import { byPosition } from '../lib/tasks';
import type { Task } from '../lib/types';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

interface TaskListProps {
    onEditTask: (task: Task) => void;
}

export function TaskList({ onEditTask }: TaskListProps) {
    const { t } = useTranslation();
    const tasks = useTaskStore(state => state.tasks);
    const reorderTasks = useTaskStore(state => state.reorderTasks);
    const searchQuery = useTaskStore(state => state.searchQuery);
    const filter = useTaskStore(state => state.filter);

    /**
     * Azaltılmış hareket tercihi giriş/çıkış ve `layout` animasyonlarını
     * kapatır. `ClientCard` bunu zaten yapıyordu; burada eksikti ve iki
     * bileşen aynı kullanıcı tercihine farklı davranıyordu.
     *
     * Yan faydası testlerde: Playwright `reducedMotion: 'reduce'` ile
     * koşuyor, dolayısıyla satırlar tıklama anında yer değiştirmiyor.
     * Hareket eden hedef, "element is not stable" zaman aşımlarının kaynağıydı.
     */
    const reduceMotion = useReducedMotion();
    const duration = reduceMotion ? 0 : 0.2;

    // Sıra dizinin sırasına değil position alanına dayanır; içe aktarma veya
    // ileride gelecek senkronizasyon diziyi karışık bırakabilir.
    const ordered = useMemo(() => [...tasks].sort(byPosition), [tasks]);

    // Filter tasks based on current criteria
    const filteredTasks = ordered.filter(task => {
        // Search filter
        if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !(task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()))) {
            return false;
        }

        // Status filter
        if (filter === 'active' && task.completed) return false;
        if (filter === 'completed' && !task.completed) return false;

        return true;
    });

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // 5px movement before dragging starts
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = ordered.findIndex(t => t.id === active.id);
            const newIndex = ordered.findIndex(t => t.id === over.id);
            if (oldIndex === -1 || newIndex === -1) return;
            reorderTasks(arrayMove(ordered, oldIndex, newIndex));
        }
    };

    if (filteredTasks.length === 0) {
        return (
            <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground flex flex-col items-center">
                <span className="text-4xl mb-4">📭</span>
                <p className="font-medium text-lg text-foreground">{t('tasks.noResultsTitle')}</p>
                <p>{t('tasks.noResultsBody')}</p>
            </div>
        );
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <SortableContext
                items={filteredTasks.map(t => t.id)}
                strategy={verticalListSortingStrategy}
            >
                <div className="space-y-1">
                    <AnimatePresence mode="popLayout">
                        {filteredTasks.map((task) => (
                            <motion.div
                                key={task.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                transition={{ duration }}
                            >
                                <TaskItem task={task} onEdit={onEditTask} />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </SortableContext>
        </DndContext>
    );
}
