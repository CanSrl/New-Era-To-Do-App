import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { StatsDashboard } from './components/StatsDashboard';
import { FilterBar } from './components/FilterBar';
import { TaskList } from './components/TaskList';
import { TaskForm } from './components/TaskForm';
import { useTaskStore } from './store';
import type { Task } from './lib/types';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { Trash2, Download, Upload } from 'lucide-react';
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
} from './components/ui/alert-dialog';

function App() {
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const tasks = useTaskStore(state => state.tasks);
  const clearCompleted = useTaskStore(state => state.clearCompleted);
  const importTasks = useTaskStore(state => state.importTasks);

  const activeTasks = tasks.filter(t => !t.completed).length;
  const completedTasks = tasks.filter(t => t.completed).length;

  useEffect(() => {
    // Check if tasks were just fully completed
    const taskCount = tasks.length;
    if (taskCount > 0 && activeTasks === 0) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899']
      });
      toast.success('Harika! Tüm görevleri tamamladınız. 🎉', { id: 'all-done' });
    }
  }, [activeTasks, tasks.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 'n' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        setEditingTask(undefined);
        setIsTaskFormOpen(true);
      }
      if (e.key === 'Escape') {
        setIsTaskFormOpen(false);
        setEditingTask(undefined);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsTaskFormOpen(true);
  };

  const closeForm = () => {
    setIsTaskFormOpen(false);
    setTimeout(() => setEditingTask(undefined), 200);
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tasks));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "yapilacaklar_export.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    toast.success('Görevler başarıyla dışa aktarıldı');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          importTasks(imported);
          toast.success('Görevler başarıyla içe aktarıldı');
        } else {
          toast.error('Geçersiz dosya formatı');
        }
      } catch {
        toast.error('Dosya okunamadı');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  return (
    <Layout onAddClick={() => { setEditingTask(undefined); setIsTaskFormOpen(true); }}>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-1">Merhaba! 👋</h2>
          <p className="text-muted-foreground">Bugün neler başarmak istiyorsun?</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExport}
            className="px-3 py-1.5 text-sm font-medium bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors flex items-center gap-1.5"
            title="Dışa Aktar"
          >
            <Download size={16} /> <span className="hidden sm:inline">Dışa Aktar</span>
          </button>
          <label
            className="px-3 py-1.5 text-sm font-medium bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="İçe Aktar"
          >
            <Upload size={16} /> <span className="hidden sm:inline">İçe Aktar</span>
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>

          {completedTasks > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors flex items-center gap-1.5">
                  <Trash2 size={16} /> <span className="hidden sm:inline">Temizle</span>
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
              onClick={() => setIsTaskFormOpen(true)}
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-primary/25 hover:bg-primary/90 hover:shadow-primary/30 active:scale-95 transition-all"
            >
              İlk Görevini Ekle
            </button>
          </div>
        ) : (
          <TaskList onEditTask={handleEditTask} />
        )}
      </div>

      {isTaskFormOpen && (
        <TaskForm onClose={closeForm} taskToEdit={editingTask} />
      )}
    </Layout>
  )
}

export default App
