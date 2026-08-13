import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTheme } from './ThemeProvider';
import { Moon, Sun, Monitor, CheckCircle2, ListTodo, PlusCircle, Settings } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTaskStore } from '../store';
import { useUiStore } from '../store/ui';
import { AccountMenu } from './AccountMenu';
import { AuthDialog } from './AuthDialog';
import { TaskForm } from './TaskForm';

const NAV_ITEMS = [
    { to: '/app', label: 'Görevlerim', shortLabel: 'Görevler', icon: ListTodo, end: true },
    { to: '/app/settings', label: 'Ayarlar', shortLabel: 'Ayarlar', icon: Settings, end: false },
];

export function AppLayout() {
    const { theme, setTheme } = useTheme();
    const tasks = useTaskStore((state) => state.tasks);
    const activeCount = tasks.filter(t => !t.completed).length;
    const openTaskForm = useUiStore((state) => state.openTaskForm);
    const closeTaskForm = useUiStore((state) => state.closeTaskForm);
    const isTaskFormOpen = useUiStore((state) => state.isTaskFormOpen);
    const editingTaskId = useUiStore((state) => state.editingTaskId);
    const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);

    // Görev formu kabukta yaşar: yüzen ekleme butonu ve mobil alt gezinmenin
    // merkez butonu her sayfada görünür, dolayısıyla form da her sayfada
    // açılabilmeli. Düzenlenen görev id üzerinden çözülür ki açık formdaki
    // kopya senkronizasyon sırasında bayatlamasın.
    const editingTask = editingTaskId
        ? tasks.find(t => t.id === editingTaskId)
        : undefined;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (
                e.key.toLowerCase() === 'n' &&
                document.activeElement?.tagName !== 'INPUT' &&
                document.activeElement?.tagName !== 'TEXTAREA'
            ) {
                e.preventDefault();
                useUiStore.getState().openTaskForm();
            }
            if (e.key === 'Escape') {
                useUiStore.getState().closeTaskForm();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row font-sans selection:bg-primary selection:text-primary-foreground transition-colors duration-300">

            {/* Masaüstü kenar çubuğu */}
            <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card/50 backdrop-blur-xl shrink-0 h-screen sticky top-0 p-4 z-10">
                <div className="flex items-center gap-3 mb-8 px-2">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
                        <CheckCircle2 size={18} strokeWidth={2.5} />
                    </div>
                    <h1 className="font-bold text-lg tracking-tight">Yapılacaklar</h1>
                </div>

                <nav className="flex-1 space-y-2">
                    {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            className={({ isActive }) => cn(
                                'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-md font-medium transition-colors',
                                isActive
                                    ? 'bg-secondary text-secondary-foreground'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                            )}
                        >
                            <span className="flex items-center gap-3">
                                <Icon size={18} />
                                {label}
                            </span>
                            {to === '/app' && activeCount > 0 && (
                                <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full inline-block">
                                    {activeCount}
                                </span>
                            )}
                        </NavLink>
                    ))}
                </nav>

                <div className="pt-4 border-t border-border mt-auto space-y-3">
                    <AccountMenu variant="sidebar" onSignInClick={() => setIsAuthDialogOpen(true)} />

                    <div className="flex items-center justify-between px-2 bg-secondary/50 p-1 rounded-lg">
                        <button
                            onClick={() => setTheme('light')}
                            className={cn('p-2 rounded-md transition-colors', theme === 'light' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
                            aria-label="Açık Tema"
                        >
                            <Sun size={16} />
                        </button>
                        <button
                            onClick={() => setTheme('system')}
                            className={cn('p-2 rounded-md transition-colors', theme === 'system' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
                            aria-label="Sistem Teması"
                        >
                            <Monitor size={16} />
                        </button>
                        <button
                            onClick={() => setTheme('dark')}
                            className={cn('p-2 rounded-md transition-colors', theme === 'dark' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
                            aria-label="Koyu Tema"
                        >
                            <Moon size={16} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Mobil üst bar */}
            <header className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-20">
                <div className="flex items-center gap-2">
                    <CheckCircle2 className="text-primary" size={24} />
                    <h1 className="font-bold text-lg">Yapılacaklar</h1>
                </div>
                <div className="flex items-center gap-2">
                    <AccountMenu variant="compact" onSignInClick={() => setIsAuthDialogOpen(true)} />
                    <button
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="p-2 rounded-full bg-secondary text-secondary-foreground"
                        aria-label={theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
                    >
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                </div>
            </header>

            {/* İçerik */}
            <main className="flex-1 flex flex-col min-w-0 max-h-screen overflow-y-auto pb-24 md:pb-0 relative">
                <div className="max-w-4xl w-full mx-auto p-4 md:p-8 flex-1">
                    <Outlet />
                </div>
            </main>

            {/* Mobil alt gezinme */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-card/80 backdrop-blur-xl z-20 pb-safe">
                <div className="grid grid-cols-3 items-center p-3">
                    <NavLink
                        to="/app"
                        end
                        className={({ isActive }) => cn(
                            'flex flex-col items-center justify-center gap-1 transition-colors',
                            isActive ? 'text-primary' : 'text-muted-foreground'
                        )}
                    >
                        <ListTodo size={20} />
                        <span className="text-[10px] font-medium">Görevler</span>
                    </NavLink>

                    <div className="flex justify-center">
                        <button
                            onClick={() => openTaskForm()}
                            className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform -translate-y-6"
                            aria-label="Görev Ekle"
                        >
                            <PlusCircle size={28} />
                        </button>
                    </div>

                    <NavLink
                        to="/app/settings"
                        className={({ isActive }) => cn(
                            'flex flex-col items-center justify-center gap-1 transition-colors',
                            isActive ? 'text-primary' : 'text-muted-foreground'
                        )}
                    >
                        <Settings size={20} />
                        <span className="text-[10px] font-medium">Ayarlar</span>
                    </NavLink>
                </div>
            </nav>

            {/* Masaüstü yüzen ekleme butonu */}
            <div className="hidden md:block fixed bottom-8 right-8 z-20">
                <button
                    onClick={() => openTaskForm()}
                    className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 flex items-center justify-center hover:scale-105 hover:bg-primary/90 active:scale-95 transition-all group"
                    title="Görev Ekle"
                >
                    <PlusCircle size={28} className="group-hover:rotate-90 transition-transform duration-300" />
                </button>
            </div>

            <AuthDialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen} />

            {isTaskFormOpen && (
                <TaskForm onClose={closeTaskForm} taskToEdit={editingTask} />
            )}
        </div>
    );
}
