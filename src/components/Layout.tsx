import React, { useState } from 'react';
import { useTheme } from './ThemeProvider';
import { Moon, Sun, Monitor, CheckCircle2, ListTodo, PlusCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTaskStore } from '../store';
import { AccountMenu } from './AccountMenu';
import { AuthDialog } from './AuthDialog';

interface LayoutProps {
    children: React.ReactNode;
    onAddClick: () => void;
}

export function Layout({ children, onAddClick }: LayoutProps) {
    const { theme, setTheme } = useTheme();
    const tasks = useTaskStore((state) => state.tasks);
    const activeCount = tasks.filter(t => !t.completed).length;
    const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row font-sans selection:bg-primary selection:text-primary-foreground transition-colors duration-300">

            {/* Desktop Sidebar */}
            <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card/50 backdrop-blur-xl shrink-0 h-screen sticky top-0 p-4 z-10">
                <div className="flex items-center gap-3 mb-8 px-2">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
                        <CheckCircle2 size={18} strokeWidth={2.5} />
                    </div>
                    <h1 className="font-bold text-lg tracking-tight">Yapılacaklar</h1>
                </div>

                <nav className="flex-1 space-y-2">
                    <button className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-md bg-secondary text-secondary-foreground font-medium transition-colors">
                        <div className="flex items-center gap-3">
                            <ListTodo size={18} />
                            <span>Görevlerim</span>
                        </div>
                        {activeCount > 0 && (
                            <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full inline-block">
                                {activeCount}
                            </span>
                        )}
                    </button>
                </nav>

                <div className="pt-4 border-t border-border mt-auto space-y-3">
                    <AccountMenu variant="sidebar" onSignInClick={() => setIsAuthDialogOpen(true)} />

                    <div className="flex items-center justify-between px-2 bg-secondary/50 p-1 rounded-lg">
                        <button
                            onClick={() => setTheme('light')}
                            className={cn("p-2 rounded-md transition-colors", theme === 'light' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                            aria-label="Açık Tema"
                        >
                            <Sun size={16} />
                        </button>
                        <button
                            onClick={() => setTheme('system')}
                            className={cn("p-2 rounded-md transition-colors", theme === 'system' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                            aria-label="Sistem Teması"
                        >
                            <Monitor size={16} />
                        </button>
                        <button
                            onClick={() => setTheme('dark')}
                            className={cn("p-2 rounded-md transition-colors", theme === 'dark' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                            aria-label="Koyu Tema"
                        >
                            <Moon size={16} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Mobile Top Bar */}
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

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 max-h-screen overflow-y-auto pb-24 md:pb-0 relative">
                <div className="max-w-4xl w-full mx-auto p-4 md:p-8 flex-1">
                    {children}
                </div>
            </main>

            {/* Mobile Bottom Nav */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-card/80 backdrop-blur-xl z-20 pb-safe">
                <div className="flex items-center justify-center p-3 relative">
                    <button className="flex flex-col items-center justify-center text-primary gap-1 absolute left-8">
                        <ListTodo size={20} />
                        <span className="text-[10px] font-medium">Görevler</span>
                    </button>

                    <button
                        onClick={onAddClick}
                        className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform -translate-y-6"
                    >
                        <PlusCircle size={28} />
                    </button>
                </div>
            </nav>

            {/* Desktop Floating Add Button */}
            <div className="hidden md:block fixed bottom-8 right-8 z-20">
                <button
                    onClick={onAddClick}
                    className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 flex items-center justify-center hover:scale-105 hover:bg-primary/90 active:scale-95 transition-all group"
                    title="Görev Ekle"
                >
                    <PlusCircle size={28} className="group-hover:rotate-90 transition-transform duration-300" />
                </button>
            </div>

            <AuthDialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen} />

        </div>
    );
}
