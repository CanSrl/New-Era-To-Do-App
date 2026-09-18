import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StatsDashboard } from '../components/StatsDashboard';
import { FilterBar } from '../components/FilterBar';
import { TaskList } from '../components/TaskList';
import { useTaskStore } from '../store';
import { useUiStore } from '../store/ui';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { Trash2 } from 'lucide-react';
import { InteractiveIcon } from '../components/ui/InteractiveIcon';
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
} from '../components/ui/alert-dialog';

export function TasksPage() {
    const { t } = useTranslation();
    const tasks = useTaskStore(state => state.tasks);
    const clearCompleted = useTaskStore(state => state.clearCompleted);

    // Form kabukta (AppLayout) render edilir; burada yalnızca açılır.
    const openTaskForm = useUiStore(state => state.openTaskForm);

    const activeTasks = tasks.filter(t => !t.completed).length;
    const completedTasks = tasks.filter(t => t.completed).length;

    useEffect(() => {
        if (tasks.length > 0 && activeTasks === 0) {
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                /*
                 * Bu dört değer paletin ham karşılığıdır ve bilinçli olarak
                 * token DEĞİLDİR: `canvas-confetti` renkleri `hexToRgb` ile
                 * okuyor, yani hex dışındaki her biçimi (hsl dahil) sessizce
                 * bozuk renge çeviriyor. Palet değişirse burası elle
                 * güncellenmeli — sırasıyla primary, accent, highlight ve
                 * açık indigo.
                 */
                colors: ['#4f46e5', '#9061f2', '#f59e0b', '#818cf8']
            });
            toast.success(t('tasks.allDone'), { id: 'all-done' });
        }
    }, [activeTasks, tasks.length, t]);

    return (
        <>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight mb-1">{t('tasks.greeting')}</h2>
                    <p className="text-muted-foreground">{t('tasks.subtitle')}</p>
                </div>

                {completedTasks > 0 && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <button className="group px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 self-start sm:self-auto">
                                <InteractiveIcon type="wiggle">
                                    <Trash2 size={16} />
                                </InteractiveIcon>
                                {t('tasks.clearCompleted')}
                            </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>{t('tasks.clearConfirmTitle')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                    {t('tasks.clearConfirmBody')}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => {
                                        clearCompleted();
                                        toast.success(t('tasks.cleared'));
                                    }}
                                >
                                    {t('tasks.clearAction')}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </div>

            {tasks.length > 0 && (
                <>
                    <StatsDashboard />
                    <FilterBar />
                </>
            )}

            <div className="mb-6">
                {tasks.length === 0 ? (
                    <div className="bg-card border border-border/50 rounded-2xl p-6 md:p-12 shadow-sm flex flex-col items-center justify-center text-center">
                        <InteractiveIcon type="bounce">
                            <div className="w-16 h-16 md:w-24 md:h-24 mb-3 md:mb-4 rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/10">
                                <span className="text-3xl md:text-4xl">🚀</span>
                            </div>
                        </InteractiveIcon>
                        <h3 className="text-lg md:text-xl font-bold tracking-tight mb-2">{t('tasks.emptyTitle')}</h3>
                        <p className="text-muted-foreground mb-4 md:mb-6 text-sm md:text-base">{t('tasks.emptyBody')}</p>
                        <button
                            onClick={() => openTaskForm()}
                            className="group relative overflow-hidden bg-gradient-to-r from-primary to-accent text-primary-foreground px-6 py-2.5 rounded-xl font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/35 active:scale-95 transition-all"
                        >
                            <span className="relative z-10">{t('tasks.emptyAction')}</span>
                            <span className="absolute inset-0 bg-gradient-to-r from-accent via-primary to-accent bg-[length:200%_100%] opacity-0 transition-opacity group-hover:opacity-100 animate-shimmer" />
                        </button>
                    </div>
                ) : (
                    <TaskList onEditTask={(task) => openTaskForm(task.id)} />
                )}
            </div>
        </>
    );
}
