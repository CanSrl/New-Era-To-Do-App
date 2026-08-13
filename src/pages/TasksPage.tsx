import { useEffect } from 'react';
import { StatsDashboard } from '../components/StatsDashboard';
import { FilterBar } from '../components/FilterBar';
import { TaskList } from '../components/TaskList';
import { useTaskStore } from '../store';
import { useUiStore } from '../store/ui';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { Trash2 } from 'lucide-react';
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
                colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899']
            });
            toast.success('Harika! Tüm görevleri tamamladınız. 🎉', { id: 'all-done' });
        }
    }, [activeTasks, tasks.length]);

    return (
        <>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight mb-1">Merhaba! 👋</h2>
                    <p className="text-muted-foreground">Bugün neler başarmak istiyorsun?</p>
                </div>

                {completedTasks > 0 && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <button className="px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors flex items-center gap-1.5 self-start sm:self-auto">
                                <Trash2 size={16} /> Tamamlananları Temizle
                            </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Tamamlanan görevleri temizle</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Tamamlanan tüm görevleri silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>İptal</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => {
                                        clearCompleted();
                                        toast.success('Tamamlanan görevler temizlendi');
                                    }}
                                >
                                    Temizle
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </div>

            <StatsDashboard />
            <FilterBar />

            <div className="mb-6">
                {tasks.length === 0 ? (
                    <div className="bg-card border border-border rounded-xl p-12 shadow-sm flex flex-col items-center justify-center text-center">
                        <div className="w-24 h-24 mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-4xl">🚀</span>
                        </div>
                        <h3 className="text-xl font-bold tracking-tight mb-2">Henüz görev yok</h3>
                        <p className="text-muted-foreground mb-6">Hadi bir tane ekleyelim ve güne başlayalım!</p>
                        <button
                            onClick={() => openTaskForm()}
                            className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-primary/25 hover:bg-primary/90 hover:shadow-primary/30 active:scale-95 transition-all"
                        >
                            İlk Görevini Ekle
                        </button>
                    </div>
                ) : (
                    <TaskList onEditTask={(task) => openTaskForm(task.id)} />
                )}
            </div>
        </>
    );
}
